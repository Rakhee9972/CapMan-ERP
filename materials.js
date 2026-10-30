
/* ==========================================
   CAPMAN ERP - MATERIAL MASTER
   Version: 1.0
========================================== */

"use strict";

const MaterialMaster = {

    storageKey: "capman_material_master",

    materials: [],

    /* ----------------------------------
       1. DEFAULT MATERIAL MASTER
    ---------------------------------- */

    createDefaultMaterials() {

        return [

            {
                id: "RM-001",
                code: "H200MA",
                name: "H200MA",
                category: "Raw Material",
                type: "Polymer",
                uom: "KG",
                colour: "Natural",
                minStock: 0,
                openingStock: 0,
                status: "Active",
                remarks: "Closure production raw material"
            },

            {
                id: "RM-002",
                code: "MB-001",
                name: "White Masterbatch",
                category: "Raw Material",
                type: "Masterbatch",
                uom: "KG",
                colour: "White",
                minStock: 0,
                openingStock: 0,
                status: "Active",
                remarks: "Colour-wise consumption"
            },

            {
                id: "RM-003",
                code: "MB-002",
                name: "Blue Masterbatch",
                category: "Raw Material",
                type: "Masterbatch",
                uom: "KG",
                colour: "Blue",
                minStock: 0,
                openingStock: 0,
                status: "Active",
                remarks: "Colour-wise consumption"
            },

            {
                id: "RM-004",
                code: "MB-003",
                name: "Red Masterbatch",
                category: "Raw Material",
                type: "Masterbatch",
                uom: "KG",
                colour: "Red",
                minStock: 0,
                openingStock: 0,
                status: "Active",
                remarks: "Colour-wise consumption"
            },

            {
                id: "RM-005",
                code: "MB-004",
                name: "Green Masterbatch",
                category: "Raw Material",
                type: "Masterbatch",
                uom: "KG",
                colour: "Green",
                minStock: 0,
                openingStock: 0,
                status: "Active",
                remarks: "Colour-wise consumption"
            },

            {
                id: "RM-006",
                code: "WAD-001",
                name: "Wadding Wad",
                category: "Raw Material",
                type: "Wad",
                uom: "PCS",
                colour: "White",
                minStock: 0,
                openingStock: 0,
                status: "Active",
                remarks: "Wadding department input"
            },

            {
                id: "SFG-001",
                code: "SFG-001",
                name: "Outer Cap",
                category: "Semi Finished Goods",
                type: "Closure SFG",
                uom: "PCS",
                colour: "As per production",
                minStock: 0,
                openingStock: 0,
                status: "Active",
                remarks: "Closure department output"
            },

            {
                id: "SFG-002",
                code: "SFG-002",
                name: "Inner Cap",
                category: "Semi Finished Goods",
                type: "Closure SFG",
                uom: "PCS",
                colour: "As per production",
                minStock: 0,
                openingStock: 0,
                status: "Active",
                remarks: "Closure department output"
            },

            {
                id: "FG-001",
                code: "FG-001",
                name: "Finished Cap",
                category: "Finished Goods",
                type: "Closure Product",
                uom: "PCS",
                colour: "As per product",
                minStock: 0,
                openingStock: 0,
                status: "Active",
                remarks: "Wadding department output"
            },

            {
                id: "PM-001",
                code: "PM-001",
                name: "Polyethylene Bag",
                category: "Packing Material",
                type: "Packing",
                uom: "PCS",
                colour: "Transparent",
                minStock: 0,
                openingStock: 0,
                status: "Active",
                remarks: "Packing consumption"
            },

            {
                id: "PM-002",
                code: "PM-002",
                name: "Shipper Box",
                category: "Packing Material",
                type: "Carton",
                uom: "PCS",
                colour: "Brown",
                minStock: 0,
                openingStock: 0,
                status: "Active",
                remarks: "Finished goods dispatch packing"
            },

            {
                id: "PM-003",
                code: "PM-003",
                name: "Packing Cover",
                category: "Packing Material",
                type: "Cover",
                uom: "PCS",
                colour: "As per specification",
                minStock: 0,
                openingStock: 0,
                status: "Active",
                remarks: "Packing material - specification to confirm"
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

                this.materials = Array.isArray(parsed)
                    ? parsed
                    : this.createDefaultMaterials();

            } else {

                this.materials = this.createDefaultMaterials();

                this.save();
            }

        } catch (error) {

            console.error("Material loading error:", error);

            this.materials = this.createDefaultMaterials();
        }

        this.render();

        console.log(
            "Material Master initialized:",
            this.materials.length,
            "materials"
        );
    },

    /* ----------------------------------
       3. SAVE MATERIALS
    ---------------------------------- */

    save() {

        try {

            localStorage.setItem(
                this.storageKey,
                JSON.stringify(this.materials)
            );

            return true;

        } catch (error) {

            console.error("Material save failed:", error);

            this.notify(
                "Unable to save material data.",
                "error"
            );

            return false;
        }
    },

    /* ----------------------------------
       4. GET ALL MATERIALS
    ---------------------------------- */

    getAll() {

        return [...this.materials];
    },

    /* ----------------------------------
       5. GET MATERIAL BY CODE
    ---------------------------------- */

    getByCode(code) {

        return this.materials.find(
            material =>
                material.code.toLowerCase() ===
                String(code).toLowerCase()
        ) || null;
    },

    /* ----------------------------------
       6. FILTER BY CATEGORY
    ---------------------------------- */

    getByCategory(category) {

        return this.materials.filter(
            material =>
                material.category === category
        );
    },

    /* ----------------------------------
       7. ADD NEW MATERIAL
    ---------------------------------- */

    add(data) {

        if (!data || typeof data !== "object") {
            return this.fail("Invalid material details.");
        }

        const code = String(data.code || "").trim();
        const name = String(data.name || "").trim();

        if (!code || !name) {
            return this.fail(
                "Material code and name are required."
            );
        }

        if (this.getByCode(code)) {
            return this.fail(
                "Material code already exists."
            );
        }

        const categories = [
            "Raw Material",
            "Semi Finished Goods",
            "Finished Goods",
            "Packing Material"
        ];

        if (!categories.includes(data.category)) {
            return this.fail("Invalid material category.");
        }

        const material = {

            id: this.generateId(),

            code,
            name,

            category: data.category,

            type: String(data.type || "").trim(),

            uom: String(data.uom || "PCS").trim(),

            colour: String(data.colour || "").trim(),

            minStock: this.validQuantity(data.minStock),

            openingStock: this.validQuantity(data.openingStock),

            status: "Active",

            remarks: String(data.remarks || "").trim()
        };

        this.materials.push(material);

        if (!this.save()) {
            this.materials.pop();
            return false;
        }

        this.render();

        this.notify("Material added successfully.");

        return material;
    },

    /* ----------------------------------
       8. UPDATE MATERIAL
    ---------------------------------- */

    update(code, changes) {

        const index = this.materials.findIndex(
            material => material.code === code
        );

        if (index === -1) {
            return this.fail("Material not found.");
        }

        const oldMaterial = {
            ...this.materials[index]
        };

        const allowedFields = [
            "name",
            "type",
            "uom",
            "colour",
            "minStock",
            "remarks"
        ];

        allowedFields.forEach(field => {

            if (changes[field] !== undefined) {

                if (field === "minStock") {

                    this.materials[index][field] =
                        this.validQuantity(changes[field]);

                } else {

                    this.materials[index][field] =
                        String(changes[field]).trim();
                }
            }
        });

        if (!this.save()) {

            this.materials[index] = oldMaterial;

            return false;
        }

        this.render();

        this.notify("Material updated successfully.");

        return this.materials[index];
    },

    /* ----------------------------------
       9. CHANGE MATERIAL STATUS
    ---------------------------------- */

    changeStatus(code, status) {

        if (!["Active", "Inactive"].includes(status)) {
            return this.fail("Invalid material status.");
        }

        const material = this.getByCode(code);

        if (!material) {
            return this.fail("Material not found.");
        }

        const oldStatus = material.status;

        material.status = status;

        if (!this.save()) {

            material.status = oldStatus;

            return false;
        }

        this.render();

        this.notify("Material status updated.");

        return true;
    },

    /* ----------------------------------
       10. MATERIAL SUMMARY
    ---------------------------------- */

    getSummary() {

        const categories = [
            "Raw Material",
            "Semi Finished Goods",
            "Finished Goods",
            "Packing Material"
        ];

        const summary = {
            total: this.materials.length,
            active: 0,
            inactive: 0
        };

        categories.forEach(category => {

            summary[category] =
                this.getByCategory(category).length;
        });

        summary.active = this.materials.filter(
            m => m.status === "Active"
        ).length;

        summary.inactive = this.materials.filter(
            m => m.status === "Inactive"
        ).length;

        return summary;
    },

    /* ----------------------------------
       11. SEARCH MATERIALS
    ---------------------------------- */

    search(query) {

        const searchText = String(query || "")
            .toLowerCase()
            .trim();

        return this.materials.filter(material =>

            material.code.toLowerCase().includes(searchText) ||

            material.name.toLowerCase().includes(searchText) ||

            material.category.toLowerCase().includes(searchText) ||

            material.type.toLowerCase().includes(searchText) ||

            material.colour.toLowerCase().includes(searchText)

        );
    },

    /* ----------------------------------
       12. RENDER MATERIAL TABLE
    ---------------------------------- */

    render(category = "All") {

        const container = document.getElementById(
            "material-table-container"
        );

        if (!container) return;

        const filtered = category === "All"
            ? this.materials
            : this.getByCategory(category);

        if (filtered.length === 0) {

            container.innerHTML = `
                <p class="text-muted">
                    No materials found.
                </p>
            `;

            return;
        }

        container.innerHTML = `
            <div class="table-container">

                <table>

                    <thead>
                        <tr>
                            <th>Material Code</th>
                            <th>Material Name</th>
                            <th>Category</th>
                            <th>Type</th>
                            <th>UOM</th>
                            <th>Colour</th>
                            <th>Minimum Stock</th>
                            <th>Status</th>
                        </tr>
                    </thead>

                    <tbody>

                        ${filtered.map(material => `

                            <tr>

                                <td>
                                    ${this.escape(material.code)}
                                </td>

                                <td>
                                    ${this.escape(material.name)}
                                </td>

                                <td>
                                    ${this.escape(material.category)}
                                </td>

                                <td>
                                    ${this.escape(material.type)}
                                </td>

                                <td>
                                    ${this.escape(material.uom)}
                                </td>

                                <td>
                                    ${this.escape(material.colour)}
                                </td>

                                <td>
                                    ${material.minStock}
                                </td>

                                <td>
                                    <span class="status ${
                                        material.status === "Active"
                                            ? "status-active"
                                            : "status-inactive"
                                    }">
                                        ${this.escape(material.status)}
                                    </span>
                                </td>

                            </tr>

                        `).join("")}

                    </tbody>

                </table>

            </div>
        `;
    },

    /* ----------------------------------
       13. VALIDATION HELPERS
    ---------------------------------- */

    validQuantity(value) {

        const quantity = Number(value || 0);

        if (!Number.isFinite(quantity) || quantity < 0) {
            throw new Error("Invalid material quantity.");
        }

        return quantity;
    },

    generateId() {

        return "MAT-" +
            Date.now().toString(36).toUpperCase() +
            "-" +
            Math.random().toString(36).slice(2, 6).toUpperCase();
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
   14. GLOBAL ACCESS
------------------------------------------ */

window.CapManMaterials = MaterialMaster;
           
