
/* =========================================================
   CAPMAN ERP - BACKUP & RESTORE
   File: backup.js

   Features:
   - Complete LocalStorage backup
   - JSON download
   - JSON restore
   - Backup validation
   - Module-wise export
   - Backup history

   IMPORTANT:
   - Browser local backup only.
   - This is not a cloud backup.
   - Restore replaces matching CapMan keys.
========================================================= */

(function () {
  "use strict";

  const HISTORY_KEY = "capman_backup_history";

  const MODULE_KEYS = {
    app: [
      "capman_machine_master",
      "capman_material_master",
      "capman_bom_master"
    ],

    sales: [
      "capman_customers",
      "capman_customer_orders"
    ],

    purchase: [
      "capman_suppliers",
      "capman_purchase_requisitions",
      "capman_purchase_orders"
    ],

    inventory: [
      "capman_inventory_stock",
      "capman_inventory_ledger"
    ],

    production: [
      "capman_production_entries"
    ],

    quality: [
      "capman_quality_inspections",
      "capman_quality_capa"
    ],

    maintenance: [
      "capman_maintenance_records",
      "capman_pm_schedules",
      "capman_maintenance_parts",
      "capman_maintenance_spares",
      "capman_spare_transactions",
      "capman_spare_machine_mapping"
    ],

    hr: [
      "capman_hr_employees",
      "capman_hr_attendance",
      "capman_hr_shifts",
      "capman_hr_machine_allocation"
    ],

    ppc: [
      "capman_ppc_plans",
      "capman_ppc_work_orders",
      "capman_ppc_schedule"
    ],

    grn: [
      "capman_grn_records",
      "capman_grn_lines",
      "capman_grn_qc_records"
    ],

    warehouse: [
      "capman_warehouses",
      "capman_warehouse_locations",
      "capman_warehouse_transfers",
      "capman_warehouse_movements"
    ],

    packing: [
      "capman_packing_orders",
      "capman_packing_records",
      "capman_packing_material_usage",
      "capman_packing_qc"
    ],

    costing: [
      "capman_costing_records",
      "capman_costing_rates",
      "capman_cost_analysis_records",
      "capman_cost_analysis_budgets"
    ],

    administration: [
      "capman_erp_settings",
      "capman_erp_departments",
      "capman_erp_uom",
      "capman_erp_shift_config",
      "capman_erp_roles",
      "capman_erp_document_series",
      "capman_erp_users",
      "capman_erp_user_activity",
      "capman_erp_audit_logs",
      "capman_erp_approvals",
      "capman_erp_notifications"
    ],

    traceability: [
      "capman_traceability_records",
      "capman_traceability_links"
    ],

    dispatch: [
      "capman_packing_orders",
      "capman_dispatch_records"
    ]
  };

  const readHistory = () => {
    try {
      return JSON.parse(
        localStorage.getItem(HISTORY_KEY)
      ) || [];
    } catch (error) {
      return [];
    }
  };

  const saveHistory = data => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(data.slice(-50))
    );
  };

  const makeId = () =>
    "BACKUP-" +
    Date.now().toString(36).toUpperCase();

  const Backup = {

    /* =====================================
       GET ALL CAPMAN KEYS
    ===================================== */

    getKnownKeys() {
      return [
        ...new Set(
          Object.values(MODULE_KEYS).flat()
        )
      ];
    },

    getExistingKeys() {
      return this.getKnownKeys().filter(key =>
        localStorage.getItem(key) !== null
      );
    },

    /* =====================================
       CREATE BACKUP OBJECT
    ===================================== */

    createBackupObject() {
      const data = {};

      this.getExistingKeys().forEach(key => {
        try {
          data[key] = JSON.parse(
            localStorage.getItem(key)
          );
        } catch (error) {
          throw new Error(
            "Cannot back up invalid JSON data: " + key
          );
        }
      });

      return {
        application: "CapMan ERP",
        backupVersion: 1,
        backupId: makeId(),
        createdAt: new Date().toISOString(),
        data
      };
    },

    /* =====================================
       DOWNLOAD COMPLETE BACKUP
    ===================================== */

    downloadBackup() {
      const backup = this.createBackupObject();

      const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: "application/json" }
      );

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download =
        "capman-erp-backup-" +
        new Date().toISOString().slice(0, 10) +
        ".json";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);

      this.addHistory({
        action: "Backup Download",
        backupId: backup.backupId,
        createdAt: backup.createdAt,
        keyCount: Object.keys(backup.data).length
      });

      return backup;
    },

    /* =====================================
       VALIDATE BACKUP FILE
    ===================================== */

    validateBackup(backup) {
      if (!backup || typeof backup !== "object") {
        throw new Error("Invalid backup file.");
      }

      if (backup.application !== "CapMan ERP") {
        throw new Error("This is not a CapMan ERP backup.");
      }

      if (!backup.data ||
          typeof backup.data !== "object" ||
          Array.isArray(backup.data)) {
        throw new Error("Backup data is missing or invalid.");
      }

      const allowedKeys = new Set(this.getKnownKeys());

      Object.keys(backup.data).forEach(key => {
        if (!allowedKeys.has(key)) {
          throw new Error(
            "Unknown ERP data key found: " + key
          );
        }

        const value = backup.data[key];

        if (
          value === undefined ||
          typeof value === "function"
        ) {
          throw new Error("Invalid backup data: " + key);
        }

        JSON.stringify(value);
      });

      return true;
    },

    /* =====================================
       READ BACKUP FILE
    ===================================== */

    async readBackupFile(file) {
      if (!file) {
        throw new Error("Select a backup file.");
      }

      if (!file.name.toLowerCase().endsWith(".json")) {
        throw new Error("Only JSON backup files are supported.");
      }

      const text = await file.text();

      let backup;

      try {
        backup = JSON.parse(text);
      } catch (error) {
        throw new Error("Backup file contains invalid JSON.");
      }

      this.validateBackup(backup);

      return backup;
    },

    /* =====================================
       RESTORE BACKUP
    ===================================== */

    restoreBackup(backup, options = {}) {
      this.validateBackup(backup);

      if (options.confirmed !== true) {
        throw new Error(
          "Explicit restore confirmation is required."
        );
      }

      const data = backup.data;
      const previousValues = {};
      const appliedKeys = [];

      try {
        Object.keys(data).forEach(key => {
          previousValues[key] = localStorage.getItem(key);

          localStorage.setItem(
            key,
            JSON.stringify(data[key])
          );

          appliedKeys.push(key);
        });
      } catch (error) {
        // Roll back keys already changed if restore fails.
        appliedKeys.forEach(key => {
          const previous = previousValues[key];

          if (previous === null) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, previous);
          }
        });

        throw new Error(
          "Restore failed. Previous values were restored where possible. " +
          error.message
        );
      }

      this.addHistory({
        action: "Backup Restored",
        backupId: backup.backupId || "Unknown",
        createdAt: new Date().toISOString(),
        keyCount: appliedKeys.length
      });

      return {
        success: true,
        restoredKeys: appliedKeys.length,
        message: "Backup data restored successfully."
      };
    },

    /* =====================================
       EXPORT INDIVIDUAL MODULE
    ===================================== */

    exportModule(moduleName) {
      const moduleKeys = MODULE_KEYS[moduleName];

      if (!moduleKeys) {
        throw new Error("Unknown module name.");
      }

      const data = {};

      moduleKeys.forEach(key => {
        const value = localStorage.getItem(key);

        if (value !== null) {
          data[key] = JSON.parse(value);
        }
      });

      const backup = {
        application: "CapMan ERP",
        backupType: "Module",
        moduleName,
        createdAt: new Date().toISOString(),
        data
      };

      const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: "application/json" }
      );

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download =
        "capman-" + moduleName + "-backup.json";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);

      return backup;
    },

    /* =====================================
       BACKUP HISTORY
    ===================================== */

    addHistory(record) {
      const history = readHistory();

      history.push({
        id: makeId(),
        ...record
      });

      saveHistory(history);
    },

    getHistory() {
      return readHistory().reverse();
    },

    clearHistory() {
      localStorage.removeItem(HISTORY_KEY);
    },

    /* =====================================
       BACKUP SUMMARY
    ===================================== */

    getSummary() {
      const keys = this.getExistingKeys();

      let totalBytes = 0;

      keys.forEach(key => {
        const value = localStorage.getItem(key);
        totalBytes += value ? value.length * 2 : 0;
      });

      return {
        totalKnownKeys: this.getKnownKeys().length,
        existingKeys: keys.length,
        estimatedSizeBytes: totalBytes,
        estimatedSizeKB: (totalBytes / 1024).toFixed(2),
        backupHistoryCount: readHistory().length,
        lastBackup: readHistory().slice(-1)[0] || null
      };
    },

    /* =====================================
       RENDER BACKUP HISTORY
    ===================================== */

    renderHistory(containerId = "backup-history-container") {
      const container = document.getElementById(containerId);
      if (!container) return;

      const history = this.getHistory();

      if (!history.length) {
        container.innerHTML = "<p>No backup history available.</p>";
        return;
      }

      container.innerHTML = `
        <div class="table-responsive">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Backup ID</th>
                <th>Date & Time</th>
                <th>Data Keys</th>
              </tr>
            </thead>
            <tbody>
              ${history.map(item => `
                <tr>
                  <td>${this.escape(item.action)}</td>
                  <td>${this.escape(item.backupId)}</td>
                  <td>${this.escape(item.createdAt)}</td>
                  <td>${item.keyCount || 0}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    },

    escape(value) {
      return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char]);
    },

    initialize() {
      this.renderHistory();
      console.log("CapMan Backup module initialized.");
    }
  };

  window.CapManBackup = Backup;

})();
    
