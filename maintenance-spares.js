
/* =========================================================
   CAPMAN ERP - MAINTENANCE SPARE PARTS
   File: maintenance-spares.js

   Features:
   - Spare parts master
   - Machine mapping
   - Stock receipt
   - Spare issue to maintenance
   - Spare return
   - Reorder alerts
   - Consumption history

   IMPORTANT:
   Standalone localStorage prototype.
   Inventory integration will be completed later.
========================================================= */

(function () {
  "use strict";

  const KEYS = {
    parts: "capman_maintenance_spares",
    transactions: "capman_spare_transactions",
    machineMapping: "capman_spare_machine_mapping"
  };

  const read = key => {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (error) {
      console.error("Spare parts storage error:", error);
      return [];
    }
  };

  const save = (key, data) =>
    localStorage.setItem(key, JSON.stringify(data));

  const num = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const makeId = prefix =>
    prefix + "-" +
    Date.now().toString(36).toUpperCase() +
    "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);

  const Spares = {

    /* =====================================
       SPARE PART MASTER
    ===================================== */

    getAll() {
      return read(KEYS.parts);
    },

    getByCode(code) {
      return this.getAll().find(
        item => item.partCode === code
      ) || null;
    },

    createPart(data) {
      if (!data.partCode || !data.partName || !data.uom) {
        throw new Error(
          "Part code, name and UOM are required."
        );
      }

      const parts = this.getAll();

      if (parts.some(item => item.partCode === data.partCode)) {
        throw new Error("Spare part code already exists.");
      }

      const openingStock = num(data.openingStock);
      const minimumStock = num(data.minimumStock);

      if (openingStock < 0 || minimumStock < 0) {
        throw new Error("Stock quantities cannot be negative.");
      }

      const part = {
        id: makeId("SP"),
        partCode: data.partCode.trim().toUpperCase(),
        partName: data.partName.trim(),
        category: data.category || "General",
        uom: data.uom,
        openingStock,
        currentStock: openingStock,
        minimumStock,
        reorderQuantity: num(data.reorderQuantity),
        location: data.location || "",
        supplierName: data.supplierName || "",
        unitCost: num(data.unitCost),
        active: true,
        createdAt: new Date().toISOString()
      };

      parts.push(part);
      save(KEYS.parts, parts);

      if (openingStock > 0) {
        this.addTransaction({
          partCode: part.partCode,
          type: "Opening Stock",
          quantity: openingStock,
          reference: "OPENING",
          remarks: "Initial spare parts stock"
        });
      }

      return part;
    },

    updatePart(partCode, changes) {
      const parts = this.getAll();
      const index = parts.findIndex(
        item => item.partCode === partCode
      );

      if (index === -1) {
        throw new Error("Spare part not found.");
      }

      const allowed = [
        "partName",
        "category",
        "minimumStock",
        "reorderQuantity",
        "location",
        "supplierName",
        "unitCost",
        "active"
      ];

      allowed.forEach(key => {
        if (changes[key] !== undefined) {
          parts[index][key] = changes[key];
        }
      });

      if (
        num(parts[index].minimumStock) < 0 ||
        num(parts[index].unitCost) < 0 ||
        num(parts[index].reorderQuantity) < 0
      ) {
        throw new Error("Values cannot be negative.");
      }

      parts[index].updatedAt = new Date().toISOString();

      save(KEYS.parts, parts);
      return parts[index];
    },

    /* =====================================
       STOCK TRANSACTIONS
    ===================================== */

    getTransactions() {
      return read(KEYS.transactions);
    },

    addTransaction(data) {
      const transactions = this.getTransactions();

      const transaction = {
        id: makeId("SPT"),
        partCode: data.partCode,
        type: data.type,
        quantity: num(data.quantity),
        reference: data.reference || "",
        machineCode: data.machineCode || "",
        maintenanceWorkOrder: data.maintenanceWorkOrder || "",
        recordedBy: data.recordedBy || "System",
        date: new Date().toISOString(),
        remarks: data.remarks || ""
      };

      transactions.push(transaction);
      save(KEYS.transactions, transactions);

      return transaction;
    },

    /* =====================================
       STOCK RECEIPT
    ===================================== */

    receiveStock(data) {
      const parts = this.getAll();
      const index = parts.findIndex(
        item => item.partCode === data.partCode
      );

      if (index === -1) {
        throw new Error("Spare part not found.");
      }

      const quantity = num(data.quantity);

      if (quantity <= 0) {
        throw new Error("Receipt quantity must be positive.");
      }

      if (!data.reference) {
        throw new Error("Receipt reference is required.");
      }

      parts[index].currentStock += quantity;
      parts[index].updatedAt = new Date().toISOString();

      save(KEYS.parts, parts);

      this.addTransaction({
        partCode: data.partCode,
        type: "Receipt",
        quantity,
        reference: data.reference,
        remarks: data.remarks || "",
        recordedBy: data.recordedBy
      });

      return parts[index];
    },

    /* =====================================
       MACHINE MAPPING
    ===================================== */

    getMachineMappings() {
      return read(KEYS.machineMapping);
    },

    mapPartToMachine(data) {
      if (!this.getByCode(data.partCode)) {
        throw new Error("Spare part does not exist.");
      }

      if (!data.machineCode) {
        throw new Error("Machine code is required.");
      }

      const mappings = this.getMachineMappings();

      const duplicate = mappings.some(item =>
        item.partCode === data.partCode &&
        item.machineCode === data.machineCode
      );

      if (duplicate) {
        throw new Error("This part is already mapped to the machine.");
      }

      const mapping = {
        id: makeId("MAP"),
        partCode: data.partCode,
        machineCode: data.machineCode,
        department: data.department || "",
        criticality: data.criticality || "Normal",
        quantityPerMachine: num(data.quantityPerMachine),
        remarks: data.remarks || "",
        createdAt: new Date().toISOString()
      };

      mappings.push(mapping);
      save(KEYS.machineMapping, mappings);

      return mapping;
    },

    getPartsByMachine(machineCode) {
      return this.getMachineMappings()
        .filter(item => item.machineCode === machineCode)
        .map(mapping => ({
          ...mapping,
          part: this.getByCode(mapping.partCode)
        }));
    },

    /* =====================================
       ISSUE SPARES TO MAINTENANCE
    ===================================== */

    issueSpare(data) {
      const parts = this.getAll();
      const index = parts.findIndex(
        item => item.partCode === data.partCode
      );

      if (index === -1) {
        throw new Error("Spare part not found.");
      }

      if (!data.maintenanceWorkOrder) {
        throw new Error("Maintenance work order is required.");
      }

      if (!data.machineCode) {
        throw new Error("Machine code is required.");
      }

      const quantity = num(data.quantity);

      if (quantity <= 0) {
        throw new Error("Issue quantity must be positive.");
      }

      if (parts[index].currentStock < quantity) {
        throw new Error("Insufficient spare parts stock.");
      }

      parts[index].currentStock -= quantity;
      parts[index].updatedAt = new Date().toISOString();

      save(KEYS.parts, parts);

      this.addTransaction({
        partCode: data.partCode,
        type: "Issue",
        quantity,
        machineCode: data.machineCode,
        maintenanceWorkOrder: data.maintenanceWorkOrder,
        reference: data.reference || data.maintenanceWorkOrder,
        remarks: data.remarks || "",
        recordedBy: data.recordedBy
      });

      return parts[index];
    },

    /* =====================================
       RETURN UNUSED SPARES
    ===================================== */

    returnSpare(data) {
      const parts = this.getAll();
      const index = parts.findIndex(
        item => item.partCode === data.partCode
      );

      if (index === -1) {
        throw new Error("Spare part not found.");
      }

      const quantity = num(data.quantity);

      if (quantity <= 0) {
        throw new Error("Return quantity must be positive.");
      }

      if (!data.maintenanceWorkOrder) {
        throw new Error("Maintenance work order is required.");
      }

      const issued = this.getTransactions()
        .filter(item =>
          item.partCode === data.partCode &&
          item.maintenanceWorkOrder === data.maintenanceWorkOrder
        )
        .reduce((sum, item) => {
          if (item.type === "Issue") return sum + item.quantity;
          if (item.type === "Return") return sum - item.quantity;
          return sum;
        }, 0);

      if (quantity > issued) {
        throw new Error(
          "Return quantity exceeds net issued quantity."
        );
      }

      parts[index].currentStock += quantity;
      parts[index].updatedAt = new Date().toISOString();

      save(KEYS.parts, parts);

      this.addTransaction({
        partCode: data.partCode,
        type: "Return",
        quantity,
        machineCode: data.machineCode || "",
        maintenanceWorkOrder: data.maintenanceWorkOrder,
        reference: data.reference || data.maintenanceWorkOrder,
        remarks: data.remarks || "",
        recordedBy: data.recordedBy
      });

      return parts[index];
    },

    /* =====================================
       STOCK ADJUSTMENT
    ===================================== */

    adjustStock(data) {
      const parts = this.getAll();
      const index = parts.findIndex(
        item => item.partCode === data.partCode
      );

      if (index === -1) {
        throw new Error("Spare part not found.");
      }

      const difference = num(data.difference);

      if (difference === 0) {
        throw new Error("Adjustment quantity cannot be zero.");
      }

      if (!data.approvedBy || !data.reason) {
        throw new Error(
          "Approval and adjustment reason are required."
        );
      }

      const newStock = parts[index].currentStock + difference;

      if (newStock < 0) {
        throw new Error("Stock cannot become negative.");
      }

      parts[index].currentStock = newStock;
      parts[index].updatedAt = new Date().toISOString();

      save(KEYS.parts, parts);

      this.addTransaction({
        partCode: data.partCode,
        type: "Adjustment",
        quantity: Math.abs(difference),
        reference: data.reference || "STOCK-ADJUSTMENT",
        remarks:
          "Difference: " + difference +
          " | Approved by: " + data.approvedBy +
          " | Reason: " + data.reason
      });

      return parts[index];
    },

    /* =====================================
       LOW STOCK REPORT
    ===================================== */

    getLowStockReport() {
      return this.getAll().filter(item =>
        item.active !== false &&
        item.currentStock <= item.minimumStock
      );
    },

    /* =====================================
       PART CONSUMPTION REPORT
    ===================================== */

    getConsumptionReport() {
      const transactions = this.getTransactions();

      const report = {};

      transactions.forEach(item => {
        if (!report[item.partCode]) {
          report[item.partCode] = {
            partCode: item.partCode,
            issuedQty: 0,
            returnedQty: 0,
            netConsumption: 0
          };
        }

        if (item.type === "Issue") {
          report[item.partCode].issuedQty += item.quantity;
        }

        if (item.type === "Return") {
          report[item.partCode].returnedQty += item.quantity;
        }
      });

      Object.values(report).forEach(item => {
        item.netConsumption =
          item.issuedQty - item.returnedQty;
      });

      return Object.values(report);
    },

    /* =====================================
       SUMMARY
    ===================================== */

    getSummary() {
      const parts = this.getAll();
      const transactions = this.getTransactions();

      return {
        totalParts: parts.length,
        activeParts: parts.filter(
          item => item.active !== false
        ).length,
        totalStockValue: parts.reduce(
          (sum, item) =>
            sum + item.currentStock * item.unitCost,
          0
        ),
        lowStockItems: this.getLowStockReport().length,
        totalIssues: transactions.filter(
          item => item.type === "Issue"
        ).length,
        totalReceipts: transactions.filter(
          item => item.type === "Receipt"
        ).length,
        totalReturns: transactions.filter(
          item => item.type === "Return"
        ).length
      };
    },

    /* =====================================
       RENDER SPARE PART MASTER
    ===================================== */

    renderParts(containerId = "spare-parts-container") {
      const container = document.getElementById(containerId);
      if (!container) return;

      const parts = this.getAll();

      if (!parts.length) {
        container.innerHTML = "<p>No spare parts available.</p>";
        return;
      }

      container.innerHTML = `
        <div class="table-responsive">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Part Code</th>
                <th>Part Name</th>
                <th>Category</th>
                <th>UOM</th>
                <th>Current Stock</th>
                <th>Minimum Stock</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${parts.map(item => `
                <tr>
                  <td>${escapeHTML(item.partCode)}</td>
                  <td>${escapeHTML(item.partName)}</td>
                  <td>${escapeHTML(item.category)}</td>
                  <td>${escapeHTML(item.uom)}</td>
                  <td>${item.currentStock}</td>
                  <td>${item.minimumStock}</td>
                  <td>${escapeHTML(item.location)}</td>
                  <td>${item.active ? "Active" : "Inactive"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    },

    renderLowStock(containerId = "spare-low-stock-container") {
      const container = document.getElementById(containerId);
      if (!container) return;

      const items = this.getLowStockReport();

      if (!items.length) {
        container.innerHTML = "<p>No low-stock spare parts.</p>";
        return;
      }

      container.innerHTML = `
        <div class="table-responsive">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Part Code</th>
                <th>Part Name</th>
                <th>Current Stock</th>
                <th>Minimum Stock</th>
                <th>Reorder Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>${escapeHTML(item.partCode)}</td>
                  <td>${escapeHTML(item.partName)}</td>
                  <td>${item.currentStock}</td>
                  <td>${item.minimumStock}</td>
                  <td>${item.reorderQuantity}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    },

    renderAll() {
      this.renderParts();
      this.renderLowStock();
    },

    initialize() {
      this.renderAll();
      console.log("CapMan Spare Parts module initialized.");
    }
  };

  window.CapManSpares = Spares;

})();
        
