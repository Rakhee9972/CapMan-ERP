
/* =========================================================
   CAPMAN ERP - BATCH TRACEABILITY
   File: traceability.js

   Raw Material -> Closure -> SFG -> Wadding
   -> Finished Goods -> Packing -> Dispatch

   Prototype: LocalStorage-based
========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "capman_traceability_records";
  const LINK_KEY = "capman_traceability_links";

  const Traceability = {

    records: [],
    links: [],

    load() {
      try {
        this.records =
          JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

        this.links =
          JSON.parse(localStorage.getItem(LINK_KEY)) || [];
      } catch (error) {
        console.error("Traceability loading error:", error);
        this.records = [];
        this.links = [];
      }
    },

    save() {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(this.records)
      );

      localStorage.setItem(
        LINK_KEY,
        JSON.stringify(this.links)
      );
    },

    id(prefix) {
      return prefix + "-" + Date.now() + "-" +
        Math.floor(Math.random() * 10000);
    },

    today() {
      const date = new Date();
      const local = new Date(
        date.getTime() - date.getTimezoneOffset() * 60000
      );

      return local.toISOString().slice(0, 10);
    },

    validateQuantity(quantity) {
      const value = Number(quantity);

      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Quantity must be greater than zero.");
      }

      return value;
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
       BATCH MASTER
    ====================================== */

    createBatch(data) {
      if (!data.batchNo || !data.materialCode || !data.batchType) {
        throw new Error(
          "Batch number, material code and batch type are required."
        );
      }

      const batchNo = String(data.batchNo).trim().toUpperCase();

      if (this.records.some(r => r.batchNo === batchNo)) {
        throw new Error("Batch number already exists.");
      }

      const allowedTypes = [
        "Raw Material",
        "Outer Cap",
        "Inner Cap",
        "Finished Cap",
        "Packing Material"
      ];

      if (!allowedTypes.includes(data.batchType)) {
        throw new Error("Invalid batch type.");
      }

      const record = {
        id: this.id("BATCH"),
        batchNo,
        materialCode: String(data.materialCode).trim(),
        materialName: data.materialName || "",
        batchType: data.batchType,
        supplierBatchNo: data.supplierBatchNo || "",
        supplierCode: data.supplierCode || "",
        grnNo: data.grnNo || "",
        productionOrder: data.productionOrder || "",
        machineCode: data.machineCode || "",
        department: data.department || "",
        shift: data.shift || "",
        operatorCode: data.operatorCode || "",
        quantity: this.validateQuantity(data.quantity),
        unit: data.unit || "PCS",
        manufactureDate: data.manufactureDate || this.today(),
        expiryDate: data.expiryDate || "",
        qcStatus: data.qcStatus || "Pending",
        stockStatus: data.stockStatus || "Available",
        remarks: data.remarks || "",
        createdAt: new Date().toISOString()
      };

      this.records.push(record);
      this.save();

      return record;
    },

    getBatch(batchNo) {
      return this.records.find(
        r => r.batchNo === batchNo
      ) || null;
    },

    updateBatchStatus(batchNo, status) {
      const allowed = [
        "Available",
        "Quarantine",
        "Blocked",
        "Consumed",
        "Dispatched"
      ];

      if (!allowed.includes(status)) {
        throw new Error("Invalid batch stock status.");
      }

      const batch = this.getBatch(batchNo);

      if (!batch) throw new Error("Batch not found.");

      batch.stockStatus = status;
      this.save();

      return batch;
    },

    updateQCStatus(batchNo, status) {
      const allowed = [
        "Pending",
        "Accepted",
        "Rejected",
        "Hold"
      ];

      if (!allowed.includes(status)) {
        throw new Error("Invalid QC status.");
      }

      const batch = this.getBatch(batchNo);

      if (!batch) throw new Error("Batch not found.");

      batch.qcStatus = status;

      if (status === "Rejected" || status === "Hold") {
        batch.stockStatus = "Quarantine";
      }

      this.save();
      return batch;
    },

    /* =====================================
       TRACEABILITY LINK
    ====================================== */

    linkBatches(data) {
      if (
        !data.parentBatchNo ||
        !data.childBatchNo ||
        !data.relationship
      ) {
        throw new Error(
          "Parent batch, child batch and relationship are required."
        );
      }

      if (data.parentBatchNo === data.childBatchNo) {
        throw new Error("A batch cannot be linked to itself.");
      }

      const parent = this.getBatch(data.parentBatchNo);
      const child = this.getBatch(data.childBatchNo);

      if (!parent || !child) {
        throw new Error("Both batches must exist before linking.");
      }

      const quantity = this.validateQuantity(data.quantity);

      const duplicate = this.links.some(link =>
        link.parentBatchNo === data.parentBatchNo &&
        link.childBatchNo === data.childBatchNo &&
        link.relationship === data.relationship &&
        link.referenceNo === (data.referenceNo || "")
      );

      if (duplicate) {
        throw new Error("This batch relationship already exists.");
      }

      const link = {
        id: this.id("LINK"),
        parentBatchNo: data.parentBatchNo,
        childBatchNo: data.childBatchNo,
        relationship: data.relationship,
        quantity,
        unit: data.unit || parent.unit,
        referenceNo: data.referenceNo || "",
        department: data.department || "",
        date: data.date || this.today(),
        remarks: data.remarks || "",
        createdAt: new Date().toISOString()
      };

      this.links.push(link);
      this.save();

      return link;
    },

    /*
      Link direction convention:

      Parent = output batch
      Child  = consumed/input batch

      Example:
      OUTER-BATCH-001 (parent output)
          <- H200MA-BATCH-001 (input)
          <- WHITE-MB-BATCH-001 (input)

      This lets us trace an output backwards to its inputs.
    */

    /* =====================================
       PRODUCTION BATCH CREATION
    ====================================== */

    createProductionBatch(data) {
      if (!data.batchNo || !data.productCode) {
        throw new Error("Batch number and product code are required.");
      }

      const batch = this.createBatch({
        batchNo: data.batchNo,
        materialCode: data.productCode,
        materialName: data.productName || "",
        batchType: data.batchType,
        quantity: data.goodQuantity,
        unit: data.unit || "PCS",
        productionOrder: data.productionOrder || "",
        machineCode: data.machineCode || "",
        department: data.department || "",
        shift: data.shift || "",
        operatorCode: data.operatorCode || "",
        manufactureDate: data.manufactureDate || this.today(),
        qcStatus: data.qcStatus || "Pending",
        remarks: data.remarks || ""
      });

      return batch;
    },

    /* =====================================
       BATCH SEARCH
    ====================================== */

    searchBatches(filters = {}) {
      return this.records.filter(batch => {
        if (filters.batchNo &&
            !batch.batchNo.toLowerCase().includes(
              filters.batchNo.toLowerCase()
            )) return false;

        if (filters.materialCode &&
            batch.materialCode !== filters.materialCode) return false;

        if (filters.batchType &&
            batch.batchType !== filters.batchType) return false;

        if (filters.qcStatus &&
            batch.qcStatus !== filters.qcStatus) return false;

        if (filters.stockStatus &&
            batch.stockStatus !== filters.stockStatus) return false;

        return true;
      });
    },

    /* =====================================
       BACKWARD TRACEABILITY
       Finished batch -> Input batches
    ====================================== */

    traceBackward(batchNo, visited = new Set()) {
      const batch = this.getBatch(batchNo);

      if (!batch) {
        throw new Error("Batch not found: " + batchNo);
      }

      if (visited.has(batchNo)) {
        throw new Error("Circular batch relationship detected.");
      }

      visited.add(batchNo);

      const inputs = this.links.filter(
        link => link.parentBatchNo === batchNo
      );

      const result = {
        batch,
        inputs: []
      };

      inputs.forEach(link => {
        const child = this.getBatch(link.childBatchNo);

        if (child) {
          result.inputs.push({
            link,
            trace: this.traceBackward(
              child.batchNo,
              new Set(visited)
            )
          });
        }
      });

      return result;
    },

    /* =====================================
       FORWARD TRACEABILITY
       Raw batch -> All affected output batches
    ====================================== */

    traceForward(batchNo, visited = new Set()) {
      const batch = this.getBatch(batchNo);

      if (!batch) {
        throw new Error("Batch not found: " + batchNo);
      }

      if (visited.has(batchNo)) {
        throw new Error("Circular batch relationship detected.");
      }

      visited.add(batchNo);

      const outputs = this.links.filter(
        link => link.childBatchNo === batchNo
      );

      const result = {
        batch,
        outputs: []
      };

      outputs.forEach(link => {
        const parent = this.getBatch(link.parentBatchNo);

        if (parent) {
          result.outputs.push({
            link,
            trace: this.traceForward(
              parent.batchNo,
              new Set(visited)
            )
          });
        }
      });

      return result;
    },

    /* =====================================
       CUSTOMER DISPATCH LINK
    ====================================== */

    recordDispatch(data) {
      if (!data.batchNo || !data.dispatchNo || !data.customerName) {
        throw new Error(
          "Batch, dispatch number and customer are required."
        );
      }

      const batch = this.getBatch(data.batchNo);

      if (!batch) throw new Error("Finished batch not found.");

      if (batch.batchType !== "Finished Cap") {
        throw new Error("Only Finished Cap batches can be dispatched.");
      }

      if (batch.qcStatus !== "Accepted") {
        throw new Error("Batch must pass QC before dispatch.");
      }

      const quantity = this.validateQuantity(data.quantity);

      if (quantity > batch.quantity) {
        throw new Error("Dispatch quantity exceeds recorded batch quantity.");
      }

      const dispatchBatch = this.createBatch({
        batchNo: data.dispatchBatchNo || this.id("DSPBATCH"),
        materialCode: batch.materialCode,
        materialName: batch.materialName,
        batchType: "Finished Cap",
        quantity,
        unit: batch.unit,
        productionOrder: batch.productionOrder,
        qcStatus: "Accepted",
        stockStatus: "Dispatched",
        remarks: "Dispatch: " + data.dispatchNo
      });

      const link = this.linkBatches({
        parentBatchNo: dispatchBatch.batchNo,
        childBatchNo: batch.batchNo,
        relationship: "Customer Dispatch",
        quantity,
        unit: batch.unit,
        referenceNo: data.dispatchNo,
        remarks: data.customerName
      });

      return { dispatchBatch, link };
    },

    /* =====================================
       BATCH RECALL SUPPORT
    ====================================== */

    getAffectedBatches(rawMaterialBatchNo) {
      const trace = this.traceForward(rawMaterialBatchNo);
      const affected = [];

      const visit = node => {
        node.outputs.forEach(item => {
          affected.push({
            batchNo: item.trace.batch.batchNo,
            materialCode: item.trace.batch.materialCode,
            batchType: item.trace.batch.batchType,
            qcStatus: item.trace.batch.qcStatus,
            stockStatus: item.trace.batch.stockStatus
          });

          visit(item.trace);
        });
      };

      visit(trace);

      return affected;
    },

    blockAffectedBatches(rawMaterialBatchNo, reason) {
      const affected = this.getAffectedBatches(rawMaterialBatchNo);

      affected.forEach(item => {
        const batch = this.getBatch(item.batchNo);

        if (batch && batch.stockStatus !== "Dispatched") {
          batch.stockStatus = "Blocked";
          batch.blockReason = reason || "Batch traceability alert";
        }
      });

      this.save();

      return affected;
    },

    /* =====================================
       TRACEABILITY REPORT
    ====================================== */

    getSummary() {
      return {
        totalBatches: this.records.length,
        rawMaterialBatches: this.records.filter(
          r => r.batchType === "Raw Material"
        ).length,
        outerCapBatches: this.records.filter(
          r => r.batchType === "Outer Cap"
        ).length,
        innerCapBatches: this.records.filter(
          r => r.batchType === "Inner Cap"
        ).length,
        finishedCapBatches: this.records.filter(
          r => r.batchType === "Finished Cap"
        ).length,
        packingBatches: this.records.filter(
          r => r.batchType === "Packing Material"
        ).length,
        totalRelationships: this.links.length,
        pendingQC: this.records.filter(
          r => r.qcStatus === "Pending"
        ).length,
        blockedBatches: this.records.filter(
          r => r.stockStatus === "Blocked"
        ).length
      };
    },

    /* =====================================
       REPORT RENDERING
    ====================================== */

    renderBatchTable() {
      const container = document.getElementById(
        "traceability-table-container"
      );

      if (!container) return;

      if (!this.records.length) {
        container.innerHTML = "<p>No batch records available.</p>";
        return;
      }

      const rows = this.records.map(batch => `
        <tr>
          <td>${this.escape(batch.batchNo)}</td>
          <td>${this.escape(batch.materialCode)}</td>
          <td>${this.escape(batch.batchType)}</td>
          <td>${this.escape(batch.quantity)}</td>
          <td>${this.escape(batch.unit)}</td>
          <td>${this.escape(batch.qcStatus)}</td>
          <td>${this.escape(batch.stockStatus)}</td>
        </tr>
      `).join("");

      container.innerHTML = `
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Batch Number</th>
                <th>Material Code</th>
                <th>Batch Type</th>
                <th>Quantity</th>
                <th>UOM</th>
                <th>QC Status</th>
                <th>Stock Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    },

    initialize() {
      this.load();
      this.renderBatchTable();

      console.log("CapMan Traceability initialized.");
    }
  };

  window.CapManTraceability = Traceability;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      Traceability.initialize();
    });
  } else {
    Traceability.initialize();
  }

})();
        
