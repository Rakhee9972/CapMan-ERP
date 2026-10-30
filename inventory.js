
/* ==========================================
   CAPMAN ERP - INVENTORY MANAGEMENT
   Version: 1.0
   Local Storage Prototype
========================================== */

"use strict";

const InventoryModule = {

    storageKey: "capman_inventory_stock",
    ledgerKey: "capman_inventory_ledger",

    stock: [],
    ledger: [],

    /* ----------------------------------
       1. INITIALIZE INVENTORY
    ---------------------------------- */

    initialize() {

        try {

            this.stock = this.load(this.storageKey);
            this.ledger = this.load(this.ledgerKey);

            if (this.stock.length === 0) {
                this.initializeOpeningStock();
            }

        } catch (error) {

            console.error("Inventory initialization error:", error);

            this.stock = [];
            this.ledger = [];
        }

        this.render();

        console.log("Inventory initialized.");
    },

    load(key) {

        try {

            const data = JSON.parse(
                localStorage.getItem(key) || "[]"
            );

            return Array.isArray(data) ? data : [];

        } catch {
            return [];
        }
    },

    saveStock() {

        try {

            localStorage.setItem(
                this.storageKey,
                JSON.stringify(this.stock)
            );

            return true;

        } catch (error) {

            console.error(error);
            return false;
        }
    },

    saveLedger() {

        try {

            localStorage.setItem(
                this.ledgerKey,
                JSON.stringify(this.ledger)
            );

            return true;

        } catch (error) {

            console.error(error);
            return false;
        }
    },

    /* ----------------------------------
       2. OPENING STOCK
    ---------------------------------- */

    initializeOpeningStock() {

        const materials =
            window.CapManMaterials?.getAll() || [];

        this.stock = materials.map(material => ({

            itemCode: material.code,
            itemName: material.name,
            category: material.category,
            uom: material.uom,

            batchNo: "OPENING",

            warehouse: this.getDefaultWarehouse(
                material.category
            ),

            quantity: Number(material.openingStock) || 0,

            reservedQty: 0,

            updatedAt: new Date().toISOString()

        }));

        this.saveStock();
    },

    getDefaultWarehouse(category) {

        const warehouses = {

            "Raw Material": "RM-STORE",

            "Semi Finished Goods": "SFG-STORE",

            "Finished Goods": "FG-STORE",

            "Packing Material": "PACK-STORE"

        };

        return warehouses[category] || "GENERAL-STORE";
    },

    /* ----------------------------------
       3. GET STOCK
    ---------------------------------- */

    getAllStock() {

        return [...this.stock];
    },

    getStock(itemCode) {

        return this.stock
            .filter(item => item.itemCode === itemCode)
            .reduce((sum, item) => sum + item.quantity, 0);
    },

    getAvailableStock(itemCode) {

        return this.stock
            .filter(item => item.itemCode === itemCode)
            .reduce(
                (sum, item) =>
                    sum + item.quantity - item.reservedQty,
                0
            );
    },

    getBatchStock(itemCode, batchNo) {

        const item = this.stock.find(stock =>
            stock.itemCode === itemCode &&
            stock.batchNo === batchNo
        );

        return item ? item.quantity : 0;
    },

    /* ----------------------------------
       4. FIND OR CREATE STOCK RECORD
    ---------------------------------- */

    findStock(itemCode, batchNo, warehouse) {

        return this.stock.find(item =>

            item.itemCode === itemCode &&
            item.batchNo === batchNo &&
            item.warehouse === warehouse

        );
    },

    getMaterialDetails(itemCode) {

        return window.CapManMaterials?.getByCode(itemCode) || null;
    },

    /* ----------------------------------
       5. POST GOODS RECEIPT / GRN
       Only QC-accepted quantity enters stock.
    ---------------------------------- */

    postGRN(data) {

        if (!data || !data.itemCode || !data.reference) {
            return this.fail(
                "Item code and GRN reference are required."
            );
        }

        if (this.ledger.some(entry =>
            entry.reference === data.reference &&
            entry.type === "GRN"
        )) {
            return this.fail(
                "This GRN has already been posted."
            );
        }

        const accepted = Number(data.acceptedQty);
        const rejected = Number(data.rejectedQty || 0);

        if (
            !Number.isFinite(accepted) ||
            !Number.isFinite(rejected) ||
            accepted < 0 ||
            rejected < 0 ||
            accepted + rejected <= 0
        ) {
            return this.fail("Invalid GRN quantities.");
        }

        const material = this.getMaterialDetails(data.itemCode);

        if (!material) {
            return this.fail("Material not found in Material Master.");
        }

        const batchNo = String(data.batchNo || "").trim();

        if (!batchNo) {
            return this.fail("Supplier batch number is required.");
        }

        const warehouse = String(
            data.warehouse || this.getDefaultWarehouse(material.category)
        );

        const oldStock = JSON.stringify(this.stock);
        const oldLedger = JSON.stringify(this.ledger);

        if (accepted > 0) {

            let record = this.findStock(
                data.itemCode,
                batchNo,
                warehouse
            );

            if (!record) {

                record = {
                    itemCode: material.code,
                    itemName: material.name,
                    category: material.category,
                    uom: material.uom,
                    batchNo,
                    warehouse,
                    quantity: 0,
                    reservedQty: 0,
                    updatedAt: new Date().toISOString()
                };

                this.stock.push(record);
            }

            record.quantity += accepted;

            record.updatedAt = new Date().toISOString();
        }

        this.addLedgerEntry({

            type: "GRN",
            reference: data.reference,
            itemCode: data.itemCode,
            batchNo,
            warehouse,
            acceptedQty: accepted,
            rejectedQty: rejected,
            quantity: accepted,
            uom: material.uom,
            remarks: data.remarks || ""

        });

        if (!this.commit(oldStock, oldLedger)) {
            return false;
        }

        this.render();

        this.notify(
            "GRN posted. Accepted stock: " + accepted
        );

        return true;
    },

    /* ----------------------------------
       6. MATERIAL ISSUE TO PRODUCTION
    ---------------------------------- */

    issueMaterial(data) {

        if (!data || !data.itemCode || !data.workOrder) {
            return this.fail(
                "Item code and Work Order are required."
            );
        }

        const quantity = Number(data.quantity);

        if (!Number.isFinite(quantity) || quantity <= 0) {
            return this.fail("Invalid issue quantity.");
        }

        if (this.ledger.some(entry =>
            entry.reference === data.reference &&
            entry.type === "ISSUE"
        ) && data.reference) {
            return this.fail("This issue reference already exists.");
        }

        const batchNo = String(data.batchNo || "").trim();

        const warehouse = String(
            data.warehouse || "RM-STORE"
        );

        const record = this.findStock(
            data.itemCode,
            batchNo,
            warehouse
        );

        if (!record || record.quantity < quantity) {
            return this.fail("Insufficient stock in selected batch.");
        }

        const oldStock = JSON.stringify(this.stock);
        const oldLedger = JSON.stringify(this.ledger);

        record.quantity -= quantity;
        record.updatedAt = new Date().toISOString();

        this.addLedgerEntry({

            type: "ISSUE",
            reference: data.reference || this.generateId("ISS"),
            workOrder: data.workOrder,
            itemCode: data.itemCode,
            batchNo,
            warehouse,
            quantity: -quantity,
            uom: record.uom,
            remarks: data.remarks || ""

        });

        if (!this.commit(oldStock, oldLedger)) {
            return false;
        }

        this.render();

        this.notify("Material issued to production.");

        return true;
    },

    /* ----------------------------------
       7. MATERIAL RETURN FROM PRODUCTION
    ---------------------------------- */

    returnMaterial(data) {

        if (!data || !data.itemCode || !data.workOrder) {
            return this.fail(
                "Item code and Work Order are required."
            );
        }

        const quantity = Number(data.quantity);

        if (!Number.isFinite(quantity) || quantity <= 0) {
            return this.fail("Invalid return quantity.");
        }

        const batchNo = String(data.batchNo || "").trim();

        const warehouse = String(
            data.warehouse || "RM-STORE"
        );

        const material = this.getMaterialDetails(data.itemCode);

        if (!material) {
            return this.fail("Material not found.");
        }

        const oldStock = JSON.stringify(this.stock);
        const oldLedger = JSON.stringify(this.ledger);

        let record = this.findStock(
            data.itemCode,
            batchNo,
            warehouse
        );

        if (!record) {

            record = {
                itemCode: material.code,
                itemName: material.name,
                category: material.category,
                uom: material.uom,
                batchNo,
                warehouse,
                quantity: 0,
                reservedQty: 0,
                updatedAt: new Date().toISOString()
            };

            this.stock.push(record);
        }

        record.quantity += quantity;

        record.updatedAt = new Date().toISOString();

        this.addLedgerEntry({

            type: "RETURN",
            reference: data.reference || this.generateId("RET"),
            workOrder: data.workOrder,
            itemCode: data.itemCode,
            batchNo,
            warehouse,
            quantity,
            uom: material.uom,
            remarks: data.remarks || ""

        });

        if (!this.commit(oldStock, oldLedger)) {
            return false;
        }

        this.render();

        this.notify("Material returned to store.");

        return true;
    },

    /* ----------------------------------
       8. STOCK TRANSFER
    ---------------------------------- */

    transferStock(data) {

        if (
            !data ||
            !data.itemCode ||
            !data.fromWarehouse ||
            !data.toWarehouse ||
            data.fromWarehouse === data.toWarehouse
        ) {
            return this.fail("Invalid stock transfer details.");
        }

        const quantity = Number(data.quantity);

        if (!Number.isFinite(quantity) || quantity <= 0) {
            return this.fail("Invalid transfer quantity.");
        }

        const batchNo = String(data.batchNo || "").trim();

        const source = this.findStock(
            data.itemCode,
            batchNo,
            data.fromWarehouse
        );

        if (!source || source.quantity < quantity) {
            return this.fail("Insufficient source warehouse stock.");
        }

        const oldStock = JSON.stringify(this.stock);
        const oldLedger = JSON.stringify(this.ledger);

        const material = this.getMaterialDetails(data.itemCode);

        if (!material) {
            return this.fail("Material not found.");
        }

        source.quantity -= quantity;

        let destination = this.findStock(
            data.itemCode,
            batchNo,
            data.toWarehouse
        );

        if (!destination) {

            destination = {
                itemCode: material.code,
                itemName: material.name,
                category: material.category,
                uom: material.uom,
                batchNo,
                warehouse: data.toWarehouse,
                quantity: 0,
                reservedQty: 0,
                updatedAt: new Date().toISOString()
            };

            this.stock.push(destination);
        }

        destination.quantity += quantity;

        const reference = data.reference ||
            this.generateId("TRF");

        this.addLedgerEntry({
            type: "TRANSFER OUT",
            reference,
            itemCode: data.itemCode,
            batchNo,
            warehouse: data.fromWarehouse,
            quantity: -quantity,
            uom: material.uom
        });

        this.addLedgerEntry({
            type: "TRANSFER IN",
            reference,
            itemCode: data.itemCode,
            batchNo,
            warehouse: data.toWarehouse,
            quantity,
            uom: material.uom
        });

        if (!this.commit(oldStock, oldLedger)) {
            return false;
        }

        this.render();

        this.notify("Stock transferred successfully.");

        return true;
    },

    /* ----------------------------------
       9. STOCK ADJUSTMENT
       Use only with authorized approval.
    ---------------------------------- */

    adjustStock(data) {

        if (!data || !data.itemCode || !data.reason) {
            return this.fail(
                "Item code and adjustment reason are required."
            );
        }

        if (data.approved !== true) {
            return this.fail(
                "Stock adjustment requires approval."
            );
        }

        const quantity = Number(data.quantity);

        if (!Number.isFinite(quantity) || quantity === 0) {
            return this.fail("Adjustment quantity cannot be zero.");
        }

        const batchNo = String(data.batchNo || "").trim();

        const warehouse = String(
            data.warehouse || "GENERAL-STORE"
        );

        const material = this.getMaterialDetails(data.itemCode);

        if (!material) {
            return this.fail("Material not found.");
        }

        let record = this.findStock(
            data.itemCode,
            batchNo,
            warehouse
        );

        const current = record ? record.quantity : 0;

        if (current + quantity < 0) {
            return this.fail("Adjustment would create negative stock.");
        }

        const oldStock = JSON.stringify(this.stock);
        const oldLedger = JSON.stringify(this.ledger);

        if (!record) {

            record = {
                itemCode: material.code,
                itemName: material.name,
                category: material.category,
                uom: material.uom,
                batchNo,
                warehouse,
                quantity: 0,
                reservedQty: 0,
                updatedAt: new Date().toISOString()
            };

            this.stock.push(record);
        }

        record.quantity += quantity;

        this.addLedgerEntry({

            type: "ADJUSTMENT",
            reference: data.reference || this.generateId("ADJ"),
            itemCode: data.itemCode,
            batchNo,
            warehouse,
            quantity,
            uom: material.uom,
            remarks: data.reason

        });

        if (!this.commit(oldStock, oldLedger)) {
            return false;
        }

        this.render();

        this.notify("Stock adjustment posted.");

        return true;
    },

    /* ----------------------------------
       10. LEDGER ENTRY
    ---------------------------------- */

    addLedgerEntry(data) {

        this.ledger.unshift({

            id: this.generateId("TXN"),

            date: new Date().toISOString(),

            type: data.type,

            reference: data.reference,

            workOrder: data.workOrder || "",

            itemCode: data.itemCode,

            batchNo: data.batchNo,

            warehouse: data.warehouse,

            quantity: data.quantity,

            acceptedQty: data.acceptedQty ?? null,

            rejectedQty: data.rejectedQty ?? null,

            uom: data.uom,

            remarks: data.remarks || ""

        });
    },

    /* ----------------------------------
       11. TRANSACTION COMMIT / ROLLBACK
    ---------------------------------- */

    commit(oldStock, oldLedger) {

        if (this.saveStock() && this.saveLedger()) {
            return true;
        }

        this.stock = JSON.parse(oldStock);
        this.ledger = JSON.parse(oldLedger);

        try {
            localStorage.setItem(this.storageKey, oldStock);
            localStorage.setItem(this.ledgerKey, oldLedger);
        } catch (error) {
            console.error("Rollback error:", error);
        }

        return this.fail("Transaction could not be saved.");
    },

    /* ----------------------------------
       12. STOCK SUMMARY
    ---------------------------------- */

    getSummary() {

        const summary = {
            totalItems: 0,
            totalQuantity: 0,
            rawMaterial: 0,
            sfg: 0,
            finishedGoods: 0,
            packingMaterial: 0
        };

        const itemCodes = [
            ...new Set(this.stock.map(item => item.itemCode))
        ];

        summary.totalItems = itemCodes.length;

        this.stock.forEach(item => {

            summary.totalQuantity += item.quantity;

            if (item.category === "Raw Material") {
                summary.rawMaterial += item.quantity;
            }

            if (item.category === "Semi Finished Goods") {
                summary.sfg += item.quantity;
            }

            if (item.category === "Finished Goods") {
                summary.finishedGoods += item.quantity;
            }

            if (item.category === "Packing Material") {
                summary.packingMaterial += item.quantity;
            }
        });

        return summary;
    },

    /* ----------------------------------
       13. STOCK LEDGER FILTER
    ---------------------------------- */

    getLedger(itemCode = "") {

        if (!itemCode) {
            return [...this.ledger];
        }

        return this.ledger.filter(
            entry => entry.itemCode === itemCode
        );
    },

    /* ----------------------------------
       14. LOW STOCK REPORT
    ---------------------------------- */

    getLowStock() {

        const materials =
            window.CapManMaterials?.getAll() || [];

        return materials.map(material => {

            const currentStock = this.getStock(material.code);

            return {
                itemCode: material.code,
                itemName: material.name,
                currentStock,
                minimumStock: Number(material.minStock) || 0
            };

        }).filter(item =>
            item.minimumStock > 0 &&
            item.currentStock <= item.minimumStock
        );
    },

    /* ----------------------------------
       15. RENDER STOCK TABLE
    ---------------------------------- */

    render() {

        const container = document.getElementById(
            "inventory-table-container"
        );

        if (!container) return;

        if (this.stock.length === 0) {

            container.innerHTML = `
                <p class="text-muted">
                    No inventory records available.
                </p>
            `;

            return;
        }

        container.innerHTML = `
            <div class="table-container">

                <table>

                    <thead>
                        <tr>
                            <th>Item Code</th>
                            <th>Item Name</th>
                            <th>Category</th>
                            <th>Batch</th>
                            <th>Warehouse</th>
                            <th>Stock</th>
                            <th>UOM</th>
                        </tr>
                    </thead>
                     <tbody>

                        ${this.stock.map(item => `

                            <tr>
                                <td>${this.escape(item.itemCode)}</td>
                                <td>${this.escape(item.itemName)}</td>
                                <td>${this.escape(item.category)}</td>
                                <td>${this.escape(item.batchNo)}</td>
                                <td>${this.escape(item.warehouse)}</td>
                                <td>${this.number(item.quantity)}</td>
                                <td>${this.escape(item.uom)}</td>
                            </tr>

                        `).join("")}
                         </tbody>

                </table>

            </div>
        `;
    },

    /* ----------------------------------
       16. HELPERS
    ---------------------------------- */

    generateId(prefix) {

        return prefix + "-" +
            Date.now().toString(36).toUpperCase() +
            "-" +
          Math.random().toString(36).slice(2, 6).toUpperCase();
    },

    number(value) {

        return Number(value || 0).toLocaleString("en-IN");
    },

    escape(value) {

        const element = document.createElement("div");

        element.textContent = String(value ?? "");

        return element.innerHTML;
    },

    notify(message, type = "success") {

        if (window.CapMan?.notifications) {

            window.CapMan.notifications.show(message, type);
          } else {

            console.log(message);
        }
    },

    fail(message) {

        this.notify(message, "error");

        return false;
    }
};


/*
------------------------------------------
   17. GLOBAL ACCESS
------------------------------------------ */

window.CapManInventory = InventoryModule;
