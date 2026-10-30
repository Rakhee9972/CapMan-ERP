
/* ==========================================
   CAPMAN ERP - DASHBOARD MODULE
   Version: 1.0
========================================== */

"use strict";

const Dashboard = {

    data: {
        closureMachines: 20,
        waddingMachines: 11,

        production: {
            target: 0,
            actual: 0,
            rejection: 0,
            goodQuantity: 0
        },

        workOrders: {
            total: 0,
            pending: 0,
            inProgress: 0,
            completed: 0
        },

        inventory: {
            rawMaterial: 0,
            sfg: 0,
            finishedGoods: 0
        },

        activities: []
    },

    /* ----------------------------------
       UPDATE DASHBOARD DATA
    ---------------------------------- */

    updateData(newData = {}) {

        this.data = {
            ...this.data,
            ...newData
        };

        this.render();
    },

    /* ----------------------------------
       PRODUCTION CALCULATIONS
    ---------------------------------- */

    getProductionSummary() {

        const p = this.data.production;

        const target = Number(p.target) || 0;
        const actual = Number(p.actual) || 0;
        const rejection = Number(p.rejection) || 0;

        const goodQuantity = Math.max(
            0,
            actual - rejection
        );

        const achievement = target > 0
            ? (actual / target) * 100
            : 0;

        const rejectionRate = actual > 0
            ? (rejection / actual) * 100
            : 0;

        return {
            target,
            actual,
            rejection,
            goodQuantity,
            achievement: achievement.toFixed(2),
            rejectionRate: rejectionRate.toFixed(2)
        };
    },

    /* ----------------------------------
       MACHINE SUMMARY
    ---------------------------------- */

    getMachineSummary() {

        const closure = this.data.closureMachines;
        const wadding = this.data.waddingMachines;

        return {
            closure,
            wadding,
            total: closure + wadding
        };
    },

    /* ----------------------------------
       WORK ORDER SUMMARY
    ---------------------------------- */

    getWorkOrderSummary() {

        const w = this.data.workOrders;

        return {
            total: Number(w.total) || 0,
            pending: Number(w.pending) || 0,
            inProgress: Number(w.inProgress) || 0,
            completed: Number(w.completed) || 0
        };
    },

    /* ----------------------------------
       DASHBOARD HTML
    ---------------------------------- */

    render() {

        this.renderMachineCards();
        this.renderProductionCards();
        this.renderWorkOrders();
        this.renderInventory();
        this.renderActivities();

        document.dispatchEvent(
            new CustomEvent("capman:dashboard-updated")
        );
    },

    /* ----------------------------------
       MACHINE CARDS
    ---------------------------------- */

    renderMachineCards() {

        const container =
            document.getElementById("dashboard-machines");

        if (!container) return;

        const machines = this.getMachineSummary();

        container.innerHTML = `
            <div class="stat-card">
                <h3>Total Machines</h3>
                <div class="value">
                    ${machines.total}
                </div>
                <p>Across 2 departments</p>
            </div>

            <div class="stat-card">
                <h3>Closure Machines</h3>
                <div class="value">
                    ${machines.closure}
                </div>
                <p>Injection moulding department</p>
            </div>

            <div class="stat-card">
                <h3>Wadding Machines</h3>
                <div class="value">
                    ${machines.wadding}
                </div>
                <p>Wadding production department</p>
            </div>
        `;
    },

    /* ----------------------------------
       PRODUCTION CARDS
    ---------------------------------- */

    renderProductionCards() {

        const container =
            document.getElementById("dashboard-production");

        if (!container) return;

        const p = this.getProductionSummary();

        container.innerHTML = `
            <div class="stat-card">
                <h3>Production Target</h3>
                <div class="value">
                    ${this.number(p.target)}
                </div>
                <p>Pieces</p>
            </div>

            <div class="stat-card">
                <h3>Actual Production</h3>
                <div class="value">
                    ${this.number(p.actual)}
                </div>
                <p>Pieces</p>
            </div>

            <div class="stat-card">
                <h3>Good Production</h3>
                <div class="value">
                    ${this.number(p.goodQuantity)}
                </div>
                <p>After rejection</p>
            </div>

            <div class="stat-card">
                <h3>Rejection</h3>
                <div class="value text-danger">
                    ${this.number(p.rejection)}
                </div>
                <p>${p.rejectionRate}% rejection rate</p>
            </div>

            <div class="stat-card">
                <h3>Target Achievement</h3>
                <div class="value">
                    ${p.achievement}%
                </div>
                <p>Actual vs Target</p>
            </div>
        `;
    },

    /* ----------------------------------
       WORK ORDER CARDS
    ---------------------------------- */

    renderWorkOrders() {

        const container =
            document.getElementById("dashboard-workorders");

        if (!container) return;

        const w = this.getWorkOrderSummary();

        container.innerHTML = `
            <div class="stat-card">
                <h3>Total Work Orders</h3>
                <div class="value">${w.total}</div>
            </div>

            <div class="stat-card">
                <h3>Pending</h3>
                <div class="value text-warning">
                    ${w.pending}
                </div>
            </div>

            <div class="stat-card">
                <h3>In Progress</h3>
                <div class="value">
                    ${w.inProgress}
                </div>
            </div>

            <div class="stat-card">
                <h3>Completed</h3>
                <div class="value text-success">
                    ${w.completed}
                </div>
            </div>
        `;
    },

    /* ----------------------------------
       INVENTORY CARDS
    ---------------------------------- */

    renderInventory() {

        const container =
            document.getElementById("dashboard-inventory");

        if (!container) return;

        const stock = this.data.inventory;

        container.innerHTML = `
            <div class="stat-card">
                <h3>Raw Materials</h3>
                <div class="value">
                    ${this.number(stock.rawMaterial)}
                </div>
                <p>Stock quantity</p>
            </div>

            <div class="stat-card">
                <h3>SFG Inventory</h3>
                <div class="value">
                    ${this.number(stock.sfg)}
                </div>
                <p>Outer Cap + Inner Cap</p>
            </div>

            <div class="stat-card">
                <h3>Finished Goods</h3>
                <div class="value">
                    ${this.number(stock.finishedGoods)}
                </div>
                <p>Finished Cap stock</p>
            </div>
        `;
    },

    /* ----------------------------------
       RECENT ACTIVITIES
    ---------------------------------- */

    addActivity(message, type = "info") {

        this.data.activities.unshift({
            id: "ACT-" + Date.now(),
            message: String(message),
            type,
            date: new Date()
        });

        this.data.activities =
            this.data.activities.slice(0, 20);

        this.renderActivities();
    },

    renderActivities() {

        const container =
            document.getElementById("dashboard-activities");

        if (!container) return;

        if (this.data.activities.length === 0) {

            container.innerHTML = `
                <p class="text-muted">
                    No activities recorded yet.
                </p>
            `;

            return;
        }

        container.innerHTML =
            this.data.activities.map(activity => `
                <div class="activity-item">
                    <strong>
                        ${this.escape(activity.message)}
                    </strong>
                    <p class="text-muted">
                        ${activity.date.toLocaleString("en-IN")}
                    </p>
                </div>
            `).join("");
    },

    /* ----------------------------------
       COMMON HELPERS
    ---------------------------------- */

    number(value) {

        return Number(value || 0)
            .toLocaleString("en-IN");
    },

    escape(value) {

        const element = document.createElement("div");

        element.textContent = String(value ?? "");

        return element.innerHTML;
    },

    /* ----------------------------------
       INITIALIZE DASHBOARD
    ---------------------------------- */

    initialize() {

        this.render();

        console.log(
            "CapMan ERP Dashboard initialized."
        );
    }
};


/* GLOBAL ACCESS */

window.CapManDashboard = Dashboard;
