/* =========================================================
   CAPMAN ERP - VALIDATION MODULE
   File: validation.js
   Part 1 of 2

   Includes:
   1. Validation Framework
   2. Helper Functions
   3. Machine Master Validation
   4. Material Master Validation
   5. BOM Validation
   6. Inventory Validation

   Part 2 will continue inside the same file.
========================================================= */

(function () {
    "use strict";

    const STORAGE_KEY = "capman_validation_results";

    const Validation = {

        results: [],

        /* -----------------------------------------
           COMMON HELPERS
        ----------------------------------------- */

        getModule(name) {
            return window[name] || null;
        },

        getArray(value) {
            return Array.isArray(value) ? value : [];
        },

        getStoredArray(key) {
            try {
                const data = JSON.parse(localStorage.getItem(key) || "[]");
                return Array.isArray(data) ? data : [];
            } catch (error) {
                return [];
            }
        },

        getValue(object, keys, fallback = null) {
            if (!object) return fallback;

            for (const key of keys) {
                if (
                    object[key] !== undefined &&
                    object[key] !== null
                ) {
                    return object[key];
                }
            }

            return fallback;
        },

        toNumber(value) {
            const number = Number(value);
            return Number.isFinite(number) ? number : 0;
        },

        addResult(category, severity, message, reference = "") {
            this.results.push({
                id: "VAL-" + Date.now() + "-" +
                    Math.floor(Math.random() * 10000),
                category,
                severity,
                message,
                reference,
                createdAt: new Date().toISOString()
            });
        },

        saveResults() {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(this.results)
            );
        },

        clearResults() {
            this.results = [];
            this.saveResults();
        },

        getResults() {
            return [...this.results];
        },

        getSummary() {
            return {
                total: this.results.length,
                errors: this.results.filter(
                    item => item.severity === "ERROR"
                ).length,
                warnings: this.results.filter(
                    item => item.severity === "WARNING"
                ).length,
                information: this.results.filter(
                    item => item.severity === "INFO"
                ).length
            };
        },

        /* -----------------------------------------
           1. MACHINE MASTER VALIDATION
        ----------------------------------------- */

        validateMachines() {
            const module = this.getModule("CapManMachines");

            const machines = module &&
                typeof module.getAll === "function"
                ? this.getArray(module.getAll())
                : this.getStoredArray("capman_machine_master");

            const seenCodes = new Set();

            machines.forEach(machine => {
                const code = this.getValue(
                    machine,
                    ["machineCode", "code", "id"],
                    ""
                );

                if (!code) {
                    this.addResult(
                        "MACHINE",
                        "ERROR",
                        "Machine code is missing."
                    );
                    return;
                }

                if (seenCodes.has(code)) {
                    this.addResult(
                        "MACHINE",
                        "ERROR",
                        "Duplicate machine code found.",
                        code
                    );
                }

                seenCodes.add(code);

                const capacity = this.toNumber(
                    this.getValue(
                        machine,
                        ["capacity", "hourlyCapacity"],
                        0
                    )
                );

                if (capacity < 0) {
                    this.addResult(
                        "MACHINE",
                        "ERROR",
                        "Machine capacity cannot be negative.",
                        code
                    );
                }

                if (capacity === 0) {
                    this.addResult(
                        "MACHINE",
                        "WARNING",
                        "Machine capacity is not configured.",
                        code
                    );
                }

                const status = String(
                    this.getValue(machine, ["status"], "")
                ).toUpperCase();

                if (
                    status &&
                    ![
                        "ACTIVE",
                        "INACTIVE",
                        "BREAKDOWN",
                        "MAINTENANCE"
                    ].includes(status)
                ) {
                    this.addResult(
                        "MACHINE",
                        "WARNING",
                        "Machine has an unrecognized status.",
                        code
                    );
                }
            });

            if (machines.length === 0) {
                this.addResult(
                    "MACHINE",
                    "WARNING",
                    "No machine master records found."
                );
            }
        },

        /* -----------------------------------------
           2. MATERIAL MASTER VALIDATION
        ----------------------------------------- */

        validateMaterials() {
            const module = this.getModule("CapManMaterials");

            const materials = module &&
                typeof module.getAll === "function"
                ? this.getArray(module.getAll())
                : this.getStoredArray("capman_material_master");

            const seenCodes = new Set();

            materials.forEach(material => {
                const code = this.getValue(
                    material,
                    ["materialCode", "code", "id"],
                    ""
                );

                const name = this.getValue(
                    material,
                    ["materialName", "name", "description"],
                    ""
                );

                if (!code) {
                    this.addResult(
                        "MATERIAL",
                        "ERROR",
                        "Material code is missing."
                    );
                    return;
                }

                if (!name) {
                    this.addResult(
                        "MATERIAL",
                        "ERROR",
                        "Material name is missing.",
                        code
                    );
                }

                if (seenCodes.has(code)) {
                    this.addResult(
                        "MATERIAL",
                        "ERROR",
                        "Duplicate material code found.",
                        code
                    );
                }

                seenCodes.add(code);

                const uom = this.getValue(
                    material,
                    ["uom", "unit", "unitOfMeasure"],
                    ""
                );

                if (!uom) {
                    this.addResult(
                        "MATERIAL",
                        "WARNING",
                        "Unit of measurement is missing.",
                        code
                    );
                }

                const status = String(
                    this.getValue(material, ["status"], "")
                ).toUpperCase();

                if (
                    status &&
                    !["ACTIVE", "INACTIVE"].includes(status)
                ) {
                    this.addResult(
                        "MATERIAL",
                        "WARNING",
                        "Material status is not recognized.",
                        code
                    );
                }
            });

            if (materials.length === 0) {
                this.addResult(
                    "MATERIAL",
                    "WARNING",
                    "No material master records found."
                );
            }
        },

        /* -----------------------------------------
           3. BOM VALIDATION
        ----------------------------------------- */

        validateBOM() {
            const module = this.getModule("CapManBOM");

            const boms = module &&
                typeof module.getAll === "function"
                ? this.getArray(module.getAll())
                : this.getStoredArray("capman_bom_master");

            const seenCodes = new Set();

            boms.forEach(bom => {
                const code = this.getValue(
                    bom,
                    ["bomCode", "code", "id"],
                    ""
                );

                const product = this.getValue(
                    bom,
                    ["productCode", "outputMaterialCode", "product"],
                    ""
                );

                if (!code) {
                    this.addResult(
                        "BOM",
                        "ERROR",
                        "BOM code is missing."
                    );
                    return;
                }

                if (seenCodes.has(code)) {
                    this.addResult(
                        "BOM",
                        "ERROR",
                        "Duplicate BOM code found.",
                        code
                    );
                }

                seenCodes.add(code);

                if (!product) {
                    this.addResult(
                        "BOM",
                        "ERROR",
                        "BOM output product is missing.",
                        code
                    );
                }

                const status = String(
                    this.getValue(bom, ["status"], "")
                ).toUpperCase();

                const components = this.getValue(
                    bom,
                    ["components", "items", "lines"],
                    []
                );

                if (!Array.isArray(components) ||
                    components.length === 0) {
                    this.addResult(
                        "BOM",
                        "ERROR",
                        "BOM has no component lines.",
                        code
                    );
                    return;
                }

                components.forEach(component => {
                    const quantity = this.toNumber(
                        this.getValue(
                            component,
                            ["quantity", "qty", "requiredQty"],
                            0
                        )
                    );

                    if (quantity < 0) {
                        this.addResult(
                            "BOM",
                            "ERROR",
                            "BOM component quantity cannot be negative.",
                            code
                        );
                    }

                    if (quantity === 0) {
                        this.addResult(
                            "BOM",
                            "WARNING",
                            "BOM component quantity is not configured.",
                            code
                        );
                    }
                });

                if (
                    status === "APPROVED" &&
                    (!components || components.length === 0)
                ) {
                    this.addResult(
                        "BOM",
                        "ERROR",
                        "Approved BOM must contain components.",
                        code
                    );
                }

                if (status !== "APPROVED") {
                    this.addResult(
                        "BOM",
                        "WARNING",
                        "BOM is not approved for production planning.",
                        code
                    );
                }
            });

            if (boms.length === 0) {
                this.addResult(
                    "BOM",
                    "WARNING",
                    "No BOM records found."
                );
            }
        },

        /* -----------------------------------------
           4. INVENTORY VALIDATION
        ----------------------------------------- */

        validateInventory() {
            const module = this.getModule("CapManInventory");

            let stock = [];

            if (
                module &&
                typeof module.getAllStock === "function"
            ) {
                stock = this.getArray(module.getAllStock());
            } else if (
                module &&
                typeof module.getStock === "function"
            ) {
                stock = this.getArray(module.getStock());
            } else {
                stock = this.getStoredArray(
                    "capman_inventory_stock"
                );
            }

            stock.forEach(item => {
                const materialCode = this.getValue(
                    item,
                    ["materialCode", "code", "itemCode"],
                    "UNKNOWN"
                );

                const quantity = this.toNumber(
                    this.getValue(
                        item,
                        ["quantity", "balance", "availableQty"],
                        0
                    )
                );

                if (quantity < 0) {
                    this.addResult(
                        "INVENTORY",
                        "ERROR",
                        "Negative stock balance detected.",
                        materialCode
                    );
                }

                if (quantity === 0) {
                    this.addResult(
                        "INVENTORY",
                        "INFO",
                        "Stock balance is zero.",
                        materialCode
                    );
                }

                const batchNumber = this.getValue(
                    item,
                    ["batchNumber", "batchNo", "batch"],
                    ""
                );

                if (!batchNumber) {
                    this.addResult(
                        "INVENTORY",
                        "WARNING",
                        "Batch number is missing.",
                        materialCode
                    );
                }
            });

            const ledger = this.getStoredArray(
                "capman_inventory_ledger"
            );

            const transactionIds = new Set();

            ledger.forEach(transaction => {
                const transactionId = this.getValue(
                    transaction,
                    ["transactionId", "id", "reference"],
                    ""
                );

                if (!transactionId) {
                    this.addResult(
                        "INVENTORY",
                        "WARNING",
                        "Inventory transaction reference is missing."
                    );
                    return;
                }

                if (transactionIds.has(transactionId)) {
                    this.addResult(
                        "INVENTORY",
                        "ERROR",
                        "Duplicate inventory transaction reference found.",
                        transactionId
                    );
                }

                transactionIds.add(transactionId);
            });

            if (stock.length === 0) {
                this.addResult(
                    "INVENTORY",
                    "INFO",
                    "No inventory stock records available for validation."
                );
            }
        },

                /* -----------------------------------------
           5. PRODUCTION VALIDATION
        ----------------------------------------- */

        validateProduction() {
            const module = this.getModule("CapManProduction");

            const entries = module &&
                Array.isArray(module.entries)
                ? module.entries
                : this.getStoredArray("capman_production_entries");

            entries.forEach(entry => {
                const reference = this.getValue(
                    entry,
                    ["id", "entryId", "workOrderNo"],
                    "UNKNOWN"
                );

                const target = this.toNumber(
                    this.getValue(entry, ["target", "targetQty"], 0)
                );

                const actual = this.toNumber(
                    this.getValue(entry, ["actual", "actualQty"], 0)
                );

                const rejection = this.toNumber(
                    this.getValue(entry, ["rejection", "rejectedQty"], 0)
                );

                const good = this.toNumber(
                    this.getValue(entry, ["good", "goodQty"], actual - rejection)
                );

                if (target < 0 || actual < 0 || rejection < 0 || good < 0) {
                    this.addResult(
                        "PRODUCTION",
                        "ERROR",
                        "Production quantities cannot be negative.",
                        reference
                    );
                }

                if (rejection > actual) {
                    this.addResult(
                        "PRODUCTION",
                        "ERROR",
                        "Rejection quantity is greater than actual production.",
                        reference
                    );
                }

                if (actual > 0 && good + rejection !== actual) {
                    this.addResult(
                        "PRODUCTION",
                        "WARNING",
                        "Good quantity plus rejection does not match actual production.",
                        reference
                    );
                }

                if (target === 0) {
                    this.addResult(
                        "PRODUCTION",
                        "WARNING",
                        "Production target is not configured.",
                        reference
                    );
                }

                if (!this.getValue(entry, ["machineCode", "machine"], "")) {
                    this.addResult(
                        "PRODUCTION",
                        "WARNING",
                        "Machine reference is missing.",
                        reference
                    );
                }
            });
        },

        /* -----------------------------------------
           6. QUALITY VALIDATION
        ----------------------------------------- */

        validateQuality() {
            const module = this.getModule("CapManQuality");

            const inspections = module &&
                Array.isArray(module.inspections)
                ? module.inspections
                : this.getStoredArray("capman_quality_inspections");

            inspections.forEach(item => {
                const reference = this.getValue(
                    item,
                    ["id", "inspectionId"],
                    "UNKNOWN"
                );

                const inspected = this.toNumber(
                    this.getValue(item, ["inspected", "inspectedQty"], 0)
                );

                const accepted = this.toNumber(
                    this.getValue(item, ["accepted", "acceptedQty"], 0)
                );

                const rejected = this.toNumber(
                    this.getValue(item, ["rejected", "rejectedQty"], 0)
                );

                const hold = this.toNumber(
                    this.getValue(item, ["hold", "holdQty"], 0)
                );

                if ([inspected, accepted, rejected, hold].some(qty => qty < 0)) {
                    this.addResult(
                        "QUALITY",
                        "ERROR",
                        "Inspection quantities cannot be negative.",
                        reference
                    );
                }

                if (accepted + rejected + hold > inspected) {
                    this.addResult(
                        "QUALITY",
                        "ERROR",
                        "Accepted, rejected and hold quantities exceed inspected quantity.",
                        reference
                    );
                }

                if (accepted + rejected + hold < inspected) {
                    this.addResult(
                        "QUALITY",
                        "WARNING",
                        "Inspection quantity is not fully dispositioned.",
                        reference
                    );
                }
            });
        },

        /* -----------------------------------------
           7. GRN VALIDATION
        ----------------------------------------- */

        validateGRN() {
            const grns = this.getStoredArray("capman_grn_records");
            const seen = new Set();

            grns.forEach(grn => {
                const reference = this.getValue(
                    grn,
                    ["grnNumber", "grnNo", "id"],
                    ""
                );

                if (!reference) {
                    this.addResult(
                        "GRN",
                        "ERROR",
                        "GRN reference is missing."
                    );
                    return;
                }

                if (seen.has(reference)) {
                    this.addResult(
                        "GRN",
                        "ERROR",
                        "Duplicate GRN reference found.",
                        reference
                    );
                }

                seen.add(reference);

                const received = this.toNumber(
                    this.getValue(grn, ["receivedQty", "quantity"], 0)
                );

                const accepted = this.toNumber(
                    this.getValue(grn, ["acceptedQty"], 0)
                );

                const rejected = this.toNumber(
                    this.getValue(grn, ["rejectedQty"], 0)
                );

                const hold = this.toNumber(
                    this.getValue(grn, ["holdQty"], 0)
                );

                if (accepted + rejected + hold > received) {
                    this.addResult(
                        "GRN",
                        "ERROR",
                        "GRN QC quantities exceed received quantity.",
                        reference
                    );
                }
            });
        },

        /* -----------------------------------------
           8. PACKING VALIDATION
        ----------------------------------------- */

        validatePacking() {
            const orders = this.getStoredArray("capman_packing_orders");
            const records = this.getStoredArray("capman_packing_records");

            orders.forEach(order => {
                const reference = this.getValue(
                    order,
                    ["packingOrderNo", "orderNo", "id"],
                    "UNKNOWN"
                );

                const target = this.toNumber(
                    this.getValue(order, ["targetQuantity", "quantity"], 0)
                );

                const packed = this.toNumber(
                    this.getValue(order, ["packedQuantity", "packedQty"], 0)
                );

                const rejected = this.toNumber(
                    this.getValue(order, ["rejectedQuantity", "rejectedQty"], 0)
                );

                if (target < 0 || packed < 0 || rejected < 0) {
                    this.addResult(
                        "PACKING",
                        "ERROR",
                        "Packing quantities cannot be negative.",
                        reference
                    );
                }

                if (packed + rejected > target) {
                    this.addResult(
                        "PACKING",
                        "ERROR",
                        "Packed and rejected quantities exceed packing target.",
                        reference
                    );
                }
            });

            records.forEach(record => {
                const good = this.toNumber(
                    this.getValue(record, ["packedQuantity", "packedQty", "goodQty"], 0)
                );

                const rejected = this.toNumber(
                    this.getValue(record, ["rejectedQuantity", "rejectedQty"], 0)
                );

                if (good < 0 || rejected < 0) {
                    this.addResult(
                        "PACKING",
                        "ERROR",
                        "Packing record contains negative quantities.",
                        this.getValue(record, ["id"], "UNKNOWN")
                    );
                }
            });
        },

        /* -----------------------------------------
           9. DISPATCH VALIDATION
        ----------------------------------------- */

        validateDispatch() {
            const dispatches = this.getStoredArray("capman_dispatch_records");
            const seen = new Set();

            dispatches.forEach(dispatch => {
                const reference = this.getValue(
                    dispatch,
                    ["dispatchNo", "dispatchNumber", "id"],
                    ""
                );

                if (!reference) {
                    this.addResult(
                        "DISPATCH",
                        "ERROR",
                        "Dispatch reference is missing."
                    );
                    return;
                }

                if (seen.has(reference)) {
                    this.addResult(
                        "DISPATCH",
                        "ERROR",
                        "Duplicate dispatch reference found.",
                        reference
                    );
                }

                seen.add(reference);

                const quantity = this.toNumber(
                    this.getValue(dispatch, ["quantity", "dispatchQty"], 0)
                );

                if (quantity <= 0) {
                    this.addResult(
                        "DISPATCH",
                        "ERROR",
                        "Dispatch quantity must be greater than zero.",
                        reference
                    );
                }

                const status = String(
                    this.getValue(dispatch, ["status"], "")
                ).toUpperCase();

                if (!status) {
                    this.addResult(
                        "DISPATCH",
                        "WARNING",
                        "Dispatch status is missing.",
                        reference
                    );
                }
            });
        },

        /* -----------------------------------------
           10. TRACEABILITY VALIDATION
        ----------------------------------------- */

        validateTraceability() {
            const records = this.getStoredArray(
                "capman_traceability_records"
            );

            records.forEach(record => {
                const batch = this.getValue(
                    record,
                    ["batchNumber", "batchNo", "id"],
                    ""
                );

                const quantity = this.toNumber(
                    this.getValue(record, ["quantity", "batchQty"], 0)
                );

                if (!batch) {
                    this.addResult(
                        "TRACEABILITY",
                        "ERROR",
                        "Batch number is missing."
                    );
                }

                if (quantity < 0) {
                    this.addResult(
                        "TRACEABILITY",
                        "ERROR",
                        "Batch quantity cannot be negative.",
                        batch || "UNKNOWN"
                    );
                }
            });
        },

        /* -----------------------------------------
           11. COSTING VALIDATION
        ----------------------------------------- */

        validateCosting() {
            const records = this.getStoredArray(
                "capman_costing_records"
            );

            records.forEach(record => {
                const reference = this.getValue(
                    record,
                    ["id", "batchNumber", "productCode"],
                    "UNKNOWN"
                );

                const totalCost = this.toNumber(
                    this.getValue(record, ["totalCost", "totalProductionCost"], 0)
                );

                const goodQuantity = this.toNumber(
                    this.getValue(record, ["goodQuantity", "goodQty"], 0)
                );

                if (totalCost < 0) {
                    this.addResult(
                        "COSTING",
                        "ERROR",
                        "Total production cost cannot be negative.",
                        reference
                    );
                }

                if (goodQuantity < 0) {
                    this.addResult(
                        "COSTING",
                        "ERROR",
                        "Good production quantity cannot be negative.",
                        reference
                    );
                }

                if (totalCost > 0 && goodQuantity === 0) {
                    this.addResult(
                        "COSTING",
                        "WARNING",
                        "Cost is recorded but good production quantity is zero.",
                        reference
                    );
                }
            });
        },

        /* -----------------------------------------
           RUN ALL VALIDATIONS
        ----------------------------------------- */

        runAll() {
            this.clearResults();

            const checks = [
                ["MACHINE", () => this.validateMachines()],
                ["MATERIAL", () => this.validateMaterials()],
                ["BOM", () => this.validateBOM()],
                ["INVENTORY", () => this.validateInventory()],
                ["PRODUCTION", () => this.validateProduction()],
                ["QUALITY", () => this.validateQuality()],
                ["GRN", () => this.validateGRN()],
                ["PACKING", () => this.validatePacking()],
                ["DISPATCH", () => this.validateDispatch()],
                ["TRACEABILITY", () => this.validateTraceability()],
                ["COSTING", () => this.validateCosting()]
            ];

            checks.forEach(([name, check]) => {
                try {
                    check();
                } catch (error) {
                    this.addResult(
                        name,
                        "ERROR",
                        "Validation could not complete: " + error.message
                    );
                }
            });

            this.saveResults();

            return {
                results: this.getResults(),
                summary: this.getSummary()
            };
        },

        /* -----------------------------------------
           EXPORT VALIDATION RESULTS
        ----------------------------------------- */

        exportCSV() {
            const results = this.getResults();

            if (!results.length) {
                return false;
            }

            const headers = [
                "Category",
                "Severity",
                "Message",
                "Reference",
                "Created At"
            ];

            const rows = results.map(item => [
                item.category,
                item.severity,
                item.message,
                item.reference,
                item.createdAt
            ]);

            const escapeCSV = value =>
                '"' + String(value ?? "").replace(/"/g, '""') + '"';

            const csv = [
                headers,
                ...rows
            ].map(row => row.map(escapeCSV).join(",")).join("\n");

            const blob = new Blob([csv], {
                type: "text/csv;charset=utf-8;"
            });

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = "CapMan_Validation_Report.csv";
            link.click();

            URL.revokeObjectURL(url);

            return true;
        }

    };

    window.CapManValidation = Validation;

})();
