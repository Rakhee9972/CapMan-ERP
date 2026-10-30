
/* ==========================================
   CAPMAN ERP - QUALITY MANAGEMENT
   QMS Module
   Version: 1.0
========================================== */

"use strict";

const QualityModule = {

    inspectionStorage: "capman_quality_inspections",
    capaStorage: "capman_quality_capa",

    inspections: [],
    capaRecords: [],

    inspectionTypes: [
        "Incoming QC",
        "In-Process QC",
        "Final QC"
    ],

    dispositions: [
        "Accepted",
        "Rejected",
        "Hold"
    ],

    defectTypes: [
        "Dimension Defect",
        "Colour Variation",
        "Flash",
        "Short Moulding",
        "Crack",
        "Wadding Defect",
        "Surface Defect",
        "Contamination",
        "Other"
    ],

    /* ----------------------------------
       1. INITIALIZE
    ---------------------------------- */

    initialize() {

        this.inspections = this.load(
            this.inspectionStorage
        );

        this.capaRecords = this.load(
            this.capaStorage
        );

        this.render();

        console.log("Quality Management initialized.");
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

    saveInspections() {

        return this.save(
            this.inspectionStorage,
            this.inspections
        );
    },

    saveCAPA() {

        return this.save(
            this.capaStorage,
            this.capaRecords
        );
    },

    save(key, data) {

        try {

            localStorage.setItem(
                key,
                JSON.stringify(data)
            );

            return true;

        } catch (error) {

            console.error("Quality save error:", error);

            return false;
        }
    },

    /* ----------------------------------
       2. CREATE INSPECTION
    ---------------------------------- */

    createInspection(data) {

        if (!data || !data.type || !data.itemCode) {
            return this.fail(
                "Inspection type and item code are required."
            );
        }

        if (!this.inspectionTypes.includes(data.type)) {
            return this.fail("Invalid inspection type.");
        }

        const inspected = Number(data.inspectedQty);
        const accepted = Number(data.acceptedQty || 0);
        const rejected = Number(data.rejectedQty || 0);
        const hold = Number(data.holdQty || 0);

        if (
            !Number.isFinite(inspected) ||
            !Number.isFinite(accepted) ||
            !Number.isFinite(rejected) ||
            !Number.isFinite(hold) ||
            inspected <= 0 ||
            accepted < 0 ||
            rejected < 0 ||
            hold < 0
        ) {
            return this.fail("Invalid inspection quantities.");
        }

        if (accepted + rejected + hold !== inspected) {
            return this.fail(
                "Accepted + Rejected + Hold must equal Inspected Qty."
            );
        }

        if (!data.date) {
            return this.fail("Inspection date is required.");
        }

        const record = {

            id: this.generateId("QC"),

            inspectionNumber: "QC-" + Date.now(),

            type: data.type,

            date: data.date,

            itemCode: String(data.itemCode).trim(),

            itemName: String(data.itemName || "").trim(),

            batchNo: String(data.batchNo || "").trim(),

            reference: String(data.reference || "").trim(),

            supplierCode: String(data.supplierCode || "").trim(),

            workOrder: String(data.workOrder || "").trim(),

            machineId: String(data.machineId || "").trim(),

            inspectedQty: inspected,

            acceptedQty: accepted,

            rejectedQty: rejected,

            holdQty: hold,

            rejectionRate: Number(
                (rejected / inspected * 100).toFixed(2)
            ),

            defectType: String(data.defectType || "").trim(),

            disposition: this.getDisposition(
                accepted,
                rejected,
                hold
            ),

            inspector: String(data.inspector || "").trim(),

            remarks: String(data.remarks || "").trim(),

            createdAt: new Date().toISOString()

        };

        this.inspections.push(record);

        if (!this.saveInspections()) {

            this.inspections.pop();

            return this.fail("Inspection could not be saved.");
        }

        this.render();

        this.notify("Quality inspection recorded.");

        return record;
    },

    /* ----------------------------------
       3. DETERMINE DISPOSITION
    ---------------------------------- */

    getDisposition(accepted, rejected, hold) {

        if (hold > 0) return "Hold";

        if (rejected > 0 && accepted > 0) {
            return "Partially Accepted";
        }

        if (rejected > 0) return "Rejected";

        return "Accepted";
    },

    /* ----------------------------------
       4. GET INSPECTIONS
    ---------------------------------- */

    getAll() {

        return [...this.inspections];
    },

    getByType(type) {

        return this.inspections.filter(
            item => item.type === type
        );
    },

    getByItem(itemCode) {

        return this.inspections.filter(
            item => item.itemCode === itemCode
        );
    },

    getByBatch(batchNo) {

        return this.inspections.filter(
            item => item.batchNo === batchNo
        );
    },

    /* ----------------------------------
       5. FILTER INSPECTIONS
    ---------------------------------- */

    filter(filters = {}) {

        return this.inspections.filter(record => {

            if (
                filters.type &&
                record.type !== filters.type
            ) return false;

            if (
                filters.date &&
                record.date !== filters.date
            ) return false;

            if (
                filters.itemCode &&
                record.itemCode !== filters.itemCode
            ) return false;

            if (
                filters.machineId &&
                record.machineId !== filters.machineId
            ) return false;

            if (
                filters.supplierCode &&
                record.supplierCode !== filters.supplierCode
            ) return false;

            if (
                filters.disposition &&
                record.disposition !== filters.disposition
            ) return false;

            return true;
        });
    },

    /* ----------------------------------
       6. INSPECTION SUMMARY
    ---------------------------------- */

    getSummary(filters = {}) {

        const records = this.filter(filters);

        const summary = {

            totalInspections: records.length,

            inspected: 0,

            accepted: 0,

            rejected: 0,

            hold: 0,

            rejectionRate: 0,

            acceptanceRate: 0

        };

        records.forEach(record => {

            summary.inspected += record.inspectedQty;

            summary.accepted += record.acceptedQty;

            summary.rejected += record.rejectedQty;

            summary.hold += record.holdQty;

        });

        if (summary.inspected > 0) {

            summary.rejectionRate = Number(
                (summary.rejected /
                    summary.inspected * 100).toFixed(2)
            );

            summary.acceptanceRate = Number(
                (summary.accepted /
                    summary.inspected * 100).toFixed(2)
            );
        }

        return summary;
    },

    /* ----------------------------------
       7. DEFECT ANALYSIS
    ---------------------------------- */

    getDefectAnalysis(filters = {}) {

        const records = this.filter(filters);

        const analysis = {};

        records.forEach(record => {

            const defect =
                record.defectType || "Not Specified";

            analysis[defect] =
                (analysis[defect] || 0) +
                record.rejectedQty;

        });

        return analysis;
    },

    /* ----------------------------------
       8. SUPPLIER QUALITY REPORT
    ---------------------------------- */

    getSupplierQuality(supplierCode) {

        const records = this.inspections.filter(
            item =>
                item.supplierCode === supplierCode &&
                item.type === "Incoming QC"
        );

        const summary = {
            supplierCode,
            inspections: records.length,
            inspectedQty: 0,
            acceptedQty: 0,
            rejectedQty: 0,
            rejectionRate: 0
        };

        records.forEach(record => {

            summary.inspectedQty += record.inspectedQty;

            summary.acceptedQty += record.acceptedQty;

            summary.rejectedQty += record.rejectedQty;

        });

        summary.rejectionRate =
            summary.inspectedQty > 0
                ? Number(
                    (summary.rejectedQty /
                        summary.inspectedQty * 100).toFixed(2)
                )
                : 0;

        return summary;
    },

    /* ----------------------------------
       9. RE-INSPECTION
    ---------------------------------- */

    createReinspection(originalId, data) {

        const original = this.inspections.find(
            item => item.id === originalId
        );

        if (!original) {
            return this.fail("Original inspection not found.");
        }

        if (original.holdQty <= 0) {
            return this.fail(
                "No hold quantity available for re-inspection."
            );
        }

        const inspected = Number(data.inspectedQty);
        const accepted = Number(data.acceptedQty || 0);
        const rejected = Number(data.rejectedQty || 0);
        const hold = Number(data.holdQty || 0);

        if (
            !Number.isFinite(inspected) ||
            inspected <= 0 ||
            accepted < 0 ||
            rejected < 0 ||
            hold < 0 ||
            accepted + rejected + hold !== inspected ||
            inspected > original.holdQty
        ) {
            return this.fail(
                "Re-inspection quantities are invalid."
            );
        }

        const record = {

            id: this.generateId("QC"),

            inspectionNumber: "QC-" + Date.now(),

            type: original.type,

            originalInspectionId: original.id,

            date: data.date || new Date().toISOString().slice(0, 10),

            itemCode: original.itemCode,

            itemName: original.itemName,

            batchNo: original.batchNo,

            reference: original.reference,

            supplierCode: original.supplierCode,

            workOrder: original.workOrder,

            machineId: original.machineId,

            inspectedQty: inspected,

            acceptedQty: accepted,

            rejectedQty: rejected,

            holdQty: hold,

            rejectionRate: Number(
                (rejected / inspected * 100).toFixed(2)
            ),

            defectType: String(data.defectType || ""),

            disposition: this.getDisposition(
                accepted,
                rejected,
                hold
            ),

            inspector: String(data.inspector || ""),

            remarks: "Re-inspection: " +
                String(data.remarks || ""),

            createdAt: new Date().toISOString()

        };

        const oldHold = original.holdQty;

        original.holdQty -= inspected;

        this.inspections.push(record);

        if (!this.saveInspections()) {

            original.holdQty = oldHold;

            this.inspections.pop();

            return this.fail("Re-inspection save failed.");
        }

        this.render();

        return record;
    },

    /* ----------------------------------
       10. CREATE CAPA
    ---------------------------------- */

    createCAPA(data) {

        if (!data || !data.problem) {
            return this.fail(
                "Problem description is required."
            );
        }

        if (!data.rootCause) {
            return this.fail(
                "Root cause analysis is required."
            );
        }

        if (!data.correctiveAction) {
            return this.fail(
                "Corrective action is required."
            );
        }

        const record = {

            id: this.generateId("CAPA"),

            capaNumber: "CAPA-" + Date.now(),

            reference: String(data.reference || ""),

            problem: String(data.problem),

            rootCause: String(data.rootCause),

            correctiveAction: String(data.correctiveAction),

            preventiveAction: String(data.preventiveAction || ""),

            responsiblePerson: String(
                data.responsiblePerson || ""
            ),

            targetDate: data.targetDate || "",

            status: "Open",

            verificationRemarks: "",

            createdAt: new Date().toISOString()

        };

        this.capaRecords.push(record);

        if (!this.saveCAPA()) {

            this.capaRecords.pop();

            return this.fail("CAPA could not be saved.");
        }

        this.render();

        this.notify("CAPA created successfully.");

        return record;
    },

    /* ----------------------------------
       11. UPDATE CAPA STATUS
    ---------------------------------- */

    updateCAPA(capaNumber, status, remarks = "") {

        const allowed = [
            "Open",
            "In Progress",
            "Pending Verification",
            "Closed"
        ];

        if (!allowed.includes(status)) {
            return this.fail("Invalid CAPA status.");
        }

        const record = this.capaRecords.find(
            item => item.capaNumber === capaNumber
        );

        if (!record) {
            return this.fail("CAPA record not found.");
        }

        if (
            status === "Closed" &&
            record.status !== "Pending Verification"
        ) {
            return this.fail(
                "CAPA must be verified before closure."
            );
        }

        const oldRecord = { ...record };

        record.status = status;

        if (remarks) {
            record.verificationRemarks = String(remarks);
        }

        if (status === "Closed") {
            record.closedAt = new Date().toISOString();
        }

        if (!this.saveCAPA()) {

            Object.assign(record, oldRecord);

            return this.fail("CAPA update failed.");
        }

        this.render();

        return true;
    },

    /* ----------------------------------
       12. CAPA REPORT
    ---------------------------------- */

    getCAPASummary() {

        return {

            total: this.capaRecords.length,

            open: this.capaRecords.filter(
                item => item.status === "Open"
            ).length,

            inProgress: this.capaRecords.filter(
                item => item.status === "In Progress"
            ).length,

            pendingVerification: this.capaRecords.filter(
                item => item.status === "Pending Verification"
            ).length,

            closed: this.capaRecords.filter(
                item => item.status === "Closed"
            ).length

        };
    },

    /* ----------------------------------
       13. RENDER INSPECTION TABLE
    ---------------------------------- */

    render() {

        const container = document.getElementById(
            "quality-table-container"
        );

        if (!container) return;

        if (this.inspections.length === 0) {

            container.innerHTML = `
                <p class="text-muted">
                    No quality inspections available.
                </p>
            `;

            return;
        }

        const records = [...this.inspections].reverse();

        container.innerHTML = `
            <div class="table-container">

                <table>

                    <thead>
                        <tr>
                            <th>QC Number</th>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Item</th>
                            <th>Batch</th>
                            <th>Inspected</th>
                            <th>Accepted</th>
                            <th>Rejected</th>
                            <th>Hold</th>
                            <th>Rejection %</th>
                            <th>Disposition</th>
                        </tr>
                    </thead>

                    <tbody>

                        ${records.map(record => `

                            <tr>
                                <td>${this.escape(record.inspectionNumber)}</td>
                                <td>${this.escape(record.date)}</td>
                                <td>${this.escape(record.type)}</td>
                                <td>${this.escape(record.itemCode)}</td>
                                <td>${this.escape(record.batchNo)}</td>
                                <td>${this.number(record.inspectedQty)}</td>
                                <td>${this.number(record.acceptedQty)}</td>
                                <td class="text-danger">
                                    ${this.number(record.rejectedQty)}
                                </td>
                                <td>${this.number(record.holdQty)}</td>
                                <td>${record.rejectionRate}%</td>
                                <td>${this.escape(record.disposition)}</td>
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

window.CapManQuality = QualityModule;
      
