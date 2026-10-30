
/* =========================================================
   CAPMAN ERP - MANUFACTURING COSTING
   File: costing.js

   Features:
   - Raw Material Cost
   - Production Cost
   - Labour Cost
   - Electricity Cost
   - Rejection Cost
   - Packing Cost
   - Finished Product Cost
   - Cost Per 1000 Pieces
   - Selling Price & Profit Analysis

   Prototype: LocalStorage-based

   IMPORTANT:
   All rates and consumption values must be entered
   from verified company data. No assumed BOM quantities.
========================================================= */

(function () {
  "use strict";

  const COST_KEY = "capman_costing_records";
  const RATE_KEY = "capman_costing_rates";

  const Costing = {
    records: [],
    rates: [],

    load() {
      try {
        this.records =
          JSON.parse(localStorage.getItem(COST_KEY)) || [];

        this.rates =
          JSON.parse(localStorage.getItem(RATE_KEY)) || [];
      } catch (error) {
        console.error("Costing loading error:", error);
        this.records = [];
        this.rates = [];
      }
    },

    save() {
      localStorage.setItem(COST_KEY, JSON.stringify(this.records));
      localStorage.setItem(RATE_KEY, JSON.stringify(this.rates));
    },

    id(prefix) {
      return prefix + "-" + Date.now() + "-" +
        Math.floor(Math.random() * 10000);
    },

    number(value, fieldName) {
      const result = Number(value);

      if (!Number.isFinite(result) || result < 0) {
        throw new Error(
          fieldName + " must be a valid non-negative number."
        );
      }

      return result;
    },

    round(value, decimals = 4) {
      const factor = Math.pow(10, decimals);
      return Math.round(value * factor) / factor;
    },

    /* =====================================
       MATERIAL RATE MASTER
    ====================================== */

    setMaterialRate(data) {
      if (!data.materialCode || data.rate === undefined) {
        throw new Error("Material code and rate are required.");
      }

      const rate = this.number(data.rate, "Material rate");

      if (!data.unit) {
        throw new Error("Material unit is required.");
      }

      const existing = this.rates.find(
        r => r.materialCode === data.materialCode
      );

      if (existing) {
        existing.materialName = data.materialName ||
          existing.materialName;

        existing.rate = rate;
        existing.unit = data.unit;
        existing.effectiveDate = data.effectiveDate ||
          new Date().toISOString().slice(0, 10);

        existing.updatedAt = new Date().toISOString();

        this.save();
        return existing;
      }

      const record = {
        id: this.id("RATE"),
        materialCode: data.materialCode,
        materialName: data.materialName || "",
        rate,
        unit: data.unit,
        effectiveDate: data.effectiveDate ||
          new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString()
      };

      this.rates.push(record);
      this.save();

      return record;
    },

    getMaterialRate(materialCode) {
      return this.rates.find(
        r => r.materialCode === materialCode
      ) || null;
    },

    /* =====================================
       RAW MATERIAL COST
    ====================================== */

    calculateMaterialCost(materials) {
      if (!Array.isArray(materials) || !materials.length) {
        throw new Error("At least one material is required.");
      }

      const details = materials.map(material => {
        const quantity = this.number(
          material.quantity,
          "Material quantity"
        );

        const rate = material.rate !== undefined
          ? this.number(material.rate, "Material rate")
          : this.getMaterialRate(material.materialCode)?.rate;

        if (rate === undefined || rate === null) {
          throw new Error(
            "Rate not available for material: " +
            material.materialCode
          );
        }

        return {
          materialCode: material.materialCode,
          materialName: material.materialName || "",
          quantity,
          unit: material.unit || "",
          rate,
          amount: this.round(quantity * rate)
        };
      });

      return {
        details,
        totalMaterialCost: this.round(
          details.reduce((sum, item) => sum + item.amount, 0)
        )
      };
    },

    /* =====================================
       PRODUCTION COST
    ====================================== */

    calculateProductionCost(data) {
      const machineHours = this.number(
        data.machineHours || 0,
        "Machine hours"
      );

      const machineRate = this.number(
        data.machineRate || 0,
        "Machine hourly rate"
      );

      const labourHours = this.number(
        data.labourHours || 0,
        "Labour hours"
      );

      const labourRate = this.number(
        data.labourRate || 0,
        "Labour hourly rate"
      );

      const electricityUnits = this.number(
        data.electricityUnits || 0,
        "Electricity units"
      );

      const electricityRate = this.number(
        data.electricityRate || 0,
        "Electricity rate"
      );

      const overhead = this.number(
        data.overhead || 0,
        "Overhead"
      );

      const machineCost = machineHours * machineRate;
      const labourCost = labourHours * labourRate;
      const electricityCost = electricityUnits * electricityRate;

      return {
        machineHours,
        machineCost: this.round(machineCost),
        labourHours,
        labourCost: this.round(labourCost),
        electricityUnits,
        electricityCost: this.round(electricityCost),
        overhead: this.round(overhead),
        totalProductionCost: this.round(
          machineCost + labourCost + electricityCost + overhead
        )
      };
    },

    /* =====================================
       REJECTION COST
    ====================================== */

    calculateRejectionCost(data) {
      const rejectedQuantity = this.number(
        data.rejectedQuantity || 0,
        "Rejected quantity"
      );

      const costPerPiece = this.number(
        data.costPerPiece || 0,
        "Cost per piece"
      );

      const scrapRecovery = this.number(
        data.scrapRecovery || 0,
        "Scrap recovery"
      );

      const grossRejectionCost =
        rejectedQuantity * costPerPiece;

      const netRejectionCost = Math.max(
        0,
        grossRejectionCost - scrapRecovery
      );

      return {
        rejectedQuantity,
        grossRejectionCost: this.round(grossRejectionCost),
        scrapRecovery: this.round(scrapRecovery),
        netRejectionCost: this.round(netRejectionCost)
      };
    },

    /* =====================================
       PACKING COST
    ====================================== */

    calculatePackingCost(materials) {
      if (!Array.isArray(materials)) {
        throw new Error("Packing material list is required.");
      }

      const details = materials.map(item => {
        const quantity = this.number(
          item.quantity,
          "Packing quantity"
        );

        const rate = this.number(
          item.rate,
          "Packing rate"
        );

        return {
          materialCode: item.materialCode || "",
          materialName: item.materialName || "",
          quantity,
          unit: item.unit || "",
          rate,
          amount: this.round(quantity * rate)
        };
      });

      return {
        details,
        totalPackingCost: this.round(
          details.reduce((sum, item) => sum + item.amount, 0)
        )
      };
    },

    /* =====================================
       COMPLETE PRODUCT COST
    ====================================== */

    calculateProductCost(data) {
      if (!data.productCode) {
        throw new Error("Product code is required.");
      }

      const goodQuantity = this.number(
        data.goodQuantity,
        "Good quantity"
      );

      if (goodQuantity <= 0) {
        throw new Error("Good quantity must be greater than zero.");
      }

      const material = this.calculateMaterialCost(data.materials || []);

      const production = this.calculateProductionCost(
        data.production || {}
      );

      const rejection = this.calculateRejectionCost(
        data.rejection || {}
      );

      const packing = this.calculatePackingCost(
        data.packingMaterials || []
      );

      const additionalCost = this.number(
        data.additionalCost || 0,
        "Additional cost"
      );

      const totalCost =
        material.totalMaterialCost +
        production.totalProductionCost +
        rejection.netRejectionCost +
        packing.totalPackingCost +
        additionalCost;

      const costPerPiece = totalCost / goodQuantity;

      const costPer1000 = costPerPiece * 1000;

      const sellingPrice = this.number(
        data.sellingPrice || 0,
        "Selling price"
      );

      const salesValue = sellingPrice * goodQuantity;
      const profit = salesValue - totalCost;

      const margin = salesValue > 0
        ? (profit / salesValue) * 100
        : 0;

      return {
        productCode: data.productCode,
        productName: data.productName || "",
        batchNo: data.batchNo || "",
        goodQuantity,

        materialCost: material.totalMaterialCost,
        productionCost: production.totalProductionCost,
        rejectionCost: rejection.netRejectionCost,
        packingCost: packing.totalPackingCost,
        additionalCost: this.round(additionalCost),

        totalCost: this.round(totalCost),
        costPerPiece: this.round(costPerPiece),
        costPer1000: this.round(costPer1000),

        sellingPrice: this.round(sellingPrice),
        salesValue: this.round(salesValue),
        profit: this.round(profit),
        profitMargin: this.round(margin),

        materialDetails: material.details,
        productionDetails: production,
        rejectionDetails: rejection,
        packingDetails: packing.details,

        costingDate: new Date().toISOString(),
        costingBasis: "Entered actual quantities and rates"
      };
    },

    /* =====================================
       SAVE COSTING RECORD
    ====================================== */

    saveCosting(data) {
      const result = this.calculateProductCost(data);

      const record = {
        id: this.id("COST"),
        ...result
      };

      this.records.push(record);
      this.save();

      return record;
    },

    getCostingRecord(recordId) {
      return this.records.find(r => r.id === recordId) || null;
    },

    getProductCostHistory(productCode) {
      return this.records
        .filter(r => r.productCode === productCode)
        .sort((a, b) =>
          new Date(b.costingDate) - new Date(a.costingDate)
        );
    },

    /* =====================================
       PRODUCT PROFITABILITY
    ====================================== */

    compareProducts() {
      return this.records.map(record => ({
        productCode: record.productCode,
        productName: record.productName,
        goodQuantity: record.goodQuantity,
        totalCost: record.totalCost,
        costPerPiece: record.costPerPiece,
        costPer1000: record.costPer1000,
        sellingPrice: record.sellingPrice,
        profit: record.profit,
        profitMargin: record.profitMargin
      }));
    },

    /* =====================================
       COST SUMMARY
    ====================================== */

    getSummary() {
      const totalCost = this.records.reduce(
        (sum, r) => sum + this.number(r.totalCost), 0
      );

      const totalQuantity = this.records.reduce(
        (sum, r) => sum + this.number(r.goodQuantity), 0
      );

      const totalProfit = this.records.reduce(
        (sum, r) => sum + this.number(r.profit), 0
      );

      return {
        totalCostingRecords: this.records.length,
        totalProductionQuantity: totalQuantity,
        totalRecordedCost: this.round(totalCost),
        averageCostPerPiece: totalQuantity
          ? this.round(totalCost / totalQuantity)
          : 0,
        totalRecordedProfit: this.round(totalProfit)
      };
    },

    /* =====================================
       CSV EXPORT
    ====================================== */

    downloadCSV() {
      if (!this.records.length) {
        throw new Error("No costing records available.");
      }

      const columns = [
        "productCode",
        "productName",
        "batchNo",
        "goodQuantity",
        "materialCost",
        "productionCost",
        "rejectionCost",
        "packingCost",
        "additionalCost",
        "totalCost",
        "costPerPiece",
        "costPer1000",
        "sellingPrice",
        "salesValue",
        "profit",
        "profitMargin"
      ];

      const escapeCSV = value => {
        const text = String(value ?? "");
        return '"' + text.replace(/"/g, '""') + '"';
      };

      const csv = [
        columns.map(escapeCSV).join(","),
        ...this.records.map(record =>
          columns.map(key => escapeCSV(record[key])).join(",")
        )
      ].join("\r\n");

      const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;"
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "CapMan-Manufacturing-Costing.csv";

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
        "costing-table-container"
      );

      if (!container) return;

      if (!this.records.length) {
        container.innerHTML = "<p>No costing records available.</p>";
        return;
      }

      const rows = this.records.map(r => `
        <tr>
          <td>${this.escape(r.productCode)}</td>
          <td>${this.escape(r.productName)}</td>
          <td>${this.escape(r.batchNo)}</td>
          <td>${this.escape(r.goodQuantity)}</td>
          <td>₹${this.escape(r.totalCost)}</td>
          <td>₹${this.escape(r.costPerPiece)}</td>
          <td>₹${this.escape(r.costPer1000)}</td>
          <td>${this.escape(r.profitMargin)}%</td>
        </tr>
      `).join("");

      container.innerHTML = `
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Product Code</th>
                <th>Product</th>
                <th>Batch</th>
                <th>Good Qty</th>
                <th>Total Cost</th>
                <th>Cost / Piece</th>
                <th>Cost / 1000</th>
                <th>Profit Margin</th>
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

      console.log("CapMan Costing module initialized.");
    }
  };

  window.CapManCosting = Costing;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      Costing.initialize();
    });
  } else {
    Costing.initialize();
  }

})();
          
