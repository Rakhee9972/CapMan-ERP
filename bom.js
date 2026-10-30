
/* ==========================================
   CAPMAN ERP - BILL OF MATERIALS
   Version: 1.0
========================================== */

"use strict";

const BOMMaster = {

    storageKey: "capman_bom_master",

    bomList: [],

    /* ----------------------------------
       1. DEFAULT BOM TEMPLATES
    ---------------------------------- */

    createDefaultBOMs() {

        return [

            {
                bomCode: "BOM-CL-001",
                name: "Outer Cap Production",
                department: "Closure",
                outputItem: "SFG-001",
                outputName: "Outer Cap",
                outputUOM: "PCS",
                components: [
                    {
                        itemCode: "H200MA",
                        itemName: "H200MA",
                        quantity: 0,
                        uom: "KG"
                    },
                    {
                        itemCode: "MB-001",
                        itemName: "Colour Masterbatch",
                        quantity: 0,
                        uom: "KG"
                    }
                ],
                version: 1,
                status: "Draft",
                remarks: "Consumption ratio to be confirmed"
            },

            {
                bomCode: "BOM-CL-002",
                name: "Inner Cap Production",
                department: "Closure",
                outputItem: "SFG-002",
                outputName: "Inner Cap",
                outputUOM: "PCS",
                components: [
                    {
                        itemCode: "H200MA",
                        itemName: "H200MA",
                        quantity: 0,
                        uom: "KG"
                    },
                    {
                        itemCode: "MB-001",
                        itemName: "Colour Masterbatch",
                        quantity: 0,
                        uom: "KG"
                    }
                ],
                version: 1,
                status: "Draft",
                remarks: "Consumption ratio to be confirmed"
            },

            {
                bomCode: "BOM-WD-001",
                name: "Finished Cap Production",
                department: "Wadding",
                outputItem: "FG-001",
                outputName: "Finished Cap",
                outputUOM: "PCS",
                components: [
                    {
                        itemCode: "SFG-001",
                        itemName: "Outer Cap",
                        quantity: 0,
                        uom: "PCS"
                    },
                    {
                        itemCode: "SFG-002",
                        itemName: "Inner Cap",
                        quantity: 0,
                        uom: "PCS"
                    },
                    {
                        itemCode: "WAD-001",
                        itemName: "Wadding Wad",
                        quantity: 0,
                        uom: "PCS"
                    }
                ],
                version: 1,
                status: "Draft",
                remarks: "Component ratio to be confirmed"
            },

            {
                bomCode: "BOM-PK-001",
                name: "Finished Goods Packing",
                department: "Packing",
                outputItem: "FG-001",
                outputName: "Packed Finished Cap",
                outputUOM: "PCS",
                components: [
                    {
                        itemCode: "FG-001",
                        itemName: "Finished Cap",
                        quantity: 0,
                        uom: "PCS"
                    },
                    {
                        itemCode: "PM-001",
                        itemName: "Polyethylene Bag",
                        quantity: 0,
                        uom: "PCS"
                    },
                    {
                        itemCode: "PM-002",
                        itemName: "Shipper Box",
                        quantity: 0,
                        uom: "PCS"
                    },
                    {
                        itemCode: "PM-003",
                        itemName: "Packing Cover",
                        quantity: 0,
                        uom: "PCS"
                    }
                ],
                version: 1,
                status: "Draft",
                remarks: "Packing specification to be confirmed"
            }

        ];
    },

    /* ----------------------------------
       2. INITIALIZE
    ---------------------------------- */

    initialize() {

        try {

            const saved = localStorage.getItem(
                this.storageKey
            );

            if (saved) {

                const parsed = JSON.parse(saved);

                this.bomList = Array.isArray(parsed)
                    ? parsed
                    : this.createDefaultBOMs();

            } else {

                this.bomList = this.createDefaultBOMs();

                this.save();
            }

        } catch (error) {

            console.error("BOM loading error:", error);

            this.bomList = this.createDefaultBOMs();
        }

        this.render();

        console.log(
            "BOM Master initialized:",
            this.bomList.length
        );
    },

    /* ----------------------------------
       3. SAVE
    ---------------------------------- */

    save() {

        try {

            localStorage.setItem(
                this.storageKey,
                JSON.stringify(this.bomList)
            );

            return true;

        } catch (error) {

            console.error("BOM save failed:", error);

            return false;
        }
    },

    /* ----------------------------------
       4. GET ALL BOMs
    ---------------------------------- */

    getAll() {

        return [...this.bomList];
    },

    /* ----------------------------------
       5. GET BOM BY CODE
    ---------------------------------- */

    getByCode(code) {

        return this.bomList.find(
            bom => bom.bomCode === code
        ) || null;
    },

    /* ----------------------------------
       6. FILTER BY DEPARTMENT
    ---------------------------------- */

    getByDepartment(department) {

        return this.bomList.filter(
            bom => bom.department === department
        );
    },

    /* ----------------------------------
       7. ADD NEW BOM
    ---------------------------------- */

    add(data) {

        if (!data || !data.name || !data.outputItem) {
            return this.fail(
                "BOM name and output item are required."
            );
        }

        if (!Array.isArray(data.components) ||
            data.components.length === 0) {

            return this.fail(
                "At least one component is required."
            );
        }

        const bomCode = data.bomCode ||
            this.generateCode();

        if (this.getByCode(bomCode)) {
            return this.fail("BOM code already exists.");
        }

        const bom = {
            bomCode,
            name: String(data.name),
            department: String(data.department || ""),
            outputItem: String(data.outputItem),
            outputName: String(data.outputName || ""),
            outputUOM: String(data.outputUOM || "PCS"),

            components: data.components.map(component => ({
                itemCode: String(component.itemCode || ""),
                itemName: String(component.itemName || ""),
                quantity: Number(component.quantity) || 0,
                uom: String(component.uom || "PCS")
            })),

            version: 1,
            status: "Draft",
            remarks: String(data.remarks || "")
        };

        this.bomList.push(bom);

        if (!this.save()) {
            this.bomList.pop();
            return false;
        }

        this.render();

        this.notify("BOM created successfully.");

        return bom;
    },

    /* ----------------------------------
       8. UPDATE COMPONENT QUANTITY
    ---------------------------------- */

    updateComponent(bomCode, itemCode, quantity) {

        const bom = this.getByCode(bomCode);

        if (!bom) {
            return this.fail("BOM not found.");
        }

        if (bom.status === "Approved") {
            return this.fail(
                "Approved BOM cannot be edited. Create a new version."
            );
        }

        const qty = Number(quantity);

        if (!Number.isFinite(qty) || qty < 0) {
            return this.fail("Invalid component quantity.");
        }

        const component = bom.components.find(
            item => item.itemCode === itemCode
        );

        if (!component) {
            return this.fail("Component not found.");
        }

        const oldQuantity = component.quantity;

        component.quantity = qty;

        if (!this.save()) {
            component.quantity = oldQuantity;
            return false;
        }

        this.render();

        this.notify("BOM component updated.");

        return true;
    },

    /* ----------------------------------
       9. APPROVE BOM
    ---------------------------------- */

    approve(bomCode) {

        const bom = this.getByCode(bomCode);

        if (!bom) {
            return this.fail("BOM not found.");
        }

        const invalid = bom.components.some(
            item =>
                !item.itemCode ||
                !Number.isFinite(Number(item.quantity)) ||
                Number(item.quantity) <= 0
        );

        if (invalid) {
            return this.fail(
                "Enter valid positive quantities for every component."
            );
        }

        const oldStatus = bom.status;

        bom.status = "Approved";

        if (!this.save()) {
            bom.status = oldStatus;
            return false;
        }

        this.render();

        this.notify("BOM approved successfully.");

        return true;
    },

    /* ----------------------------------
       10. CREATE NEW VERSION
    ---------------------------------- */

    createNewVersion(bomCode) {

        const oldBOM = this.getByCode(bomCode);

        if (!oldBOM) {
            return this.fail("BOM not found.");
        }

        const newBOM = JSON.parse(
            JSON.stringify(oldBOM)
        );

        newBOM.bomCode = this.generateCode();

        newBOM.version = Number(oldBOM.version) + 1;

        newBOM.status = "Draft";

        this.bomList.push(newBOM);

        if (!this.save()) {
            this.bomList.pop();
            return false;
        }

        this.render();

        this.notify("New BOM version created.");

        return newBOM;
    },

    /* ----------------------------------
       11. CALCULATE MATERIAL REQUIREMENT
    ---------------------------------- */

    calculateRequirements(bomCode, outputQuantity) {

        const bom = this.getByCode(bomCode);

        if (!bom || bom.status !== "Approved") {
            return this.fail(
                "Only an approved BOM can calculate requirements."
            );
        }

        const output = Number(outputQuantity);

        if (!Number.isFinite(output) || output <= 0) {
            return this.fail("Enter valid output quantity.");
        }

        return bom.components.map(component => ({

            itemCode: component.itemCode,

            itemName: component.itemName,

            requiredQuantity:
                component.quantity * output,

            uom: component.uom

        }));
    },

    /* ----------------------------------
       12. BOM SUMMARY
    ---------------------------------- */

    getSummary() {

        return {
            total: this.bomList.length,

            draft: this.bomList.filter(
                bom => bom.status === "Draft"
            ).length,

            approved: this.bomList.filter(
                bom => bom.status === "Approved"
            ).length
        };
    },

    /* ----------------------------------
       13. RENDER BOM TABLE
    ---------------------------------- */

    render() {

        const container = document.getElementById(
            "bom-table-container"
        );

        if (!container) return;

        if (this.bomList.length === 0) {

            container.innerHTML =
                "<p>No BOM records found.</p>";

            return;
        }

        container.innerHTML = `
            <div class="table-container">

                <table>

                    <thead>
                        <tr>
                            <th>BOM Code</th>
                            <th>BOM Name</th>
                            <th>Department</th>
                            <th>Output Item</th>
                            <th>Components</th>
                            <th>Version</th>
                            <th>Status</th>
                        </tr>
                    </thead>

                    <tbody>

                        ${this.bomList.map(bom => `

                            <tr>
                                <td>${this.escape(bom.bomCode)}</td>

                                <td>${this.escape(bom.name)}</td>

                                <td>${this.escape(bom.department)}</td>

                                <td>${this.escape(bom.outputName)}</td>

                                <td>${bom.components.length}</td>

                                <td>V${bom.version}</td>

                                <td>${this.escape(bom.status)}</td>
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

    generateCode() {

        return "BOM-" +
            Date.now().toString(36).toUpperCase();
    },

    escape(value) {

        const element = document.createElement("div");

        element.textContent = String(value ?? "");

        return element.innerHTML;
    },

    notify(message) {

        if (window.CapMan?.notifications) {
            window.CapMan.notifications.success(message);
        } else {
            console.log(message);
        }
    },

    fail(message) {

        if (window.CapMan?.notifications) {
            window.CapMan.notifications.error(message);
        } else {
            console.error(message);
        }

        return false;
    }
};


/* ------------------------------------------
   15. GLOBAL ACCESS
------------------------------------------ */

window.CapManBOM = BOMMaster;
