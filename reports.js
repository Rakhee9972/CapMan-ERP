
/* =========================================================
   CAPMAN ERP - MIS & MANAGEMENT REPORTS
   File: reports.js

   Reports:
   - Production Summary
   - Shift-wise Production
   - Rejection Analysis
   - OEE Calculation
   - Inventory Summary
   - Sales & Purchase Reports
   - Maintenance & HR Reports
   - Management KPI Summary

   Prototype: LocalStorage-based
========================================================= */

(function () {
  "use strict";

  const Reports = {

    /* ---------------------------------
       COMMON HELPERS
    ---------------------------------- */

    number(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    },

    round(value, decimals = 2) {
      const factor = Math.pow(10, decimals);
      return Math.round(this.number(value) * factor) / factor;
    },

    getModule(name) {
      return window[name] || null;
    },

    getDateRange(filters = {}) {
      return {
        from: filters.fromDate || "",
        to: filters.toDate || ""
      };
    },

    inDateRange(date, range) {
      if (!date) return false;

      const value = String(date).slice(0, 10);

      if (range.from && value < range.from) return false;
      if (range.to && value > range.to) return false;

      return true;
    },

    getProductionEntries(filters = {}) {
      const production = this.getModule("CapManProduction");

      if (!production || !Array.isArray(production.entries)) {
        return [];
      }

      const range = this.getDateRange(filters);

      return production.entries.filter(entry => {
        if (!this.inDateRange(entry.date, range)) return false;

        if (filters.department &&
            entry.department !== filters.department) return false;

        if (filters.shift && entry.shift !== filters.shift) return false;

        if (filters.machineCode &&
            entry.machineCode !== filters.machineCode) return false;

        return true;
      });
    },

    /* ---------------------------------
       1. PRODUCTION REPORT
    ---------------------------------- */

    getProductionSummary(filters = {}) {
      const entries = this.getProductionEntries(filters);

      const totalTarget = entries.reduce(
        (sum, e) => sum + this.number(e.target), 0
      );

      const totalActual = entries.reduce(
        (sum, e) => sum + this.number(e.actual), 0
      );

      const totalReject = entries.reduce(
        (sum, e) => sum + this.number(e.rejection), 0
      );

      const totalGood = entries.reduce(
        (sum, e) => sum + this.number(
          e.good !== undefined ? e.good : (
            this.number(e.actual) - this.number(e.rejection)
          )
        ), 0
      );

      return {
        totalEntries: entries.length,
        totalTarget,
        totalActual,
        totalGood,
        totalReject,
        achievement: totalTarget
          ? this.round(totalActual / totalTarget * 100) : 0,
        rejectionRate: totalActual
          ? this.round(totalReject / totalActual * 100) : 0
      };
    },

    getDepartmentProduction(filters = {}) {
      const entries = this.getProductionEntries(filters);
      const groups = {};

      entries.forEach(e => {
        const department = e.department || "Unassigned";

        if (!groups[department]) {
          groups[department] = {
            department,
            target: 0,
            actual: 0,
            good: 0,
            rejection: 0,
            entries: 0
          };
        }

        groups[department].target += this.number(e.target);
        groups[department].actual += this.number(e.actual);
        groups[department].good += this.number(
          e.good !== undefined ? e.good :
          this.number(e.actual) - this.number(e.rejection)
        );
        groups[department].rejection += this.number(e.rejection);
        groups[department].entries++;
      });

      return Object.values(groups).map(g => ({
        ...g,
        achievement: g.target
          ? this.round(g.actual / g.target * 100) : 0,
        rejectionRate: g.actual
          ? this.round(g.rejection / g.actual * 100) : 0
      }));
    },

    getShiftProduction(filters = {}) {
      const entries = this.getProductionEntries(filters);
      const groups = {};

      entries.forEach(e => {
        const shift = e.shift || "Unassigned";

        if (!groups[shift]) {
          groups[shift] = {
            shift,
            target: 0,
            actual: 0,
            good: 0,
            rejection: 0
          };
        }

        groups[shift].target += this.number(e.target);
        groups[shift].actual += this.number(e.actual);
        groups[shift].good += this.number(
          e.good !== undefined ? e.good :
          this.number(e.actual) - this.number(e.rejection)
        );
        groups[shift].rejection += this.number(e.rejection);
      });

      return Object.values(groups).map(g => ({
        ...g,
        achievement: g.target
          ? this.round(g.actual / g.target * 100) : 0,
        rejectionRate: g.actual
          ? this.round(g.rejection / g.actual * 100) : 0
      }));
    },

    /* ---------------------------------
       2. REJECTION ANALYSIS
    ---------------------------------- */

    getRejectionAnalysis(filters = {}) {
      const entries = this.getProductionEntries(filters);
      const groups = {};

      entries.forEach(e => {
        const department = e.department || "Unassigned";

        if (!groups[department]) {
          groups[department] = {
            department,
            actual: 0,
            rejection: 0
          };
        }

        groups[department].actual += this.number(e.actual);
        groups[department].rejection += this.number(e.rejection);
      });

      return Object.values(groups).map(g => ({
        ...g,
        good: g.actual - g.rejection,
        rejectionPercentage: g.actual
          ? this.round(g.rejection / g.actual * 100) : 0
      }));
    },

    getQualityInspectionReport() {
      const quality = this.getModule("CapManQuality");

      if (!quality || !Array.isArray(quality.inspections)) {
        return {
          totalInspections: 0,
          inspected: 0,
          accepted: 0,
          rejected: 0,
          hold: 0
        };
      }

      return quality.inspections.reduce((result, record) => {
        result.totalInspections++;
        result.inspected += this.number(record.inspected);
        result.accepted += this.number(record.accepted);
        result.rejected += this.number(record.rejected);
        result.hold += this.number(record.hold);
        return result;
      }, {
        totalInspections: 0,
        inspected: 0,
        accepted: 0,
        rejected: 0,
        hold: 0
      });
    },

    /* ---------------------------------
       3. OEE CALCULATION
    ---------------------------------- */

    calculateOEE(data) {
      const plannedMinutes = this.number(data.plannedMinutes);
      const downtimeMinutes = this.number(data.downtimeMinutes);
      const idealOutput = this.number(data.idealOutput);
      const actualOutput = this.number(data.actualOutput);
      const goodOutput = this.number(data.goodOutput);

      if (
        plannedMinutes <= 0 ||
        idealOutput <= 0 ||
        actualOutput < 0 ||
        goodOutput < 0 ||
        downtimeMinutes < 0 ||
        downtimeMinutes > plannedMinutes ||
        goodOutput > actualOutput
      ) {
        throw new Error("Invalid OEE input values.");
      }

      const runMinutes = plannedMinutes - downtimeMinutes;

      const availability = runMinutes / plannedMinutes;
      const performance = runMinutes > 0
        ? actualOutput / idealOutput : 0;
      const quality = actualOutput > 0
        ? goodOutput / actualOutput : 0;

      const oee = availability * performance * quality * 100;

      return {
        plannedMinutes,
        downtimeMinutes,
        runMinutes,
        availability: this.round(availability * 100),
        performance: this.round(performance * 100),
        quality: this.round(quality * 100),
        oee: this.round(oee),
        note: "OEE uses actual production data and a verified ideal output standard."
      };
    },

    /*
      Calculate OEE only when the user supplies a verified
      ideal output for the selected machine and time period.
      Do not assume machine speed or cycle time.
    */

    /* ---------------------------------
       4. INVENTORY REPORT
    ---------------------------------- */

    getInventoryReport() {
      const inventory = this.getModule("CapManInventory");

      if (!inventory || typeof inventory.getSummary !== "function") {
        return {
          available: false,
          message: "Inventory module is not connected."
        };
      }

      return {
        available: true,
        summary: inventory.getSummary()
      };
    },

    getLowStockReport() {
      const inventory = this.getModule("CapManInventory");

      if (!inventory || typeof inventory.getLowStockReport !== "function") {
        return [];
      }

      return inventory.getLowStockReport();
    },

    getStockLedgerReport(filters = {}) {
      const inventory = this.getModule("CapManInventory");

      if (!inventory || !Array.isArray(inventory.ledger)) {
        return [];
      }

      const range = this.getDateRange(filters);

      return inventory.ledger.filter(entry => {
        if (range.from || range.to) {
          if (!this.inDateRange(entry.date || entry.createdAt, range)) {
            return false;
          }
        }

        if (filters.materialCode &&
            entry.materialCode !== filters.materialCode) return false;

        return true;
      });
    },

    /* ---------------------------------
       5. SALES REPORT
    ---------------------------------- */

    getSalesReport() {
      const sales = this.getModule("CapManSales");

      if (!sales || !Array.isArray(sales.orders)) {
        return {
          totalOrders: 0,
          orderedQuantity: 0,
          producedQuantity: 0,
          dispatchedQuantity: 0,
          pendingDispatch: 0
        };
      }

      return sales.orders.reduce((result, order) => {
        const ordered = this.number(order.quantity);
        const produced = this.number(order.producedQty);
        const dispatched = this.number(order.dispatchedQty);

        result.totalOrders++;
        result.orderedQuantity += ordered;
        result.producedQuantity += produced;
        result.dispatchedQuantity += dispatched;
        result.pendingDispatch += Math.max(0, ordered - dispatched);

        return result;
      }, {
        totalOrders: 0,
        orderedQuantity: 0,
        producedQuantity: 0,
        dispatchedQuantity: 0,
        pendingDispatch: 0
      });
    },

    /* ---------------------------------
       6. PURCHASE REPORT
    ---------------------------------- */

    getPurchaseReport() {
      const purchase = this.getModule("CapManPurchase");

      if (!purchase || !Array.isArray(purchase.orders)) {
        return {
          totalPurchaseOrders: 0,
          orderedQuantity: 0,
          receivedQuantity: 0,
          rejectedQuantity: 0,
          pendingQuantity: 0
        };
      }

      return purchase.orders.reduce((result, order) => {
        const ordered = this.number(order.quantity);
        const received = this.number(order.receivedQty);
        const rejected = this.number(order.rejectedQty);

        result.totalPurchaseOrders++;
        result.orderedQuantity += ordered;
        result.receivedQuantity += received;
        result.rejectedQuantity += rejected;
        result.pendingQuantity += Math.max(0, ordered - received - rejected);

        return result;
      }, {
        totalPurchaseOrders: 0,
        orderedQuantity: 0,
        receivedQuantity: 0,
        rejectedQuantity: 0,
        pendingQuantity: 0
      });
    },

    /* ---------------------------------
       7. MAINTENANCE REPORT
    ---------------------------------- */

    getMaintenanceReport() {
      const maintenance = this.getModule("CapManMaintenance");

      if (!maintenance || typeof maintenance.getSummary !== "function") {
        return {
          totalBreakdowns: 0,
          open: 0,
          inProgress: 0,
          completed: 0,
          totalDowntimeHours: 0,
          pmDue: 0
        };
      }

      return maintenance.getSummary();
    },

    /* ---------------------------------
       8. HR REPORT
    ---------------------------------- */

    getHRReport(date) {
      const hr = this.getModule("CapManHR");

      if (!hr || typeof hr.getManpowerSummary !== "function") {
        return {
          totalEmployees: 0,
          activeEmployees: 0,
          inactiveEmployees: 0,
          attendance: null
        };
      }

      return {
        ...hr.getManpowerSummary(),
        attendance: hr.getAttendanceSummary(
          date || new Date().toISOString().slice(0, 10)
        )
      };
    },

    /* ---------------------------------
       9. MANAGEMENT KPI SUMMARY
    ---------------------------------- */

    getManagementSummary(filters = {}) {
      return {
        generatedAt: new Date().toISOString(),
        production: this.getProductionSummary(filters),
        departments: this.getDepartmentProduction(filters),
        shifts: this.getShiftProduction(filters),
        rejection: this.getRejectionAnalysis(filters),
        quality: this.getQualityInspectionReport(),
        inventory: this.getInventoryReport(),
        sales: this.getSalesReport(),
        purchase: this.getPurchaseReport(),
        maintenance: this.getMaintenanceReport(),
        hr: this.getHRReport()
      };
    },

    /* ---------------------------------
       10. EXPORT REPORT DATA
    ---------------------------------- */

    downloadCSV(filename, rows) {
      if (!Array.isArray(rows) || !rows.length) {
        throw new Error("No report data available to export.");
      }

      const headers = Object.keys(rows[0]);

      const escapeCSV = value => {
        const text = String(value ?? "");
        return '"' + text.replace(/"/g, '""') + '"';
      };

      const csv = [
        headers.map(escapeCSV).join(","),
        ...rows.map(row =>
          headers.map(key => escapeCSV(row[key])).join(",")
        )
      ].join("\r\n");

      const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;"
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename || "capman-report.csv";

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    },

    /* ---------------------------------
       11. BASIC REPORT RENDERING
    ---------------------------------- */

    renderManagementSummary() {
      const container = document.getElementById(
        "management-report-container"
      );

      if (!container) return;

      const report = this.getManagementSummary();
      const p = report.production;
      const m = report.maintenance;
      const h = report.hr;
      const s = report.sales;

      const cards = [
        ["Production Actual", p.totalActual],
        ["Production Good", p.totalGood],
        ["Production Rejects", p.totalReject],
        ["Achievement %", p.achievement + "%"],
        ["Rejection %", p.rejectionRate + "%"],
        ["Sales Orders", s.totalOrders],
        ["Pending Dispatch", s.pendingDispatch],
        ["Breakdowns", m.totalBreakdowns],
        ["Downtime Hours", m.totalDowntimeHours],
        ["Active Employees", h.activeEmployees]
      ];

      container.innerHTML = `
        <div class="report-kpi-grid">
          ${cards.map(card => `
            <div class="report-kpi-card">
              <div>${this.escape(card[0])}</div>
              <strong>${this.escape(card[1])}</strong>
            </div>
          `).join("")}
        </div>
      `;
    },

    renderProductionReport(filters = {}) {
      const container = document.getElementById(
        "production-report-container"
      );

      if (!container) return;

      const summary = this.getProductionSummary(filters);

      container.innerHTML = `
        <h3>Production Summary</h3>
        <p>Total Target: ${summary.totalTarget}</p>
        <p>Total Actual: ${summary.totalActual}</p>
        <p>Good Production: ${summary.totalGood}</p>
        <p>Rejections: ${summary.totalReject}</p>
        <p>Achievement: ${summary.achievement}%</p>
        <p>Rejection Rate: ${summary.rejectionRate}%</p>
      `;
    },

    initialize() {
      this.renderManagementSummary();
      this.renderProductionReport();

      console.log("CapMan MIS Reports module initialized.");
    }
  };

  window.CapManReports = Reports;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      Reports.initialize();
    });
  } else {
    Reports.initialize();
  }

})();
            
