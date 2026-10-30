
/* =========================================================
   CAPMAN ERP - GOODS RECEIPT NOTE (GRN)
   File: grn.js

   Supplier inward and incoming quality inspection.

   IMPORTANT:
   - GRN records are stored locally.
   - Inventory posting is a separate action.
   - Only accepted quantity can be posted to stock.
   - Posting is protected against duplicate GRN posting.
========================================================= */

(function () {
  "use strict";

  const KEYS = {
    grns: "capman_grn_records",
    lines: "capman_grn_lines",
    qc: "capman_grn_qc_records"
  };

  const read = key => {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (error) {
      console.error("GRN storage error:", error);
      return [];
    }
  };

  const save = (key, value) =>
    localStorage.setItem(key, JSON.stringify(value));

  const num = value => {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  };

  const id = prefix =>
    prefix + "-" + Date.now().toString(36).toUpperCase() +
    "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);

  const GRN = {

    /* =====================================
       DATA ACCESS
    ===================================== */

    getAll() {
      return read(KEYS.grns);
    },

    getLines() {
      return read(KEYS.lines);
    },

    getQCRecords() {
      return read(KEYS.qc);
    },

    getById(grnId) {
      return this.getAll().find(item => item.id === grnId) || null;
    },

    getByNumber(grnNumber) {
      return this.getAll().find(
        item => item.grnNumber === grnNumber
      ) || null;
    },

    getLinesByGRN(grnId) {
      return this.getLines().filter(
        item => item.grnId === grnId
      );
    },

    /* =====================================
       SUPPLIER PURCHASE ORDERS
    ===================================== */

    getPurchaseOrders() {
      const purchase = window.CapManPurchase;

      if (!purchase) return [];

      if (typeof purchase.getOrders === "function") {
        return purchase.getOrders() || [];
      }

      return Array.isArray(purchase.orders)
        ? purchase.orders
        : [];
    },

    getOpenPurchaseOrders() {
      return this.getPurchaseOrders().filter(order => {
        const status = String(order.status || "").toLowerCase();

        return ![
          "closed",
          "cancelled",
          "completed"
        ].includes(status);
      });
    },

    getPurchaseOrder(poId) {
      return this.getPurchaseOrders().find(
        order => order.id === poId ||
          order.poNumber === poId ||
          order.orderNumber === poId
      ) || null;
    },

    /* =====================================
       CREATE GRN
    ===================================== */

    createGRN(data) {
      if (!data.purchaseOrderId) {
        throw new Error("Select a supplier purchase order.");
      }

      if (!data.supplierName) {
        throw new Error("Supplier name is required.");
      }

      if (!data.invoiceNumber) {
        throw new Error("Supplier invoice number is required.");
      }

      if (!data.invoiceDate) {
        throw new Error("Invoice date is required.");
      }

      const duplicate = this.getAll().some(grn =>
        grn.supplierId === (data.supplierId || "") &&
        String(grn.invoiceNumber).toLowerCase() ===
          String(data.invoiceNumber).toLowerCase()
      );

      if (duplicate) {
        throw new Error(
          "This supplier invoice number already exists."
        );
      }

      const grn = {
        id: id("GRN"),
        grnNumber: id("CAP-GRN"),
        purchaseOrderId: data.purchaseOrderId,
        poNumber: data.poNumber || "",
        supplierId: data.supplierId || "",
        supplierName: data.supplierName,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
        vehicleNumber: data.vehicleNumber || "",
        transporter: data.transporter || "",
        lrNumber: data.lrNumber || "",
        receivedDate: data.receivedDate ||
          new Date().toISOString().slice(0, 10),
        receivedBy: data.receivedBy || "System",
        remarks: data.remarks || "",
        status: "Draft",
        inventoryPosted: false,
        createdAt: new Date().toISOString()
      };

      const grns = this.getAll();
      grns.push(grn);
      save(KEYS.grns, grns);

      return grn;
    },

    /* =====================================
       ADD MATERIAL LINE
    ===================================== */

    addMaterialLine(grnId, data) {
      const grn = this.getById(grnId);

      if (!grn) {
        throw new Error("GRN not found.");
      }

      if (grn.status !== "Draft") {
        throw new Error("Only draft GRNs can be edited.");
      }

      if (!data.materialCode) {
        throw new Error("Material code is required.");
      }

      const received = num(data.receivedQty);

      if (received <= 0) {
        throw new Error("Enter a valid received quantity.");
      }

      if (!data.uom) {
        throw new Error("Unit of measurement is required.");
      }

      if (!data.batchNumber) {
        throw new Error("Supplier batch number is required.");
      }

      const line = {
        id: id("GRNL"),
        grnId,
        materialCode: data.materialCode,
        materialName: data.materialName || data.materialCode,
        receivedQty: received,
        uom: data.uom,
        supplierBatch: data.batchNumber,
        internalBatch: data.internalBatch || id("BATCH"),
        manufacturingDate: data.manufacturingDate || "",
        expiryDate: data.expiryDate || "",
        rack: data.rack || "",
        bin: data.bin || "",
        remarks: data.remarks || "",
        qcStatus: "Pending",
        acceptedQty: 0,
        rejectedQty: 0,
        holdQty: 0,
        inventoryPosted: false
      };

      const lines = this.getLines();
      lines.push(line);
      save(KEYS.lines, lines);

      return line;
    },

    /* =====================================
       UPDATE MATERIAL LINE
    ===================================== */

    updateMaterialLine(lineId, changes) {
      const lines = this.getLines();
      const index = lines.findIndex(item => item.id === lineId);

      if (index === -1) {
        throw new Error("GRN material line not found.");
      }

      const grn = this.getById(lines[index].grnId);

      if (!grn || grn.status !== "Draft") {
        throw new Error("Only draft GRN lines can be edited.");
      }

      const allowed = [
        "materialName",
        "rack",
        "bin",
        "remarks",
        "manufacturingDate",
        "expiryDate"
      ];

      allowed.forEach(key => {
        if (changes[key] !== undefined) {
          lines[index][key] = changes[key];
        }
      });

      save(KEYS.lines, lines);
      return lines[index];
    },

    /* =====================================
       INCOMING QUALITY INSPECTION
    ===================================== */

    inspectMaterial(lineId, data) {
      const lines = this.getLines();
      const index = lines.findIndex(item => item.id === lineId);

      if (index === -1) {
        throw new Error("GRN line not found.");
      }

      const line = lines[index];
      const grn = this.getById(line.grnId);

      if (!grn || grn.status === "Cancelled") {
        throw new Error("Cannot inspect this GRN.");
      }

      if (line.inventoryPosted) {
        throw new Error("Material is already posted to inventory.");
      }

      const accepted = num(data.acceptedQty);
      const rejected = num(data.rejectedQty);
      const hold = num(data.holdQty);

      if (
        accepted < 0 ||
        rejected < 0 ||
        hold < 0 ||
        Math.abs(
          accepted + rejected + hold - line.receivedQty
        ) > 0.000001
      ) {
        throw new Error(
          "Accepted + rejected + hold must equal received quantity."
        );
      }

      const status = hold > 0
        ? "Hold"
        : rejected > 0
          ? accepted > 0
            ? "Partially Accepted"
            : "Rejected"
          : "Accepted";

      line.acceptedQty = accepted;
      line.rejectedQty = rejected;
      line.holdQty = hold;
      line.qcStatus = status;
      line.inspectedBy = data.inspectedBy || "QC";
      line.inspectionDate = new Date().toISOString();
      line.defectReason = data.defectReason || "";
      line.qcRemarks = data.remarks || "";

      save(KEYS.lines, lines);

      const qcRecords = this.getQCRecords();

      qcRecords.push({
        id: id("IQC"),
        grnId: grn.id,
        grnNumber: grn.grnNumber,
        lineId,
        materialCode: line.materialCode,
        batchNumber: line.supplierBatch,
        receivedQty: line.receivedQty,
        acceptedQty: accepted,
        rejectedQty: rejected,
        holdQty: hold,
        status,
        inspectedBy: line.inspectedBy,
        inspectionDate: line.inspectionDate,
        defectReason: line.defectReason,
        remarks: line.qcRemarks
      });

      save(KEYS.qc, qcRecords);

      return line;
    },

    /* =====================================
       SUBMIT GRN FOR REVIEW
    ===================================== */

    submitGRN(grnId) {
      const grn = this.getById(grnId);

      if (!grn) {
        throw new Error("GRN not found.");
      }

      if (grn.status !== "Draft") {
        throw new Error("Only draft GRNs can be submitted.");
      }

      const lines = this.getLinesByGRN(grnId);

      if (!lines.length) {
        throw new Error("Add at least one material line.");
      }

      const pending = lines.some(
        line => line.qcStatus === "Pending"
      );

      if (pending) {
        throw new Error(
          "Complete incoming QC for every material line."
        );
      }

      const grns = this.getAll();
      const index = grns.findIndex(item => item.id === grnId);

      grns[index].status = "QC Completed";
      grns[index].submittedAt = new Date().toISOString();

      save(KEYS.grns, grns);
      return grns[index];
    },

    /* =====================================
       INVENTORY POSTING
       Accepted quantity only.
    ===================================== */

    postToInventory(grnId) {
      const grns = this.getAll();
      const index = grns.findIndex(item => item.id === grnId);

      if (index === -1) {
        throw new Error("GRN not found.");
      }

      const grn = grns[index];

      if (grn.status !== "QC Completed") {
        throw new Error("Complete QC before inventory posting.");
      }

      if (grn.inventoryPosted) {
        throw new Error("This GRN is already posted.");
      }

      const lines = this.getLinesByGRN(grnId);
      const acceptedLines = lines.filter(
        line => line.acceptedQty > 0
      );

      if (!acceptedLines.length) {
        throw new Error("No accepted quantity available for posting.");
      }

      const inventory = window.CapManInventory;

      if (!inventory ||
          typeof inventory.postGRN !== "function") {
        throw new Error(
          "Inventory posting API is not connected yet. " +
          "GRN remains unposted."
        );
      }

      /*
       * Inventory integration will be finalized later.
       * Require a single inventory API that accepts the complete
       * GRN payload and handles duplicate references safely.
       */

      const payload = {
        reference: grn.grnNumber,
        referenceType: "GRN",
        supplierName: grn.supplierName,
        purchaseOrderId: grn.purchaseOrderId,
        date: grn.receivedDate,
        lines: acceptedLines.map(line => ({
          materialCode: line.materialCode,
          materialName: line.materialName,
          quantity: line.acceptedQty,
          uom: line.uom,
          batchNumber: line.internalBatch,
          supplierBatch: line.supplierBatch,
          rack: line.rack,
          bin: line.bin
        }))
      };

      const result = inventory.postGRN(payload);

      if (result === false) {
        throw new Error("Inventory posting was rejected.");
      }

      grns[index].inventoryPosted = true;
      grns[index].status = "Posted";
      grns[index].postedAt = new Date().toISOString();

      save(KEYS.grns, grns);

      const allLines = this.getLines();
      allLines.forEach(line => {
        if (line.grnId === grnId && line.acceptedQty > 0) {
          line.inventoryPosted = true;
        }
      });

      save(KEYS.lines, allLines);

      return grns[index];
    },

    /* =====================================
       CANCEL GRN
    ===================================== */

    cancelGRN(grnId, reason) {
      const grns = this.getAll();
      const index = grns.findIndex(item => item.id === grnId);

      if (index === -1) {
        throw new Error("GRN not found.");
      }

      const grn = grns[index];

      if (grn.inventoryPosted || grn.status === "Posted") {
        throw new Error(
          "Posted GRN cannot be cancelled directly. " +
          "Use an approved inventory reversal process."
        );
      }

      if (!reason || !String(reason).trim()) {
        throw new Error("Cancellation reason is required.");
      }

      grn.status = "Cancelled";
      grn.cancelReason = reason;
      grn.cancelledAt = new Date().toISOString();

      save(KEYS.grns, grns);
      return grn;
    },

    /* =====================================
       PURCHASE ORDER RECEIPT SUMMARY
    ===================================== */

    getPOReceiptSummary(poId) {
      const grns = this.getAll().filter(item =>
        item.purchaseOrderId === poId &&
        item.status !== "Cancelled"
      );

      const result = {};

      grns.forEach(grn => {
        this.getLinesByGRN(grn.id).forEach(line => {
          const code = line.materialCode;

          if (!result[code]) {
            result[code] = {
              materialCode: code,
              receivedQty: 0,
              acceptedQty: 0,
              rejectedQty: 0,
              holdQty: 0,
              postedQty: 0,
              uom: line.uom
            };
          }

          result[code].receivedQty += line.receivedQty;
          result[code].acceptedQty += line.acceptedQty;
          result[code].rejectedQty += line.rejectedQty;
          result[code].holdQty += line.holdQty;

          if (line.inventoryPosted) {
            result[code].postedQty += line.acceptedQty;
          }
        });
      });

      return Object.values(result);
    },

    /* =====================================
       SUPPLIER REPORT
    ===================================== */

    getSupplierReport() {
      const grns = this.getAll();

      const report = {};

      grns.forEach(grn => {
        const supplier = grn.supplierName;

        if (!report[supplier]) {
          report[supplier] = {
            supplierName: supplier,
            grnCount: 0,
            receivedQty: 0,
            acceptedQty: 0,
            rejectedQty: 0,
            holdQty: 0
          };
        }

        report[supplier].grnCount++;

        this.getLinesByGRN(grn.id).forEach(line => {
          report[supplier].receivedQty += line.receivedQty;
          report[supplier].acceptedQty += line.acceptedQty;
          report[supplier].rejectedQty += line.rejectedQty;
          report[supplier].holdQty += line.holdQty;
        });
      });

      return Object.values(report);
    },

    /* =====================================
       GRN SUMMARY
    ===================================== */

    getSummary() {
      const grns = this.getAll();
      const lines = this.getLines();

      return {
        totalGRNs: grns.length,
        draft: grns.filter(
          item => item.status === "Draft"
        ).length,
        qcCompleted: grns.filter(
          item => item.status === "QC Completed"
        ).length,
        posted: grns.filter(
          item => item.status === "Posted"
        ).length,
        cancelled: grns.filter(
          item => item.status === "Cancelled"
        ).length,
        receivedQty: lines.reduce(
          (sum, item) => sum + item.receivedQty, 0
        ),
        acceptedQty: lines.reduce(
          (sum, item) => sum + item.acceptedQty, 0
        ),
        rejectedQty: lines.reduce(
          (sum, item) => sum + item.rejectedQty, 0
        ),
        holdQty: lines.reduce(
          (sum, item) => sum + item.holdQty, 0
        )
      };
    },

    /* =====================================
       RENDER GRN TABLE
    ===================================== */

    render(containerId = "grn-table-container") {
      const container = document.getElementById(containerId);
      if (!container) return;

      const grns = this.getAll();

      if (!grns.length) {
        container.innerHTML = "<p>No GRN records available.</p>";
        return;
      }

      container.innerHTML = `
        <div class="table-responsive">
          <table class="erp-table">
            <thead>
              <tr>
                <th>GRN Number</th>
                <th>PO Number</th>
                <th>Supplier</th>
                <th>Invoice</th>
                <th>Received Date</th>
                <th>Status</th>
                <th>Inventory Posted</th>
              </tr>
            </thead>
            <tbody>
              ${grns.map(grn => `
                <tr>
                  <td>${escapeHTML(grn.grnNumber)}</td>
                  <td>${escapeHTML(grn.poNumber)}</td>
                  <td>${escapeHTML(grn.supplierName)}</td>
                  <td>${escapeHTML(grn.invoiceNumber)}</td>
                  <td>${escapeHTML(grn.receivedDate)}</td>
                  <td>${escapeHTML(grn.status)}</td>
                  <td>${grn.inventoryPosted ? "Yes" : "No"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    },

    initialize() {
      this.render();
      console.log("CapMan GRN module initialized.");
    }
  };
window.CapManGRN = GRN;

})();

  window.CapManGRN = GRN;

})();
        
