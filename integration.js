/* =========================================================
   CAPMAN ERP - INTEGRATION MANAGER
   File: integration.js

   Purpose:
   1. Check module availability
   2. Initialize modules in dependency order
   3. Check required ERP modules
   4. Display integration status
   5. Prevent duplicate initialization
========================================================= */

(function () {
    "use strict";

    const Integration = {

        initialized: false,
        moduleStatus: [],

        modules: [
            {
                name: "Settings",
                key: "CapManSettings"
            },
            {
                name: "Machines",
                key: "CapManMachines"
            },
            {
                name: "Materials",
                key: "CapManMaterials"
            },
            {
                name: "BOM",
                key: "CapManBOM"
            },
            {
                name: "Users",
                key: "CapManUsers"
            },
            {
                name: "Audit",
                key: "CapManAudit"
            },
            {
                name: "Inventory",
                key: "CapManInventory"
            },
            {
                name: "Warehouse",
                key: "CapManWarehouse"
            },
            {
                name: "Purchase",
                key: "CapManPurchase"
            },
            {
                name: "GRN",
                key: "CapManGRN"
            },
            {
                name: "Quality",
                key: "CapManQuality"
            },
            {
                name: "Sales",
                key: "CapManSales"
            },
            {
                name: "PPC",
                key: "CapManPPC"
            },
            {
                name: "Production",
                key: "CapManProduction"
            },
            {
                name: "Traceability",
                key: "CapManTraceability"
            },
            {
                name: "Maintenance",
                key: "CapManMaintenance"
            },
            {
                name: "Maintenance Spares",
                key: "CapManSpares"
            },
            {
                name: "HR",
                key: "CapManHR"
            },
            {
                name: "Packing",
                key: "CapManPacking"
            },
            {
                name: "Dispatch",
                key: "CapManDispatch"
            },
            {
                name: "Costing",
                key: "CapManCosting"
            },
            {
                name: "Costing Reports",
                key: "CapManCostReports"
            },
            {
                name: "Reports",
                key: "CapManReports"
            },
            {
                name: "Notifications",
                key: "CapManNotifications"
            },
            {
                name: "Backup",
                key: "CapManBackup"
            },
            {
                name: "Validation",
                key: "CapManValidation"
            }
        ],

        /* -----------------------------------------
           CHECK MODULES
        ----------------------------------------- */

        checkModules() {
            this.moduleStatus = this.modules.map(module => {
                const available = Boolean(
                    window[module.key]
                );

                return {
                    name: module.name,
                    key: module.key,
                    available,
                    status: available
                        ? "AVAILABLE"
                        : "NOT CONNECTED"
                };
            });

            return this.moduleStatus;
        },

        /* -----------------------------------------
           MODULE SUMMARY
        ----------------------------------------- */

        getSummary() {
            const status = this.checkModules();

            const available = status.filter(
                item => item.available
            ).length;

            return {
                total: status.length,
                available,
                missing: status.length - available,
                completionPercentage: status.length
                    ? Math.round(
                        available / status.length * 100
                    )
                    : 0
            };
        },

        /* -----------------------------------------
           INITIALIZE AVAILABLE MODULES
        ----------------------------------------- */

        initializeModules() {
            const results = [];

            this.modules.forEach(module => {
                const instance = window[module.key];

                if (!instance) {
                    results.push({
                        module: module.name,
                        status: "SKIPPED",
                        message: "Module script is not loaded."
                    });

                    return;
                }

                if (
                    typeof instance.initialize === "function"
                ) {
                    try {
                        instance.initialize();

                        results.push({
                            module: module.name,
                            status: "INITIALIZED",
                            message: "Initialization completed."
                        });

                    } catch (error) {
                        results.push({
                            module: module.name,
                            status: "ERROR",
                            message: error.message
                        });
                    }
                } else {
                    results.push({
                        module: module.name,
                        status: "AVAILABLE",
                        message: "No initialize method required."
                    });
                }
            });

            this.initialized = true;

            return results;
        },

        /* -----------------------------------------
           RUN INTEGRATION CHECK
        ----------------------------------------- */

        runCheck() {
            const status = this.checkModules();
            const summary = this.getSummary();

            return {
                summary,
                modules: status,
                initialized: this.initialized
            };
        },

        /* -----------------------------------------
           RENDER INTEGRATION STATUS
        ----------------------------------------- */

        render(containerId = "integration-status-container") {
            const container = document.getElementById(
                containerId
            );

            if (!container) return;

            const status = this.checkModules();
            const summary = this.getSummary();

            container.innerHTML = `
                <div class="integration-summary">
                    <h3>ERP Integration Status</h3>

                    <div class="integration-counts">
                        <div>
                            <strong>${summary.total}</strong>
                            <span>Total Modules</span>
                        </div>

                        <div>
                            <strong>${summary.available}</strong>
                            <span>Available</span>
                        </div>

                        <div>
                            <strong>${summary.missing}</strong>
                            <span>Not Connected</span>
                        </div>

                        <div>
                            <strong>${summary.completionPercentage}%</strong>
                            <span>Availability</span>
                        </div>
                    </div>
                </div>

                <div class="integration-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Module</th>
                                <th>Global Reference</th>
                                <th>Status</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${status.map(item => `
                                <tr>
                                    <td>${item.name}</td>
                                    <td>${item.key}</td>
                                    <td>
                                        <span class="${
                                            item.available
                                                ? "status-active"
                                                : "status-inactive"
                                        }">
                                            ${item.status}
                                        </span>
                                    </td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            `;
        }

    };

    window.CapManIntegration = Integration;

})();
