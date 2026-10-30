
/* =========================================================
   CAPMAN ERP - COSTING REPORTS & ANALYSIS
   File: costing-reports.js

   Features:
   - Product-wise cost analysis
   - Department-wise cost
   - Batch-wise cost
   - Cost per piece / 1000 pieces
   - Rejection analysis
   - Selling price and margin
   - Cost comparison
   - CSV export

   IMPORTANT:
   This module analyses manually recorded costing data.
   It does not automatically post financial transactions.
========================================================= */

(function () {
  "use strict";

  const KEYS = {
    records: "capman_cost_analysis_records",
    budgets: "capman_cost_analysis_budgets"
  };

  const read = key => {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (error) {
      console.error("Costing report storage error:", error);
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

  const CostReports = {

    /* =====================================
       DATA ACCESS
    ===================================== */

    getAll() {
      return read(KEYS.records);
    },

    getBudgets() {
      return read(KEYS.budgets);
    },

    getById(recordId) {
      return this.getAll().find(
        item => item.id === recordId
      ) || null;
    },

    /* =====================================
       COST VALIDATION
    ===================================== */

    validateCostData(data) {
      if (!data.productCode) {
        throw new Error("Product code is required.");
      }

      if (!data.batchNumber) {
        throw new Error("Production batch number is required.");
      }

      if (!data.department) {
        throw new Error("Department is required.");
      }

      if (!data.uom) {
        throw new Error("Output UOM is required.");
      }

      const produced = num(data.producedQty);
      const rejected = num(data.rejectedQty);

      if (
        produced <= 0 ||
        rejected < 0 ||
        rejected > produced
      ) {
        throw new Error("Invalid production quantities.");
      }

      const costFields = [
        "rawMaterialCost",
        "masterbatchCost",
        "machineCost",
        "labourCost",
        "electricityCost",
        "overheadCost",
        "packingCost",
        "otherCost"
      ];

      costFields.forEach(field => {
        if (num(data[field]) < 0) {
          throw new Error(field + " cannot be negative.");
        }
      });

      if (num(data.scrapRecovery) < 0) {
        throw new Error("Scrap recovery cannot be negative.");
      }

      if (num(data.scrapRecovery) >
          num(data.rawMaterialCost) +
          num(data.masterbatchCost)) {
        throw new Error(
          "Scrap recovery cannot exceed material cost."
        );
      }

      return true;
    },

    /* =====================================
       CALCULATE PRODUCTION COST
    ===================================== */

    calculate(data) {
      this.validateCostData(data);

      const produced = num(data.producedQty);
      const rejected = num(data.rejectedQty);
      const good = produced - rejected;

      const raw = num(data.rawMaterialCost);
      const masterbatch = num(data.masterbatchCost);
      const machine = num(data.machineCost);
      const labour = num(data.labourCost);
      const electricity = num(data.electricityCost);
      const overhead = num(data.overheadCost);
      const packing = num(data.packingCost);
      const other = num(data.otherCost);
      const scrap = num(data.scrapRecovery);

      const materialCost = raw + masterbatch;

      const conversionCost =
        machine + labour + electricity + overhead;

      const grossCost =
        materialCost + conversionCost + packing + other;

      const netCost = grossCost - scrap;

      const costPerGoodUnit =
        good > 0 ? netCost / good : 0;

      const sellingPrice = num(data.sellingPrice);

      const revenue = good * sellingPrice;

      const profit = revenue - netCost;

      const margin = revenue > 0
        ? (profit / revenue) * 100
        : 0;

      return {
        productCode: data.productCode,
        batchNumber: data.batchNumber,
        department: data.department,
        producedQty: produced,
        rejectedQty: rejected,
        goodQty: good,
        uom: data.uom,

        rawMaterialCost: raw,
        masterbatchCost: masterbatch,
        materialCost,
        machineCost: machine,
        labourCost: labour,
        electricityCost: electricity,
        overheadCost: overhead,
        conversionCost,
        packingCost: packing,
        otherCost: other,
        scrapRecovery: scrap,

        grossCost,
        netCost,
        costPerGoodUnit,
        costPer1000: costPerGoodUnit * 1000,

        sellingPricePerUnit: sellingPrice,
        salesRevenue: revenue,
        estimatedProfit: profit,
        profitMargin: margin,

        calculatedAt: new Date().toISOString()
      };
    },

    /* =====================================
       SAVE COST RECORD
    ===================================== */

    createRecord(data) {
      const calculation = this.calculate(data);

      const records = this.getAll();

      const duplicate = records.some(item =>
        item.batchNumber === calculation.batchNumber &&
        item.productCode === calculation.productCode &&
        item.status !== "Cancelled"
      );

      if (duplicate) {
        throw new Error(
          "Cost record already exists for this product batch."
        );
      }

      const record = {
        id: makeId("COST"),
        ...calculation,
        remarks: data.remarks || "",
        createdBy: data.createdBy || "System",
        status: "Draft"
      };

      records.push(record);
      save(KEYS.records, records);

      return record;
    },

    /* =====================================
       APPROVE COST RECORD
    ===================================== */

    approveRecord(recordId, approvedBy) {
      const records = this.getAll();
      const index = records.findIndex(
        item => item.id === recordId
      );

      if (index === -1) {
        throw new Error("Cost record not found.");
      }

      if (records[index].status !== "Draft") {
        throw new Error("Only draft cost records can be approved.");
      }

      if (!approvedBy) {
        throw new Error("Approver name is required.");
      }

      records[index].status = "Approved";
      records[index].approvedBy = approvedBy;
      records[index].approvedAt = new Date().toISOString();

      save(KEYS.records, records);
      return records[index];
    },

    /* =====================================
       CANCEL COST RECORD
    ===================================== */

    cancelRecord(recordId, reason) {
      const records = this.getAll();
      const index = records.findIndex(
        item => item.id === recordId
      );

      if (index === -1) {
        throw new Error("Cost record not found.");
      }

      if (records[index].status === "Cancelled") {
        throw new Error("Record is already cancelled.");
      }

      if (!reason || !reason.trim()) {
        throw new Error("Cancellation reason is required.");
      }

      records[index].status = "Cancelled";
      records[index].cancelReason = reason;
      records[index].cancelledAt = new Date().toISOString();

      save(KEYS.records, records);
      return records[index];
    },

    /* =====================================
       PRODUCT COST HISTORY
    ===================================== */

    getProductHistory(productCode) {
      return this.getAll().filter(item =>
        item.productCode === productCode &&
        item.status === "Approved"
      );
    },

    getBatchCost(batchNumber) {
      return this.getAll().filter(item =>
        item.batchNumber === batchNumber
      );
    },

    /* =====================================
       DEPARTMENT COST REPORT
    ===================================== */

    getDepartmentReport() {
      const records = this.getAll().filter(
        item => item.status === "Approved"
      );

      const report = {};

      records.forEach(item => {
        if (!report[item.department]) {
          report[item.department] = {
            department: item.department,
            batchCount: 0,
            producedQty: 0,
            goodQty: 0,
            rejectedQty: 0,
            totalCost: 0
          };
        }

        const row = report[item.department];

        row.batchCount++;
        row.producedQty += item.producedQty;
        row.goodQty += item.goodQty;
        row.rejectedQty += item.rejectedQty;
        row.totalCost += item.netCost;
      });

      return Object.values(report).map(row => ({
        ...row,
        costPerGoodUnit: row.goodQty > 0
          ? row.totalCost / row.goodQty
          : 0,
        rejectionRate: row.producedQty > 0
          ? (row.rejectedQty / row.producedQty) * 100
          : 0
      }));
    },

    /* =====================================
       PRODUCT-WISE COST REPORT
    ===================================== */

    getProductReport() {
      const records = this.getAll().filter(
        item => item.status === "Approved"
      );

      const report = {};

      records.forEach(item => {
        if (!report[item.productCode]) {
          report[item.productCode] = {
            productCode: item.productCode,
            batchCount: 0,
            producedQty: 0,
            goodQty: 0,
            rejectedQty: 0,
            totalCost: 0,
            totalRevenue: 0,
            totalProfit: 0
          };
        }

        const row = report[item.productCode];

        row.batchCount++;
        row.producedQty += item.producedQty;
        row.goodQty += item.goodQty;
        row.rejectedQty += item.rejectedQty;
        row.totalCost += item.netCost;
        row.totalRevenue += item.salesRevenue;
        row.totalProfit += item.estimatedProfit;
      });

      return Object.values(report).map(row => ({
        ...row,
        averageCostPerGoodUnit: row.goodQty > 0
          ? row.totalCost / row.goodQty
          : 0,
        rejectionRate: row.producedQty > 0
          ? (row.rejectedQty / row.producedQty) * 100
          : 0
      }));
    },

    /* =====================================
       REJECTION COST REPORT
    ===================================== */

    getRejectionReport() {
      return this.getAll()
        .filter(item => item.status === "Approved")
        .map(item => {
          const rejectionRate = item.producedQty > 0
            ? (item.rejectedQty / item.producedQty) * 100
            : 0;

          return {
            productCode: item.productCode,
            batchNumber: item.batchNumber,
            producedQty: item.producedQty,
            rejectedQty: item.rejectedQty,
            goodQty: item.goodQty,
            rejectionRate,
            netBatchCost: item.netCost,
            effectiveCostPerGoodUnit: item.costPerGoodUnit
          };
        });
    },

    /* =====================================
       COST BUDGET MASTER
    ===================================== */

    createBudget(data) {
      if (!data.productCode || !data.uom) {
        throw new Error("Product code and UOM are required.");
      }

      const budgetQty = num(data.budgetQty);
      const budgetCost = num(data.budgetCost);

      if (budgetQty <= 0 || budgetCost < 0) {
        throw new Error("Invalid budget values.");
      }

      const budgets = this.getBudgets();

      const budget = {
        id: makeId("BUD"),
        productCode: data.productCode,
        department: data.department || "",
        budgetQty,
        budgetCost,
        uom: data.uom,
        costPerUnit: budgetCost / budgetQty,
        financialYear: data.financialYear || "",
        createdAt: new Date().toISOString(),
        status: "Active"
      };

      budgets.push(budget);
      save(KEYS.budgets, budgets);

      return budget;
    },

    /* =====================================
       BUDGET VS ACTUAL
    ===================================== */

    getBudgetVariance() {
      const budgets = this.getBudgets();
      const records = this.getAll().filter(
        item => item.status === "Approved"
      );

      return budgets.map(budget => {
        const matching = records.filter(item =>
          item.productCode === budget.productCode &&
          (!budget.department ||
            item.department === budget.department)
        );

        const actualCost = matching.reduce(
          (sum, item) => sum + item.netCost, 0
        );

        const actualQty = matching.reduce(
          (sum, item) => sum + item.goodQty, 0
        );

        const budgetedCost = actualQty * budget.costPerUnit;

        return {
          productCode: budget.productCode,
          department: budget.department,
          budgetedCost,
          actualCost,
          variance: actualCost - budgetedCost,
          actualQty,
          budgetQty: budget.budgetQty,
          budgetCost: budget.budgetCost
        };
      });
    },

    /* =====================================
       MANAGEMENT SUMMARY
    ===================================== */

    getSummary() {
      const records = this.getAll().filter(
        item => item.status === "Approved"
      );

      return {
        totalCostRecords: this.getAll().length,
        approvedRecords: records.length,
        totalProducedQty: records.reduce(
          (sum, item) => sum + item.producedQty, 0
        ),
        totalGoodQty: records.reduce(
          (sum, item) => sum + item.goodQty, 0
        ),
        totalRejectedQty: records.reduce(
          (sum, item) => sum + item.rejectedQty, 0
        ),
        totalManufacturingCost: records.reduce(
          (sum, item) => sum + item.netCost, 0
        ),
        totalRevenue: records.reduce(
          (sum, item) => sum + item.salesRevenue, 0
        ),
        totalEstimatedProfit: records.reduce(
          (sum, item) => sum + item.estimatedProfit, 0
        )
      };
    },

    /* =====================================
       CSV EXPORT
    ===================================== */

    exportCSV() {
      const records = this.getAll();

      const columns = [
        "productCode",
        "batchNumber",
        "department",
        "producedQty",
        "rejectedQty",
        "goodQty",
        "materialCost",
        "conversionCost",
        "packingCost",
        "otherCost",
        "scrapRecovery",
        "netCost",
        "costPerGoodUnit",
        "costPer1000",
        "salesRevenue",
        "estimatedProfit",
        "profitMargin",
        "status"
      ];

      const quote = value =>
        '"' + String(value ?? "").replace(/"/g, '""') + '"';

      const csv = [
        columns.join(","),
        ...records.map(item =>
          columns.map(column => quote(item[column])).join(",")
        )
      ].join("\n");

      const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
      );

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = "capman-cost-analysis.csv";
      anchor.click();

      URL.revokeObjectURL(url);
    },

    /* =====================================
       RENDER COST TABLE
    ===================================== */

    render(containerId = "cost-analysis-container") {
      const container = document.getElementById(containerId);
      if (!container) return;

      const records = this.getAll();

      if (!records.length) {
        container.innerHTML = "<p>No cost records available.</p>";
        return;
      }

      container.innerHTML = `
        <div class="table-responsive">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Batch</th>
                <th>Department</th>
                <th>Good Qty</th>
                <th>Material Cost</th>
                <th>Conversion Cost</th>
                <th>Net Cost</th>
                <th>Cost / Unit</th>
                <th>Margin %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(item => `
                <tr>
                  <td>${escapeHTML(item.productCode)}</td>
                  <td>${escapeHTML(item.batchNumber)}</td>
                  <td>${escapeHTML(item.department)}</td>
                  <td>${item.goodQty}</td>
                  <td>${item.materialCost.toFixed(2)}</td>
                  <td>${item.conversionCost.toFixed(2)}</td>
                  <td>${item.netCost.toFixed(2)}</td>
                  <td>${item.costPerGoodUnit.toFixed(4)}</td>
                  <td>${item.profitMargin.toFixed(2)}%</td>
                  <td>${escapeHTML(item.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    },

    initialize() {
      this.render();
      console.log("CapMan Cost Reports initialized.");
    }
  };

  window.CapManCostReports = CostReports;

})();
