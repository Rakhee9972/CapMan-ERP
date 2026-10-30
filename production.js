
/* ==========================================
   CAPMAN ERP - PRODUCTION MANAGEMENT
   Closure & Wadding Departments
   Version: 1.0
========================================== */

"use strict";

const ProductionModule = {

    storageKey: "capman_production_entries",

    entries: [],

    departments: ["Closure", "Wadding"],

    shifts: ["A", "B", "C"],

    products: [
        "Outer Cap",
        "Inner Cap",
        "Finished Cap"
    ],

    rejectionReasons: [
        "Short Moulding",
        "Flash",
        "Colour Variation",
        "Dimension Rejection",
        "Wadding Defect",
        "Machine Setting",
        "Material Defect",
        "Other"
    ],

    /* ----------------------------------
       1. INITIALIZE
    ---------------------------------- */

    initialize() {

        try {

            const saved = JSON.parse(
                localStorage.getItem(this.storageKey) || "[]"
            );

            this.entries = Array.isArray(saved) ? saved : [];

        } catch (error) {

            console.error("Production loading error:", error);

            this.entries = [];
        }

        this.render();

        console.log("Production module initialized.");
    },

    /* ----------------------------------
       2. SAVE DATA
    ---------------------------------- */

    save() {

        try {

            localStorage.setItem(
                this.storageKey,
                JSON.stringify(this.entries)
            );

            return true;

        } catch (error) {

            console.error("Production save failed:", error);

            return false;
        }
    },

    /* ----------------------------------
       3. GET MACHINES
    ---------------------------------- */

    getMachines(department) {

        const machines =
            window.CapManMachines?.getByDepartment(department) || [];

        return machines.filter(
            machine => machine.status === "Active"
        );
    },

    /* ----------------------------------
       4. VALIDATE ENTRY
    ---------------------------------- */

    validate(data) {

        if (!data || typeof data !== "object") {
            return "Invalid production details.";
        }

        if (!this.departments.includes(data.department)) {
            return "Select a valid department.";
        }

        const machine = window.CapManMachines?.getById(
            data.machineId
        );

        if (!machine) {
            return "Machine not found.";
        }

        if (machine.department !== data.department) {
            return "Machine does not belong to selected department.";
        }

        if (machine.status !== "Active") {
            return "Machine is not active.";
        }

        const validProducts = data.department === "Closure"
            ? ["Outer Cap", "Inner Cap"]
            : ["Finished Cap"];

        if (!validProducts.includes(data.product)) {
            return "Invalid product for selected department.";
        }

        if (!this.shifts.includes(data.shift)) {
            return "Select shift A, B or C.";
        }

        if (!data.date || !data.workOrder) {
            return "Production date and Work Order are required.";
        }

        const target = Number(data.target);
        const actual = Number(data.actual);
        const rejection = Number(data.rejection || 0);
        const downtime = Number(data.downtimeMinutes || 0);

        if (
            !Number.isFinite(target) ||
            !Number.isFinite(actual) ||
            !Number.isFinite(rejection) ||
            !Number.isFinite(downtime) ||
            target <= 0 ||
            actual <= 0 ||
            rejection < 0 ||
            downtime < 0
        ) {
            return "Enter valid production quantities.";
        }

        if (rejection > actual) {
            return "Rejection cannot exceed actual production.";
        }

        if (downtime > 1440) {
            return "Downtime cannot exceed 1440 minutes.";
        }

        if (actual > target * 2) {
            return "Actual output is unusually high. Verify the entry.";
        }

        return null;
    },

    /* ----------------------------------
       5. ADD PRODUCTION ENTRY
    ---------------------------------- */

    addEntry(data) {

        const error = this.validate(data);

        if (error) {
            return this.fail(error);
        }

        const duplicate = this.entries.some(entry =>

            entry.date === data.date &&
            entry.shift === data.shift &&
            entry.machineId === data.machineId &&
            entry.product === data.product &&
            entry.workOrder === data.workOrder

        );

        if (duplicate) {
            return this.fail(
                "Entry already exists for this machine, shift and work order."
            );
        }

        const actual = Number(data.actual);
        const rejection = Number(data.rejection || 0);

        const entry = {

            id: this.generateId("PROD"),

            date: data.date,

            department: data.department,

            machineId: data.machineId,

            workOrder: String(data.workOrder).trim(),

            product: data.product,

            shift: data.shift,

            target: Number(data.target),

            actual,

            rejection,

            goodQuantity: actual - rejection,

            achievement: Number(
                (actual / Number(data.target) * 100).toFixed(2)
            ),

            rejectionRate: Number(
                (rejection / actual * 100).toFixed(2)
            ),

            downtimeMinutes: Number(
                data.downtimeMinutes || 0
            ),

            rejectionReason: String(
                data.rejectionReason || ""
            ),

            operator: String(data.operator || ""),

            remarks: String(data.remarks || ""),

            createdAt: new Date().toISOString()

        };

        this.entries.push(entry);

        if (!this.save()) {

            this.entries.pop();

            return this.fail(
                "Production entry could not be saved."
            );
        }

        this.render();

        this.notify(
            "Production entry saved successfully."
        );

        return entry;
    },

    /* ----------------------------------
       6. GET ALL ENTRIES
    ---------------------------------- */

    getAll() {

        return [...this.entries];
    },

    /* ----------------------------------
       7. FILTER ENTRIES
    ---------------------------------- */

    filter(filters = {}) {

        return this.entries.filter(entry => {

            if (
                filters.department &&
                entry.department !== filters.department
            ) return false;

            if (
                filters.date &&
                entry.date !== filters.date
            ) return false;

            if (
                filters.shift &&
                entry.shift !== filters.shift
            ) return false;

            if (
                filters.machineId &&
                entry.machineId !== filters.machineId
            ) return false;

            if (
                filters.product &&
                entry.product !== filters.product
            ) return false;

            if (
                filters.workOrder &&
                entry.workOrder !== filters.workOrder
            ) return false;

            return true;
        });
    },

    /* ----------------------------------
       8. DAILY PRODUCTION SUMMARY
    ---------------------------------- */

    getSummary(filters = {}) {

        const records = this.filter(filters);

        const summary = {

            entries: records.length,

            target: 0,

            actual: 0,

            rejection: 0,

            goodQuantity: 0,

            downtimeMinutes: 0,

            achievement: 0,

            rejectionRate: 0

        };

        records.forEach(entry => {

            summary.target += entry.target;

            summary.actual += entry.actual;

            summary.rejection += entry.rejection;

            summary.goodQuantity += entry.goodQuantity;

            summary.downtimeMinutes += entry.downtimeMinutes;

        });

        summary.achievement =
            summary.target > 0
                ? Number(
                    (summary.actual / summary.target * 100).toFixed(2)
                )
                : 0;

        summary.rejectionRate =
            summary.actual > 0
                ? Number(
                    (summary.rejection / summary.actual * 100).toFixed(2)
                )
                : 0;

        return summary;
    },

    /* ----------------------------------
       9. SHIFT-WISE SUMMARY
    ---------------------------------- */

    getShiftSummary(date, department = "") {

        return this.shifts.map(shift => {

            const filters = {
                date,
                shift
            };

            if (department) {
                filters.department = department;
            }

            return {
                shift,
                ...this.getSummary(filters)
            };
        });
    },

    /* ----------------------------------
       10. MACHINE-WISE SUMMARY
    ---------------------------------- */

    getMachineSummary(date, department = "") {

        const records = this.filter({
            date,
            department
        });

        const machineIds = [
            ...new Set(records.map(entry => entry.machineId))
        ];

        return machineIds.map(machineId => ({

            machineId,

            ...this.getSummary({
                date,
                department,
                machineId
            })

        }));
    },

    /* ----------------------------------
       11. DEPARTMENT-WISE SUMMARY
    ---------------------------------- */

    getDepartmentSummary(date) {

        return this.departments.map(department => ({

            department,

            ...this.getSummary({
                date,
                department
            })

        }));
    },

    /* ----------------------------------
       12. PRODUCTION EDIT
    ---------------------------------- */

    updateEntry(entryId, changes) {

        const index = this.entries.findIndex(
            entry => entry.id === entryId
        );

        if (index === -1) {
            return this.fail("Production entry not found.");
        }

        const entry = this.entries[index];

        const oldEntry = { ...entry };

        const actual = Number(
            changes.actual ?? entry.actual
        );

        const rejection = Number(
            changes.rejection ?? entry.rejection
        );

        const target = Number(
            changes.target ?? entry.target
        );

        if (
            !Number.isFinite(actual) ||
            !Number.isFinite(rejection) ||
            !Number.isFinite(target) ||
            actual <= 0 ||
            target <= 0 ||
            rejection < 0 ||
            rejection > actual
        ) {
            return this.fail("Invalid updated quantities.");
        }

        entry.actual = actual;
        entry.target = target;
        entry.rejection = rejection;

        entry.goodQuantity = actual - rejection;

        entry.achievement = Number(
            (actual / target * 100).toFixed(2)
        );

        entry.rejectionRate = Number(
            (rejection / actual * 100).toFixed(2)
        );

        if (changes.rejectionReason !== undefined) {
            entry.rejectionReason =
                String(changes.rejectionReason);
        }

        if (changes.remarks !== undefined) {
            entry.remarks = String(changes.remarks);
        }

        if (!this.save()) {

            this.entries[index] = oldEntry;

            return this.fail("Entry update failed.");
        }

        this.render();

        return entry;
    },

    /* ----------------------------------
       13. PRODUCTION REPORT
    ---------------------------------- */

    getProductionReport(fromDate, toDate) {

        const records = this.entries.filter(entry =>
            entry.date >= fromDate &&
            entry.date <= toDate
        );

        const total = {

            records: records.length,

            target: 0,

            actual: 0,

            rejection: 0,

            goodQuantity: 0,

            downtimeMinutes: 0

        };

        records.forEach(entry => {

            total.target += entry.target;

            total.actual += entry.actual;

            total.rejection += entry.rejection;

            total.goodQuantity += entry.goodQuantity;

            total.downtimeMinutes += entry.downtimeMinutes;

        });

        total.achievement = total.target > 0
            ? Number(
                (total.actual / total.target * 100).toFixed(2)
            )
            : 0;

        total.rejectionRate = total.actual > 0
            ? Number(
                (total.rejection / total.actual * 100).toFixed(2)
            )
            : 0;

        return total;
    },

    /* ----------------------------------
       14. REJECTION ANALYSIS
    ---------------------------------- */

    getRejectionAnalysis(filters = {}) {

        const records = this.filter(filters);

        const result = {};

        records.forEach(entry => {

            const reason =
                entry.rejectionReason || "Not Specified";

            result[reason] =
                (result[reason] || 0) + entry.rejection;

        });

        return result;
    },

    /* ----------------------------------
       15. DOWNTIME ANALYSIS
    ---------------------------------- */

    getDowntimeAnalysis(filters = {}) {

        const records = this.filter(filters);

        return records.map(entry => ({

            machineId: entry.machineId,

            department: entry.department,

            shift: entry.shift,

            downtimeMinutes: entry.downtimeMinutes,

            workOrder: entry.workOrder

        }));
    },

    /* ----------------------------------
       16. RENDER PRODUCTION TABLE
    ---------------------------------- */

    render() {

        const container = document.getElementById(
            "production-table-container"
        );

        if (!container) return;

        if (this.entries.length === 0) {

            container.innerHTML = `
                <p class="text-muted">
                    No production entries available.
                </p>
            `;

            return;
        }

        const sorted = [...this.entries].reverse();

        container.innerHTML = `
            <div class="table-container">

                <table>

                    <thead>

                        <tr>
                            <th>Date</th>
                            <th>Department</th>
                            <th>Machine</th>
                            <th>Work Order</th>
                            <th>Product</th>
                            <th>Shift</th>
                            <th>Target</th>
                            <th>Actual</th>
                            <th>Rejection</th>
                            <th>Good Qty</th>
                            <th>Achievement</th>
                            <th>Downtime</th>
                        </tr>

                    </thead>

                    <tbody>

                        ${sorted.map(entry => `

                            <tr>

                                <td>${this.escape(entry.date)}</td>

                                <td>${this.escape(entry.department)}</td>

                                <td>${this.escape(entry.machineId)}</td>

                                <td>${this.escape(entry.workOrder)}</td>

                                <td>${this.escape(entry.product)}</td>

                                <td>${this.escape(entry.shift)}</td>

                                <td>${this.number(entry.target)}</td>

                                <td>${this.number(entry.actual)}</td>

                                <td class="text-danger">
                                    ${this.number(entry.rejection)}
                                </td>

                                <td class="text-success">
                                    ${this.number(entry.goodQuantity)}
                                </td>

                                <td>${entry.achievement}%</td>

                                <td>${entry.downtimeMinutes} min</td>

                            </tr>

                        `).join("")}

                    </tbody>

                </table>

            </div>
        `;
    },

    /* ----------------------------------
       17. HELPERS
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
   18. GLOBAL ACCESS
------------------------------------------ */

window.CapManProduction = ProductionModule;
          
