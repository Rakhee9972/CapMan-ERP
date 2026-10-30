
/* =========================================================
   CAPMAN ERP - AUDIT TRAIL & TRANSACTION CONTROL
   File: audit.js

   Features:
   - User Activity Log
   - Transaction Audit
   - Create / Update / Approve / Cancel History
   - Stock Adjustment Audit
   - Production Change History
   - Date-wise Audit Search
   - CSV Export

   Prototype: LocalStorage-based

   IMPORTANT:
   Browser LocalStorage logs can be edited or deleted.
   This is not a tamper-proof audit system.
   A real ERP requires server-side audit logging.
========================================================= */

(function () {
  "use strict";

  const AUDIT_KEY = "capman_erp_audit_logs";
  const APPROVAL_KEY = "capman_erp_approvals";

  const Audit = {
    logs: [],
    approvals: [],

    load() {
      try {
        this.logs =
          JSON.parse(localStorage.getItem(AUDIT_KEY)) || [];

        this.approvals =
          JSON.parse(localStorage.getItem(APPROVAL_KEY)) || [];
      } catch (error) {
        console.error("Audit loading error:", error);
        this.logs = [];
        this.approvals = [];
      }
    },

    save() {
      localStorage.setItem(AUDIT_KEY, JSON.stringify(this.logs));
      localStorage.setItem(
        APPROVAL_KEY,
        JSON.stringify(this.approvals)
      );
    },

    id(prefix) {
      return prefix + "-" + Date.now() + "-" +
        Math.floor(Math.random() * 10000);
    },

    /* =====================================
       COMMON AUDIT LOG
    ====================================== */

    log(data) {
      if (!data.action || !data.module) {
        throw new Error("Action and module are required.");
      }

      const record = {
        id: this.id("AUDIT"),
        timestamp: new Date().toISOString(),
        userId: data.userId || "SYSTEM",
        username: data.username || "System",
        module: data.module,
        action: data.action,
        transactionType: data.transactionType || "",
        transactionId: data.transactionId || "",
        referenceNo: data.referenceNo || "",
        description: data.description || "",
        oldValue: data.oldValue ?? null,
        newValue: data.newValue ?? null,
        status: data.status || "Recorded",
        ipAddress: "Not available in browser prototype"
      };

      this.logs.push(record);
      this.save();

      return record;
    },

    /* =====================================
       TRANSACTION AUDIT
    ====================================== */

    recordCreate(data) {
      return this.log({
        ...data,
        action: "CREATE",
        description: data.description || "Record created"
      });
    },

    recordUpdate(data) {
      return this.log({
        ...data,
        action: "UPDATE",
        description: data.description || "Record updated"
      });
    },

    recordDelete(data) {
      return this.log({
        ...data,
        action: "DELETE",
        description: data.description || "Record deleted"
      });
    },

    recordApproval(data) {
      return this.log({
        ...data,
        action: "APPROVE",
        description: data.description || "Transaction approved"
      });
    },

    recordRejection(data) {
      return this.log({
        ...data,
        action: "REJECT",
        description: data.description || "Transaction rejected"
      });
    },

    recordCancellation(data) {
      return this.log({
        ...data,
        action: "CANCEL",
        description: data.description || "Transaction cancelled"
      });
    },

    /* =====================================
       STOCK AUDIT
    ====================================== */

    recordStockAdjustment(data) {
      if (!data.materialCode || data.quantity === undefined) {
        throw new Error(
          "Material code and adjustment quantity are required."
        );
      }

      return this.log({
        module: "INVENTORY",
        action: "STOCK_ADJUSTMENT",
        transactionType: "Inventory Adjustment",
        transactionId: data.transactionId || "",
        referenceNo: data.referenceNo || "",
        description: data.reason || "Stock adjustment recorded",
        oldValue: {
          stock: data.oldStock ?? null
        },
        newValue: {
          stock: data.newStock ?? null,
          adjustmentQuantity: data.quantity,
          materialCode: data.materialCode
        },
        userId: data.userId,
        username: data.username
      });
    },

    /* =====================================
       PRODUCTION AUDIT
    ====================================== */

    recordProductionChange(data) {
      if (!data.productionEntryId) {
        throw new Error("Production entry ID is required.");
      }

      return this.log({
        module: "PRODUCTION",
        action: "PRODUCTION_UPDATE",
        transactionType: "Production Entry",
        transactionId: data.productionEntryId,
        referenceNo: data.machineCode || "",
        description: data.reason || "Production entry modified",
        oldValue: data.oldValue || null,
        newValue: data.newValue || null,
        userId: data.userId,
        username: data.username
      });
    },

    /* =====================================
       APPROVAL WORKFLOW
    ====================================== */

    submitForApproval(data) {
      if (!data.module || !data.transactionId) {
        throw new Error("Module and transaction ID are required.");
      }

      const approval = {
        id: this.id("APR"),
        module: data.module,
        transactionId: data.transactionId,
        referenceNo: data.referenceNo || "",
        requestedBy: data.requestedBy || "System",
        requestedAt: new Date().toISOString(),
        approvedBy: "",
        approvedAt: null,
        rejectionReason: "",
        status: "Pending"
      };

      this.approvals.push(approval);
      this.save();

      this.log({
        module: data.module,
        action: "SUBMITTED_FOR_APPROVAL",
        transactionId: data.transactionId,
        referenceNo: data.referenceNo,
        description: "Transaction submitted for approval",
        username: data.requestedBy
      });

      return approval;
    },

    processApproval(approvalId, decision, data = {}) {
      const approval = this.approvals.find(
        a => a.id === approvalId
      );

      if (!approval) throw new Error("Approval request not found.");

      if (approval.status !== "Pending") {
        throw new Error("Approval request has already been processed.");
      }

      if (!["Approved", "Rejected"].includes(decision)) {
        throw new Error("Invalid approval decision.");
      }

      approval.status = decision;
      approval.approvedBy = data.approvedBy || "Unknown";
      approval.approvedAt = new Date().toISOString();
      approval.rejectionReason = decision === "Rejected"
        ? (data.reason || "")
        : "";

      this.save();

      this.log({
        module: approval.module,
        action: decision.toUpperCase(),
        transactionId: approval.transactionId,
        referenceNo: approval.referenceNo,
        username: approval.approvedBy,
        description: decision === "Approved"
          ? "Approval completed"
          : "Approval rejected: " + approval.rejectionReason
      });

      return approval;
    },

    getPendingApprovals() {
      return this.approvals.filter(
        a => a.status === "Pending"
      );
    },

    /* =====================================
       AUDIT SEARCH
    ====================================== */

    search(filters = {}) {
      return this.logs.filter(log => {
        if (filters.module &&
            log.module !== filters.module) return false;

        if (filters.action &&
            log.action !== filters.action) return false;

        if (filters.username &&
            log.username !== filters.username) return false;

        if (filters.transactionId &&
            log.transactionId !== filters.transactionId) return false;

        if (filters.fromDate &&
            log.timestamp.slice(0, 10) < filters.fromDate) return false;

        if (filters.toDate &&
            log.timestamp.slice(0, 10) > filters.toDate) return false;

        return true;
      }).sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
      );
    },

    getTransactionHistory(transactionId) {
      return this.logs.filter(
        log => log.transactionId === transactionId
      ).sort((a, b) =>
        new Date(a.timestamp) - new Date(b.timestamp)
      );
    },

    getUserHistory(username) {
      return this.logs.filter(
        log => log.username === username
      ).sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
      );
    },

    /* =====================================
       AUDIT SUMMARY
    ====================================== */

    getSummary() {
      return {
        totalLogs: this.logs.length,

        createActions: this.logs.filter(
          l => l.action === "CREATE"
        ).length,

        updateActions: this.logs.filter(
          l => l.action === "UPDATE"
        ).length,

        deleteActions: this.logs.filter(
          l => l.action === "DELETE"
        ).length,

        approvalActions: this.logs.filter(
          l => l.action === "APPROVE"
        ).length,

        rejectionActions: this.logs.filter(
          l => l.action === "REJECT"
        ).length,

        cancellationActions: this.logs.filter(
          l => l.action === "CANCEL"
        ).length,

        pendingApprovals: this.getPendingApprovals().length
      };
    },

    /* =====================================
       CSV EXPORT
    ====================================== */

    downloadCSV(filename = "capman-audit-report.csv") {
      const rows = this.logs;

      if (!rows.length) {
        throw new Error("No audit records available.");
      }

      const columns = [
        "timestamp",
        "username",
        "module",
        "action",
        "transactionType",
        "transactionId",
        "referenceNo",
        "description",
        "status"
      ];

      const escapeCSV = value => {
        const text = String(value ?? "");
        return '"' + text.replace(/"/g, '""') + '"';
      };

      const csv = [
        columns.map(escapeCSV).join(","),
        ...rows.map(row =>
          columns.map(key => escapeCSV(row[key])).join(",")
        )
      ].join("\r\n");

      const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;"
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    },

    /* =====================================
       TABLE RENDERING
    ====================================== */

    escape(value) {
      return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);
    },

    render() {
      const container = document.getElementById(
        "audit-table-container"
      );

      if (!container) return;

      if (!this.logs.length) {
        container.innerHTML = "<p>No audit history available.</p>";
        return;
      }

      const rows = this.search().map(log => `
        <tr>
          <td>${this.escape(log.timestamp)}</td>
          <td>${this.escape(log.username)}</td>
          <td>${this.escape(log.module)}</td>
          <td>${this.escape(log.action)}</td>
          <td>${this.escape(log.transactionId)}</td>
          <td>${this.escape(log.description)}</td>
        </tr>
      `).join("");

      container.innerHTML = `
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>User</th>
                <th>Module</th>
                <th>Action</th>
                <th>Transaction ID</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    },

    initialize() {
      this.load();
      this.render();

      console.log("CapMan Audit module initialized.");
    }
  };

  window.CapManAudit = Audit;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      Audit.initialize();
    });
  } else {
    Audit.initialize();
  }

})();
    
