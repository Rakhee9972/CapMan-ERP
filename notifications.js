
/* =========================================================
   CAPMAN ERP - NOTIFICATION CENTRE
   File: notifications.js

   Features:
   - Low Stock Alerts
   - Production Alerts
   - Breakdown Alerts
   - PM Due Alerts
   - QC Hold Alerts
   - Pending Approval Alerts
   - Dispatch Alerts
   - Read / Unread Management

   Prototype: LocalStorage-based
========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "capman_erp_notifications";

  const Notifications = {

    records: [],

    priorities: ["Critical", "High", "Medium", "Low"],

    categories: [
      "Inventory",
      "Production",
      "Quality",
      "Maintenance",
      "Purchase",
      "Sales",
      "Dispatch",
      "HR",
      "System"
    ],

    load() {
      try {
        this.records =
          JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      } catch (error) {
        console.error("Notification loading error:", error);
        this.records = [];
      }
    },

    save() {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(this.records)
      );
    },

    id() {
      return "NOTIF-" + Date.now() + "-" +
        Math.floor(Math.random() * 10000);
    },

    escape(value) {
      return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);
    },

    /* =====================================
       CREATE NOTIFICATION
    ====================================== */

    create(data) {
      if (!data.title || !data.message) {
        throw new Error("Notification title and message are required.");
      }

      const priority = data.priority || "Medium";

      if (!this.priorities.includes(priority)) {
        throw new Error("Invalid notification priority.");
      }

      const notification = {
        id: this.id(),
        title: String(data.title).trim(),
        message: String(data.message).trim(),
        category: data.category || "System",
        priority,
        referenceType: data.referenceType || "",
        referenceId: data.referenceId || "",
        assignedTo: data.assignedTo || "ALL",
        createdAt: new Date().toISOString(),
        read: false,
        readAt: null,
        dismissed: false,
        dismissedAt: null
      };

      this.records.unshift(notification);
      this.save();
      this.render();

      return notification;
    },

    /* =====================================
       DUPLICATE ALERT CONTROL
    ====================================== */

    createUnique(data) {
      const duplicate = this.records.find(n =>
        !n.dismissed &&
        !n.read &&
        n.category === (data.category || "System") &&
        n.referenceType === (data.referenceType || "") &&
        n.referenceId === (data.referenceId || "") &&
        n.title === data.title
      );

      if (duplicate) return duplicate;

      return this.create(data);
    },

    /* =====================================
       READ / UNREAD MANAGEMENT
    ====================================== */

    markRead(notificationId) {
      const notification = this.records.find(
        n => n.id === notificationId
      );

      if (!notification) {
        throw new Error("Notification not found.");
      }

      notification.read = true;
      notification.readAt = new Date().toISOString();

      this.save();
      this.render();

      return notification;
    },

    markUnread(notificationId) {
      const notification = this.records.find(
        n => n.id === notificationId
      );

      if (!notification) {
        throw new Error("Notification not found.");
      }

      notification.read = false;
      notification.readAt = null;

      this.save();
      this.render();

      return notification;
    },

    markAllRead() {
      this.records.forEach(n => {
        if (!n.dismissed) {
          n.read = true;
          n.readAt = new Date().toISOString();
        }
      });

      this.save();
      this.render();
    },

    dismiss(notificationId) {
      const notification = this.records.find(
        n => n.id === notificationId
      );

      if (!notification) {
        throw new Error("Notification not found.");
      }

      notification.dismissed = true;
      notification.dismissedAt = new Date().toISOString();

      this.save();
      this.render();

      return notification;
    },

    /* =====================================
       NOTIFICATION QUERIES
    ====================================== */

    getUnread() {
      return this.records.filter(
        n => !n.read && !n.dismissed
      );
    },

    getActive() {
      return this.records.filter(n => !n.dismissed);
    },

    getByCategory(category) {
      return this.getActive().filter(
        n => n.category === category
      );
    },

    getByPriority(priority) {
      return this.getActive().filter(
        n => n.priority === priority
      );
    },

    getSummary() {
      const active = this.getActive();

      return {
        total: active.length,
        unread: active.filter(n => !n.read).length,
        critical: active.filter(n => n.priority === "Critical").length,
        high: active.filter(n => n.priority === "High").length,
        medium: active.filter(n => n.priority === "Medium").length,
        low: active.filter(n => n.priority === "Low").length
      };
    },

    /* =====================================
       INVENTORY ALERTS
    ====================================== */

    checkLowStock() {
      const inventory = window.CapManInventory;

      if (!inventory ||
          typeof inventory.getLowStockReport !== "function") {
        return [];
      }

      const lowStock = inventory.getLowStockReport();

      lowStock.forEach(item => {
        const code = item.materialCode || item.code || "";

        this.createUnique({
          title: "Low Stock Alert",
          message:
            (item.materialName || code) +
            " is below its configured minimum stock level.",
          category: "Inventory",
          priority: "High",
          referenceType: "Material",
          referenceId: code
        });
      });

      return lowStock;
    },

    /* =====================================
       MAINTENANCE ALERTS
    ====================================== */

    checkMaintenance() {
      const maintenance = window.CapManMaintenance;

      if (!maintenance) return [];

      const due = typeof maintenance.getDueSchedules === "function"
        ? maintenance.getDueSchedules()
        : [];

      due.forEach(item => {
        this.createUnique({
          title: "Preventive Maintenance Due",
          message:
            item.machineCode + " - " + item.description +
            " is due for preventive maintenance.",
          category: "Maintenance",
          priority: "High",
          referenceType: "PM Schedule",
          referenceId: item.id
        });
      });

      const openBreakdowns = Array.isArray(maintenance.records)
        ? maintenance.records.filter(r =>
            r.status === "Open" || r.status === "In Progress"
          )
        : [];

      openBreakdowns.forEach(item => {
        this.createUnique({
          title: "Machine Breakdown",
          message:
            item.machineCode + " - " + item.problem,
          category: "Maintenance",
          priority: item.priority === "Critical"
            ? "Critical" : "High",
          referenceType: "Maintenance Order",
          referenceId: item.id
        });
      });

      return { due, openBreakdowns };
    },

    /* =====================================
       QUALITY ALERTS
    ====================================== */

    checkQuality() {
      const quality = window.CapManQuality;

      if (!quality || !Array.isArray(quality.inspections)) {
        return [];
      }

      const alerts = quality.inspections.filter(i =>
        this.number(i.hold) > 0 ||
        this.number(i.rejected) > 0
      );

      alerts.forEach(item => {
        if (this.number(item.hold) > 0) {
          this.createUnique({
            title: "Quality Hold Alert",
            message:
              "Inspection " + item.id +
              " has " + item.hold + " units on hold.",
            category: "Quality",
            priority: "High",
            referenceType: "QC Inspection",
            referenceId: item.id
          });
        }

        if (this.number(item.rejected) > 0) {
          this.createUnique({
            title: "Quality Rejection Alert",
            message:
              "Inspection " + item.id +
              " recorded " + item.rejected + " rejected units.",
            category: "Quality",
            priority: "Medium",
            referenceType: "QC Inspection",
            referenceId: item.id
          });
        }
      });

      return alerts;
    },

    /* =====================================
       PURCHASE ALERTS
    ====================================== */

    checkPurchase() {
      const audit = window.CapManAudit;

      if (!audit || typeof audit.getPendingApprovals !== "function") {
        return [];
      }

      const pending = audit.getPendingApprovals().filter(a =>
        a.module === "PURCHASE"
      );

      pending.forEach(item => {
        this.createUnique({
          title: "Purchase Approval Pending",
          message:
            "Purchase transaction " + item.referenceNo +
            " is awaiting approval.",
          category: "Purchase",
          priority: "Medium",
          referenceType: "Approval",
          referenceId: item.id
        });
      });

      return pending;
    },

    /* =====================================
       SALES & DISPATCH ALERTS
    ====================================== */

    checkDispatch() {
      const dispatch = window.CapManDispatch;

      if (!dispatch || !Array.isArray(dispatch.dispatchRecords)) {
        return [];
      }

      const pending = dispatch.dispatchRecords.filter(d =>
        d.status === "Prepared"
      );

      pending.forEach(item => {
        this.createUnique({
          title: "Dispatch Pending",
          message:
            "Dispatch " + item.dispatchNo +
            " is prepared but not yet confirmed.",
          category: "Dispatch",
          priority: "Medium",
          referenceType: "Dispatch",
          referenceId: item.id
        });
      });

      return pending;
    },

    /* =====================================
       PRODUCTION TARGET ALERTS
    ====================================== */

    checkProduction() {
      const production = window.CapManProduction;

      if (!production || !Array.isArray(production.entries)) {
        return [];
      }

      const today = new Date().toISOString().slice(0, 10);

      const entries = production.entries.filter(e =>
        e.date === today &&
        this.number(e.target) > 0 &&
        this.number(e.actual) < this.number(e.target)
      );

      entries.forEach(item => {
        const achievement =
          this.number(item.actual) /
          this.number(item.target) * 100;

        if (achievement < 80) {
          this.createUnique({
            title: "Production Target Alert",
            message:
              item.machineCode + " is achieving " +
              achievement.toFixed(1) +
              "% of its target for today.",
            category: "Production",
            priority: achievement < 50 ? "High" : "Medium",
            referenceType: "Production Entry",
            referenceId: item.id
          });
        }
      });

      return entries;
    },

    /* =====================================
       HR ATTENDANCE ALERT
    ====================================== */

    checkAttendance() {
      const hr = window.CapManHR;

      if (!hr || typeof hr.getAttendanceByDate !== "function") {
        return [];
      }

      const today = new Date().toISOString().slice(0, 10);
      const attendance = hr.getAttendanceByDate(today);

      if (!attendance.length) {
        this.createUnique({
          title: "Attendance Not Recorded",
          message: "No attendance entries have been recorded for today.",
          category: "HR",
          priority: "Medium",
          referenceType: "Attendance",
          referenceId: today
        });
      }

      return attendance;
    },

    number(value) {
      const result = Number(value);
      return Number.isFinite(result) ? result : 0;
    },

    /* =====================================
       RUN ALL AVAILABLE CHECKS
    ====================================== */

    runChecks() {
      const results = {};

      const checks = [
        ["inventory", () => this.checkLowStock()],
        ["maintenance", () => this.checkMaintenance()],
        ["quality", () => this.checkQuality()],
        ["purchase", () => this.checkPurchase()],
        ["dispatch", () => this.checkDispatch()],
        ["production", () => this.checkProduction()],
        ["attendance", () => this.checkAttendance()]
      ];

      checks.forEach(([name, callback]) => {
        try {
          results[name] = callback();
        } catch (error) {
          console.error("Notification check failed:", name, error);
          results[name] = null;
        }
      });

      this.save();
      this.render();

      return results;
    },

    /* =====================================
       FILTER
    ====================================== */

    filter(filters = {}) {
      return this.getActive().filter(n => {
        if (filters.category &&
            n.category !== filters.category) return false;

        if (filters.priority &&
            n.priority !== filters.priority) return false;

        if (filters.read === true && !n.read) return false;
        if (filters.read === false && n.read) return false;

        return true;
      });
    },

    /* =====================================
       RENDER NOTIFICATION CENTRE
    ====================================== */

    render() {
      const container = document.getElementById(
        "notification-container"
      );

      if (!container) return;

      const records = this.getActive();
      const summary = this.getSummary();

      if (!records.length) {
        container.innerHTML = `
          <div class="notification-empty">
            <h3>All Clear!</h3>
            <p>No active ERP notifications.</p>
          </div>
        `;
        return;
      }

      const rows = records.map(n => `
        <div class="notification-item">
          <div class="notification-header">
            <strong>${this.escape(n.title)}</strong>
            <span>${this.escape(n.priority)}</span>
          </div>

          <p>${this.escape(n.message)}</p>

          <small>
            ${this.escape(n.category)} |
            ${this.escape(new Date(n.createdAt).toLocaleString())}
          </small>

          <div class="notification-actions">
            <button
              type="button"
              data-notification-action="read"
              data-id="${this.escape(n.id)}"
              ${n.read ? "disabled" : ""}
            >
              ${n.read ? "Read" : "Mark Read"}
            </button>

            <button
              type="button"
              data-notification-action="dismiss"
              data-id="${this.escape(n.id)}"
            >
              Dismiss
            </button>
          </div>
        </div>
      `).join("");

      container.innerHTML = `
        <div class="notification-summary">
          <p>Total: ${summary.total}</p>
          <p>Unread: ${summary.unread}</p>
          <p>Critical: ${summary.critical}</p>
          <p>High: ${summary.high}</p>
        </div>

        <button type="button" id="notification-mark-all">
          Mark All Read
        </button>

        ${rows}
      `;

      container.querySelectorAll("[data-notification-action]")
        .forEach(button => {
          button.addEventListener("click", () => {
            const action = button.dataset.notificationAction;
            const id = button.dataset.id;

            if (action === "read") this.markRead(id);
            if (action === "dismiss") this.dismiss(id);
          });
        });

      const markAll = container.querySelector(
        "#notification-mark-all"
      );

      if (markAll) {
        markAll.addEventListener("click", () => this.markAllRead());
      }
    },

    initialize() {
      this.load();
      this.render();

      console.log("CapMan Notification Centre initialized.");
    }
  };

  window.CapManNotifications = Notifications;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      Notifications.initialize();
    });
  } else {
    Notifications.initialize();
  }

})();
      
