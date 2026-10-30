
/* ==========================================
   CAPMAN ERP - MACHINE MASTER
   Version: 1.0
========================================== */

"use strict";

const MachineMaster = {

    storageKey: "capman_machine_master",

    machines: [],

    /* ----------------------------------
       1. DEFAULT MACHINE DATA
    ---------------------------------- */

    createDefaultMachines() {

        const closure = Array.from(
            { length: 20 },
            (_, index) => ({
                id: "IM-" +
                    String(index + 1).padStart(2, "0") +
                    "/26",
                name: "Injection Machine " + (index + 1),
                department: "Closure",
                machineType: "Injection Moulding",
                capacity: 0,
                cavities: 0,
                mould: "",
                operator: "",
                shift: "",
                status: "Active",
                remarks: ""
            })
        );

        const wadding = Array.from(
            { length: 11 },
            (_, index) => ({
                id: "WD-" +
                    String(index + 1).padStart(2, "0") +
                    "/26",
                name: "Wadding Machine " + (index + 1),
                department: "Wadding",
                machineType: "Wadding",
                capacity: 0,
                cavities: 0,
                mould: "",
                operator: "",
                shift: "",
                status: "Active",
                remarks: ""
            })
        );

        return [...closure, ...wadding];
    },

    /* ----------------------------------
       2. LOAD MACHINE DATA
    ---------------------------------- */

    initialize() {

        try {

            const saved = localStorage.getItem(
                this.storageKey
            );

            if (saved) {
                const parsed = JSON.parse(saved);

                if (Array.isArray(parsed)) {
                    this.machines = parsed;
                } else {
                    this.machines = this.createDefaultMachines();
                }

            } else {

                this.machines = this.createDefaultMachines();
                this.save();
            }

        } catch (error) {

            console.error("Machine loading error:", error);

            this.machines = this.createDefaultMachines();
        }

        this.render();

        console.log(
            "Machine Master initialized:",
            this.machines.length,
            "machines"
        );
    },

    /* ----------------------------------
       3. SAVE DATA
    ---------------------------------- */

    save() {

        try {

            localStorage.setItem(
                this.storageKey,
                JSON.stringify(this.machines)
            );

            return true;

        } catch (error) {

            console.error("Machine save failed:", error);

            if (window.CapMan?.notifications) {
                window.CapMan.notifications.error(
                    "Unable to save machine data."
                );
            }

            return false;
        }
    },

    /* ----------------------------------
       4. GET ALL MACHINES
    ---------------------------------- */

    getAll() {

        return [...this.machines];
    },

    /* ----------------------------------
       5. GET MACHINE BY ID
    ---------------------------------- */

    getById(machineId) {

        return this.machines.find(
            machine => machine.id === machineId
        ) || null;
    },

    /* ----------------------------------
       6. FILTER BY DEPARTMENT
    ---------------------------------- */

    getByDepartment(department) {

        return this.machines.filter(
            machine =>
                machine.department.toLowerCase() ===
                department.toLowerCase()
        );
    },

    /* ----------------------------------
       7. ADD NEW MACHINE
    ---------------------------------- */

    add(machineData) {

        if (!machineData || typeof machineData !== "object") {
            return this.fail("Invalid machine details.");
        }

        const id = String(machineData.id || "").trim();

        if (!id) {
            return this.fail("Machine ID is required.");
        }

        if (this.getById(id)) {
            return this.fail("Machine ID already exists.");
        }

        const department = String(
            machineData.department || ""
        ).trim();

        if (!["Closure", "Wadding"].includes(department)) {
            return this.fail("Select a valid department.");
        }

        const machine = {
            id,
            name: String(machineData.name || id).trim(),
            department,
            machineType: String(
                machineData.machineType || ""
            ).trim(),

            capacity: Number(machineData.capacity) || 0,
            cavities: Number(machineData.cavities) || 0,

            mould: String(machineData.mould || "").trim(),
            operator: String(machineData.operator || "").trim(),
            shift: String(machineData.shift || "").trim(),

            status: "Active",

            remarks: String(machineData.remarks || "").trim()
        };

        this.machines.push(machine);

        if (!this.save()) {
            this.machines.pop();
            return false;
        }

        this.render();

        this.notify("Machine added successfully.");

        return machine;
    },

    /* ----------------------------------
       8. EDIT MACHINE
    ---------------------------------- */

    update(machineId, changes) {

        const index = this.machines.findIndex(
            machine => machine.id === machineId
        );

        if (index === -1) {
            return this.fail("Machine not found.");
        }

        const oldMachine = { ...this.machines[index] };

        const allowedFields = [
            "name",
            "machineType",
            "capacity",
            "cavities",
            "mould",
            "operator",
            "shift",
            "remarks"
        ];

        allowedFields.forEach(field => {

            if (changes[field] !== undefined) {

                if (["capacity", "cavities"].includes(field)) {

                    const value = Number(changes[field]);

                    if (!Number.isFinite(value) || value < 0) {
                        throw new Error(
                            "Invalid value for " + field
                        );
                    }

                    this.machines[index][field] = value;

                } else {

                    this.machines[index][field] =
                        String(changes[field]).trim();
                }
            }
        });

        if (!this.save()) {
            this.machines[index] = oldMachine;
            return false;
        }

        this.render();

        this.notify("Machine updated successfully.");

        return this.machines[index];
    },

    /* ----------------------------------
       9. CHANGE MACHINE STATUS
    ---------------------------------- */

    changeStatus(machineId, newStatus) {

        const allowed = ["Active", "Inactive", "Maintenance"];

        if (!allowed.includes(newStatus)) {
            return this.fail("Invalid machine status.");
        }

        const machine = this.getById(machineId);

        if (!machine) {
            return this.fail("Machine not found.");
        }

        const oldStatus = machine.status;

        machine.status = newStatus;

        if (!this.save()) {
            machine.status = oldStatus;
            return false;
        }

        this.render();

        this.notify("Machine status updated.");

        return true;
    },

    /* ----------------------------------
       10. MACHINE SUMMARY
    ---------------------------------- */

    getSummary() {

        const closure = this.getByDepartment("Closure");
        const wadding = this.getByDepartment("Wadding");

        return {
            total: this.machines.length,

            closure: closure.length,
            wadding: wadding.length,

            active: this.machines.filter(
                m => m.status === "Active"
            ).length,

            inactive: this.machines.filter(
                m => m.status === "Inactive"
            ).length,

            maintenance: this.machines.filter(
                m => m.status === "Maintenance"
            ).length
        };
    },

    /* ----------------------------------
       11. RENDER MACHINE TABLE
    ---------------------------------- */

    render(department = "All") {

        const container = document.getElementById(
            "machine-table-container"
        );

        if (!container) return;

        let filtered = this.machines;

        if (department !== "All") {
            filtered = this.getByDepartment(department);
        }

        if (filtered.length === 0) {

            container.innerHTML = `
                <p class="text-muted">
                    No machines found.
                </p>
            `;

            return;
        }

        container.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Machine ID</th>
                            <th>Name</th>
                            <th>Department</th>
                            <th>Capacity</th>
                            <th>Cavities</th>
                            <th>Operator</th>
                            <th>Shift</th>
                            <th>Status</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${filtered.map(machine => `

                            <tr>
                                <td>
                                    ${this.escape(machine.id)}
                                </td>

                                <td>
                                    ${this.escape(machine.name)}
                                </td>

                                <td>
                                    ${this.escape(machine.department)}
                                </td>

                                <td>
                                    ${machine.capacity}
                                </td>

                                <td>
                                    ${machine.cavities}
                                </td>

                                <td>
                                    ${this.escape(machine.operator)}
                                </td>

                                <td>
                                    ${this.escape(machine.shift)}
                                </td>

                                <td>
                                    <span class="status ${
                                        machine.status === "Active"
                                            ? "status-active"
                                            : machine.status === "Inactive"
                                            ? "status-inactive"
                                            : "status-pending"
                                    }">
                                        ${this.escape(machine.status)}
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
       12. SEARCH MACHINES
    ---------------------------------- */

    search(searchText) {

        const query = String(searchText || "")
            .toLowerCase()
            .trim();

        return this.machines.filter(machine =>

            machine.id.toLowerCase().includes(query) ||

            machine.name.toLowerCase().includes(query) ||

            machine.department.toLowerCase().includes(query) ||

            machine.operator.toLowerCase().includes(query)

        );
    },

    /* ----------------------------------
       13. COMMON HELPERS
    ---------------------------------- */

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
   14. GLOBAL ACCESS
------------------------------------------ */

window.CapManMachines = MachineMaster;
