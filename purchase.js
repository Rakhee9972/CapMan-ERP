
/* ==========================================
   CAPMAN ERP - PURCHASE MANAGEMENT
   Supplier Master, PR & Purchase Orders
   Version: 1.0
========================================== */

"use strict";

const PurchaseModule = {

    supplierStorage: "capman_suppliers",
    requisitionStorage: "capman_purchase_requisitions",
    orderStorage: "capman_purchase_orders",

    suppliers: [],
    requisitions: [],
    orders: [],

    /* ----------------------------------
       1. INITIALIZE
    ---------------------------------- */

    initialize() {

        try {
            this.suppliers = this.load(this.supplierStorage);
            this.requisitions = this.load(this.requisitionStorage);
            this.orders = this.load(this.orderStorage);
        } catch (error) {
            console.error("Purchase initialization error:", error);
        }

        this.render();

        console.log("Purchase module initialized.");
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

    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error("Purchase save error:", error);
            return false;
        }
    },

    /* ----------------------------------
       2. SUPPLIER MASTER
    ---------------------------------- */

    addSupplier(data) {

        if (!data || !data.code || !data.name) {
            return this.fail(
                "Supplier code and name are required."
            );
        }

        const code = String(data.code).trim().toUpperCase();

        if (this.getSupplier(code)) {
            return this.fail("Supplier code already exists.");
        }

        const supplier = {
            id: this.generateId("SUP"),
            code,
            name: String(data.name).trim(),
            contactPerson: String(data.contactPerson || "").trim(),
            phone: String(data.phone || "").trim(),
            email: String(data.email || "").trim(),
            address: String(data.address || "").trim(),
            gstNumber: String(data.gstNumber || "").trim(),
            paymentTerms: String(data.paymentTerms || "").trim(),
            status: "Active",
            createdAt: new Date().toISOString()
        };

        this.suppliers.push(supplier);

        if (!this.save(this.supplierStorage, this.suppliers)) {
            this.suppliers.pop();
            return this.fail("Unable to save supplier.");
        }

        this.render();
        this.notify("Supplier added successfully.");

        return supplier;
    },

    getSupplier(code) {
        return this.suppliers.find(
            supplier => supplier.code ===
                String(code).trim().toUpperCase()
        ) || null;
    },

    getAllSuppliers() {
        return [...this.suppliers];
    },

    /* ----------------------------------
       3. PURCHASE REQUISITION
    ---------------------------------- */

    createRequisition(data) {

        if (!data || !data.materialCode || !data.quantity) {
            return this.fail(
                "Material code and quantity are required."
            );
        }

        const quantity = Number(data.quantity);

        if (!Number.isFinite(quantity) || quantity <= 0) {
            return this.fail("Enter a valid PR quantity.");
        }

        const requisition = {
            id: this.generateId("PR"),
            prNumber: "PR-" + Date.now(),
            materialCode: String(data.materialCode).trim(),
            materialName: String(data.materialName || "").trim(),
            quantity,
            uom: String(data.uom || "PCS").trim(),
            requiredDate: data.requiredDate || "",
            department: String(data.department || "Stores"),
            requestedBy: String(data.requestedBy || ""),
            priority: data.priority || "Normal",
            reason: String(data.reason || ""),
            status: "Pending Approval",
            createdAt: new Date().toISOString()
        };

        this.requisitions.push(requisition);

        if (!this.save(
            this.requisitionStorage,
            this.requisitions
        )) {
            this.requisitions.pop();
            return this.fail("Unable to save requisition.");
        }

        this.render();
        this.notify("Purchase requisition created.");

        return requisition;
    },

    /* ----------------------------------
       4. APPROVE PURCHASE REQUISITION
    ---------------------------------- */

    approveRequisition(prNumber) {

        const pr = this.requisitions.find(
            item => item.prNumber === prNumber
        );

        if (!pr) {
            return this.fail("Purchase requisition not found.");
        }

        if (pr.status !== "Pending Approval") {
            return this.fail("Requisition is not awaiting approval.");
        }

        pr.status = "Approved";

        if (!this.save(
            this.requisitionStorage,
            this.requisitions
        )) {
            pr.status = "Pending Approval";
            return this.fail("Approval could not be saved.");
        }

        this.render();
        this.notify("Purchase requisition approved.");

        return true;
    },

    /* ----------------------------------
       5. REJECT PURCHASE REQUISITION
    ---------------------------------- */

    rejectRequisition(prNumber, reason) {

        const pr = this.requisitions.find(
            item => item.prNumber === prNumber
        );

        if (!pr) {
            return this.fail("Requisition not found.");
        }

        if (!reason || !String(reason).trim()) {
            return this.fail("Rejection reason is required.");
        }

        const oldStatus = pr.status;

        pr.status = "Rejected";
        pr.rejectionReason = String(reason).trim();

        if (!this.save(
            this.requisitionStorage,
            this.requisitions
        )) {
            pr.status = oldStatus;
            return this.fail("Rejection could not be saved.");
        }

        this.render();

        return true;
    },

    /* ----------------------------------
       6. RECORD SUPPLIER QUOTATION
    ---------------------------------- */

    addQuotation(prNumber, data) {

        const pr = this.requisitions.find(
            item => item.prNumber === prNumber
        );

        if (!pr || pr.status !== "Approved") {
            return this.fail(
                "Approve the requisition before quotations."
            );
        }

        const supplier = this.getSupplier(data?.supplierCode);

        if (!supplier || supplier.status !== "Active") {
            return this.fail("Select an active supplier.");
        }

        const price = Number(data.unitPrice);

        if (!Number.isFinite(price) || price < 0) {
            return this.fail("Enter a valid quoted price.");
        }

        if (!Array.isArray(pr.quotations)) {
            pr.quotations = [];
        }

        pr.quotations.push({
            id: this.generateId("QUO"),
            supplierCode: supplier.code,
            supplierName: supplier.name,
            unitPrice: price,
            currency: data.currency || "INR",
            deliveryDays: Number(data.deliveryDays) || 0,
            validityDate: data.validityDate || "",
            paymentTerms: String(data.paymentTerms || ""),
            remarks: String(data.remarks || ""),
            recordedAt: new Date().toISOString()
        });

        if (!this.save(
            this.requisitionStorage,
            this.requisitions
        )) {
            pr.quotations.pop();
            return this.fail("Quotation could not be saved.");
        }

        this.render();

        this.notify("Supplier quotation recorded.");

        return pr.quotations;
    },

    /* ----------------------------------
       7. CREATE SUPPLIER PURCHASE ORDER
    ---------------------------------- */

    createPurchaseOrder(data) {

        if (!data || !data.supplierCode || !data.materialCode) {
            return this.fail(
                "Supplier and material are required."
            );
        }

        const supplier = this.getSupplier(data.supplierCode);

        if (!supplier || supplier.status !== "Active") {
            return this.fail("Supplier is not active.");
        }

        const quantity = Number(data.quantity);
        const unitPrice = Number(data.unitPrice);

        if (!Number.isFinite(quantity) || quantity <= 0) {
            return this.fail("Invalid PO quantity.");
        }

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            return this.fail("Invalid unit price.");
        }

        if (!data.expectedDate) {
            return this.fail("Expected delivery date is required.");
        }

        const poNumber = "PO-" + Date.now();

        const order = {
            id: this.generateId("PO"),
            poNumber,
            prNumber: data.prNumber || "",
            supplierCode: supplier.code,
            supplierName: supplier.name,
            materialCode: String(data.materialCode).trim(),
            materialName: String(data.materialName || "").trim(),
            quantity,
            receivedQty: 0,
            rejectedQty: 0,
            pendingQty: quantity,
            uom: String(data.uom || "KG"),
            unitPrice,
            totalValue: quantity * unitPrice,
            currency: data.currency || "INR",
            expectedDate: data.expectedDate,
            paymentTerms: String(data.paymentTerms || ""),
            status: "Open",
            createdAt: new Date().toISOString(),
            remarks: String(data.remarks || "")
        };

        this.orders.push(order);

        if (!this.save(this.orderStorage, this.orders)) {
            this.orders.pop();
            return this.fail("Purchase order could not be saved.");
        }

        this.render();
        this.notify("Supplier PO created successfully.");

        return order;
    },

    /* ----------------------------------
       8. GET PURCHASE ORDER
    ---------------------------------- */

    getOrder(poNumber) {
        return this.orders.find(
            order => order.poNumber === poNumber
        ) || null;
    },

    getAllOrders() {
        return [...this.orders];
    },

    /* ----------------------------------
       9. RECORD GOODS RECEIPT
       Actual stock posting will be handled
       by the Inventory / GRN module.
    ---------------------------------- */

    recordReceipt(poNumber, acceptedQty, rejectedQty = 0) {

        const order = this.getOrder(poNumber);

        if (!order) {
            return this.fail("Purchase order not found.");
        }

        if (order.status === "Closed" ||
            order.status === "Cancelled") {
            return this.fail("This PO is not open for receipt.");
        }

        const accepted = Number(acceptedQty);
        const rejected = Number(rejectedQty);

        if (
            !Number.isFinite(accepted) ||
            !Number.isFinite(rejected) ||
            accepted < 0 ||
            rejected < 0 ||
            accepted + rejected <= 0
        ) {
            return this.fail("Invalid receipt quantities.");
        }

        const remaining = order.quantity -
            order.receivedQty -
            order.rejectedQty;

        if (accepted + rejected > remaining) {
            return this.fail(
                "Receipt exceeds remaining PO quantity."
            );
        }

        const old = {
            receivedQty: order.receivedQty,
            rejectedQty: order.rejectedQty,
            pendingQty: order.pendingQty,
            status: order.status
        };

        order.receivedQty += accepted;
        order.rejectedQty += rejected;

        order.pendingQty = Math.max(
            0,
            order.quantity -
            order.receivedQty -
            order.rejectedQty
        );

        if (order.pendingQty === 0) {
            order.status = "Received";
        } else if (order.receivedQty + order.rejectedQty > 0) {
            order.status = "Partially Received";
        }

        if (!this.save(this.orderStorage, this.orders)) {
            Object.assign(order, old);
            return this.fail("Receipt update failed.");
        }

        this.render();

        this.notify(
            "PO receipt recorded. Accepted: " +
            accepted + ", Rejected: " + rejected
        );

        return {
            acceptedQty: order.receivedQty,
            rejectedQty: order.rejectedQty,
            pendingQty: order.pendingQty,
            status: order.status
        };
    },

    /* ----------------------------------
       10. CLOSE PURCHASE ORDER
    ---------------------------------- */

    closeOrder(poNumber) {

        const order = this.getOrder(poNumber);

        if (!order) {
            return this.fail("Purchase order not found.");
        }

        if (order.pendingQty > 0) {
            return this.fail(
                "Pending quantity exists. Review before closing."
            );
        }

        const oldStatus = order.status;

        order.status = "Closed";

        if (!this.save(this.orderStorage, this.orders)) {
            order.status = oldStatus;
            return this.fail("PO closure failed.");
        }

        this.render();

        return true;
    },

    /* ----------------------------------
       11. CANCEL PURCHASE ORDER
    ---------------------------------- */

    cancelOrder(poNumber, reason) {

        const order = this.getOrder(poNumber);

        if (!order) {
            return this.fail("Purchase order not found.");
        }

        if (order.receivedQty > 0) {
            return this.fail(
                "Partially received PO needs authorized review."
            );
        }

        if (!reason || !String(reason).trim()) {
            return this.fail("Cancellation reason is required.");
        }

        const oldStatus = order.status;

        order.status = "Cancelled";
        order.cancellationReason = String(reason).trim();

        if (!this.save(this.orderStorage, this.orders)) {
            order.status = oldStatus;
            return this.fail("PO cancellation failed.");
        }

        this.render();

        return true;
    },

    /* ----------------------------------
       12. PURCHASE SUMMARY
    ---------------------------------- */

    getSummary() {

        return {
            suppliers: this.suppliers.length,

            requisitions: this.requisitions.length,

            pendingApproval: this.requisitions.filter(
                pr => pr.status === "Pending Approval"
            ).length,

            totalPOs: this.orders.length,

            openPOs: this.orders.filter(
                po => ["Open", "Partially Received"].includes(po.status)
            ).length,

            receivedPOs: this.orders.filter(
                po => po.status === "Received" ||
                      po.status === "Closed"
            ).length,

            totalOrderedQty: this.orders.reduce(
                (sum, po) => sum + po.quantity,
                0
            ),

            totalReceivedQty: this.orders.reduce(
                (sum, po) => sum + po.receivedQty,
                0
            ),

            totalPendingQty: this.orders.reduce(
                (sum, po) => sum + po.pendingQty,
                0
            )
        };
    },

    /* ----------------------------------
       13. RENDER PURCHASE ORDER TABLE
    ---------------------------------- */

    render() {

        const container = document.getElementById(
            "purchase-order-container"
        );

        if (!container) return;

        if (this.orders.length === 0) {
            container.innerHTML = `
                <p class="text-muted">
                    No supplier purchase orders available.
                </p>
            `;
            return;
        }

        container.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>PO Number</th>
                            <th>Supplier</th>
                            <th>Material</th>
                            <th>Ordered</th>
                            <th>Accepted</th>
                            <th>Rejected</th>
                            <th>Pending</th>
                            <th>Expected Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${this.orders.map(po => `
                            <tr>
                                <td>${this.escape(po.poNumber)}</td>
                                <td>${this.escape(po.supplierName)}</td>
                                <td>${this.escape(po.materialName || po.materialCode)}</td>
                                <td>${this.number(po.quantity)}</td>
                                <td>${this.number(po.receivedQty)}</td>
                                <td>${this.number(po.rejectedQty)}</td>
                                <td>${this.number(po.pendingQty)}</td>
                                <td>${this.escape(po.expectedDate)}</td>
                                <td>${this.escape(po.status)}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;
    },

    /* ----------------------------------
       14. COMMON HELPERS
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


/* ------------------------------------------
   15. GLOBAL ACCESS
------------------------------------------ */

window.CapManPurchase = PurchaseModule;
      
