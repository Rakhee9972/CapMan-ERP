
/* =========================================================
   CAPMAN ERP - PACKING MANAGEMENT
   File: packing.js

   Features:
   - Packing order creation
   - Finished goods batch tracking
   - Packing material requirements
   - Packing output recording
   - Rejection and QC
   - Shipper-wise packing records
   - Packing reports

   IMPORTANT:
   - No assumed caps-per-shipper ratio.
   - No automatic inventory deduction.
   - Inventory integration will be done later.
========================================================= */

(function () {
  "use strict";

  const KEYS = {
    orders: "capman_packing_orders",
    records: "capman_packing_records",
    materials: "capman_packing_material_usage",
    qc: "capman_packing_qc"
  };

  const read = key => {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (error) {
      console.error("Packing storage error:", error);
      return [];
    }
  };

  const save = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

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

  const Packing = {

    /* =====================================
       DATA ACCESS
    ===================================== */

    getOrders() {
      return read(KEYS.orders);
    },

    getRecords() {
      return read(KEYS.records);
    },

    getMaterialUsage() {
      return read(KEYS.materials);
    },

    getQCRecords() {
      return read(KEYS.qc);
    },

    getOrder(orderId) {
      return this.getOrders().find(
        item => item.id === orderId
      ) || null;
    },

    /* =====================================
       FINISHED GOODS BATCH VALIDATION
    ===================================== */

    getInventory() {
      return window.CapManInventory || null;
    },

    validateFinishedGoods(data) {
      if (!data.finishedGoodsBatch) {
        throw new Error("Finished Goods batch is required.");
      }

      if (!data.productCode) {
        throw new Error("Finished product code is required.");
      }

      if (!data.uom) {
        throw new Error("Finished goods UOM is required.");
      }

      return true;
    },

    /* =====================================
       CREATE PACKING ORDER
    ===================================== */

    createOrder(data) {
      this.validateFinishedGoods(data);

      const quantity = num(data.targetQty);

      if (quantity <= 0) {
        throw new Error("Enter a valid packing quantity.");
      }

      if (!data.customerName) {
        throw new Error("Customer name is required.");
      }

      const order = {
        id: makeId("PKO"),
        packingOrderNumber: makeId("CAP-PACK"),
        customerOrderId: data.customerOrderId || "",
        poNumber: data.poNumber || "",
        customerName: data.customerName,
        productCode: data.productCode,
        finishedGoodsBatch: data.finishedGoodsBatch,
        targetQty: quantity,
        packedQty: 0,
        rejectedQty: 0,
        pendingQty: quantity,
        uom: data.uom,
        packingType: data.packingType || "Standard",
        plannedDate: data.plannedDate || "",
        priority: data.priority || "Normal",
        remarks: data.remarks || "",
        status: "Draft",
        createdAt: new Date().toISOString()
      };

      const orders = this.getOrders();
      orders.push(order);
      save(KEYS.orders, orders);

      return order;
    },

    /* =====================================
       PACKING MATERIAL REQUIREMENTS
    ===================================== */

    calculateMaterialRequirement(data) {
      const quantity = num(data.finishedQty);

      if (quantity <= 0) {
        throw new Error("Enter valid finished quantity.");
      }

      const specifications = data.specifications || [];

      if (!specifications.length) {
        throw new Error(
          "Enter approved packing material specifications."
        );
      }

      return specifications.map(item => {
        const perUnit = num(item.quantityPerUnit);

        if (!item.materialCode || !item.uom || perUnit <= 0) {
          throw new Error(
            "Each packing material requires code, UOM and positive quantity."
          );
        }

        return {
          materialCode: item.materialCode,
          materialName: item.materialName || item.materialCode,
          quantityPerUnit: perUnit,
          requiredQty: quantity * perUnit,
          uom: item.uom
        };
      });
    },

    /* =====================================
       SAVE PACKING SPECIFICATION
    ===================================== */

    savePackingSpecification(orderId, specifications) {
      const order = this.getOrder(orderId);

      if (!order) {
        throw new Error("Packing order not found.");
      }

      if (order.status !== "Draft") {
        throw new Error("Only draft packing orders can be configured.");
      }

      const requirements = this.calculateMaterialRequirement({
        finishedQty: order.targetQty,
        specifications
      });

      const orders = this.getOrders();
      const index = orders.findIndex(item => item.id === orderId);

      orders[index].packingSpecifications = specifications;
      orders[index].materialRequirements = requirements;
      orders[index].specificationApproved = false;

      save(KEYS.orders, orders);

      return orders[index];
    },

    approvePackingSpecification(orderId, approvedBy) {
      const orders = this.getOrders();
      const index = orders.findIndex(item => item.id === orderId);

      if (index === -1) {
        throw new Error("Packing order not found.");
      }

      const order = orders[index];

      if (!order.materialRequirements?.length) {
        throw new Error("Save packing specifications first.");
      }

      if (order.status !== "Draft") {
        throw new Error("Packing order is not in draft status.");
      }

      order.specificationApproved = true;
      order.specificationApprovedBy = approvedBy || "Admin";
      order.specificationApprovedAt = new Date().toISOString();

      save(KEYS.orders, orders);
      return order;
    },

    /* =====================================
       RELEASE PACKING ORDER
    ===================================== */

    releaseOrder(orderId) {
      const orders = this.getOrders();
      const index = orders.findIndex(item => item.id === orderId);

      if (index === -1) {
        throw new Error("Packing order not found.");
      }

      const order = orders[index];

      if (order.status !== "Draft") {
        throw new Error("Only draft orders can be released.");
      }

      if (!order.specificationApproved) {
        throw new Error(
          "Approved packing specification is required."
        );
      }

      order.status = "Released";
      order.releasedAt = new Date().toISOString();

      save(KEYS.orders, orders);
      return order;
    },

    /* =====================================
       RECORD PACKING OUTPUT
    ===================================== */

    recordPacking(orderId, data) {
      const orders = this.getOrders();
      const index = orders.findIndex(item => item.id === orderId);

      if (index === -1) {
        throw new Error("Packing order not found.");
      }

      const order = orders[index];

      if (!["Released", "In Progress"].includes(order.status)) {
        throw new Error(
          "Packing order must be released before production."
        );
      }

      const packed = num(data.packedQty);
      const rejected = num(data.rejectedQty);

      if (packed <= 0 || rejected < 0) {
        throw new Error("Invalid packing quantities.");
      }

      if (packed + rejected > order.pendingQty) {
        throw new Error(
          "Packed plus rejected quantity exceeds pending quantity."
        );
      }

      if (!data.packingBatch) {
        throw new Error("Packing batch number is required.");
      }

      const record = {
        id: makeId("PKR"),
        orderId,
        packingOrderNumber: order.packingOrderNumber,
        productCode: order.productCode,
        finishedGoodsBatch: order.finishedGoodsBatch,
        packingBatch: data.packingBatch,
        packedQty: packed,
        rejectedQty: rejected,
        shipperCount: num(data.shipperCount),
        capsPerShipper: data.capsPerShipper
          ? num(data.capsPerShipper)
          : null,
        packedDate: data.packedDate ||
          new Date().toISOString().slice(0, 10),
        packedBy: data.packedBy || "System",
        remarks: data.remarks || "",
        qcStatus: "Pending",
        createdAt: new Date().toISOString()
      };

      if (
        record.shipperCount < 0 ||
        (record.capsPerShipper !== null &&
          record.capsPerShipper <= 0)
      ) {
        throw new Error("Invalid shipper packing details.");
      }

      if (
        record.shipperCount > 0 &&
        record.capsPerShipper !== null &&
        record.shipperCount * record.capsPerShipper !== packed
      ) {
        throw new Error(
          "Shipper count multiplied by caps per shipper " +
          "must equal packed quantity."
        );
      }

      const records = this.getRecords();
      records.push(record);
      save(KEYS.records, records);

      order.packedQty += packed;
      order.rejectedQty += rejected;
      order.pendingQty -= packed + rejected;
      order.status = order.pendingQty === 0
        ? "Completed"
        : "In Progress";

      order.updatedAt = new Date().toISOString();

      save(KEYS.orders, orders);

      return record;
    },

    /* =====================================
       RECORD PACKING MATERIAL CONSUMPTION
    ===================================== */

    recordMaterialUsage(orderId, data) {
      const order = this.getOrder(orderId);

      if (!order) {
        throw new Error("Packing order not found.");
      }

      if (!["Released", "In Progress", "Completed"].includes(
        order.status
      )) {
        throw new Error("Packing order is not active.");
      }

      if (!data.materialCode || !data.uom) {
        throw new Error("Material code and UOM are required.");
      }

      const quantity = num(data.quantity);

      if (quantity <= 0) {
        throw new Error("Enter a valid consumption quantity.");
      }

      const usage = {
        id: makeId("PMU"),
        orderId,
        materialCode: data.materialCode,
        batchNumber: data.batchNumber || "",
        quantity,
        uom: data.uom,
        recordedBy: data.recordedBy || "System",
        recordedAt: new Date().toISOString(),
        remarks: data.remarks || ""
      };

      const records = this.getMaterialUsage();
      records.push(usage);
      save(KEYS.materials, records);

      return usage;
    },

    /* =====================================
       PACKING QUALITY INSPECTION
    ===================================== */

    inspectPacking(recordId, data) {
      const records = this.getRecords();
      const index = records.findIndex(
        item => item.id === recordId
      );

      if (index === -1) {
        throw new Error("Packing record not found.");
      }

      const record = records[index];

      if (record.qcStatus !== "Pending") {
        throw new Error("Packing record already inspected.");
      }

      const inspected = num(data.inspectedQty);
      const accepted = num(data.acceptedQty);
      const rejected = num(data.rejectedQty);

      if (
        inspected <= 0 ||
        accepted < 0 ||
        rejected < 0 ||
        accepted + rejected !== inspected ||
        inspected > record.packedQty
      ) {
        throw new Error("Invalid packing QC quantities.");
      }

      const qc = {
        id: makeId("PKQC"),
        recordId,
        orderId: record.orderId,
        inspectedQty: inspected,
        acceptedQty: accepted,
        rejectedQty: rejected,
        status: rejected > 0
          ? accepted > 0
            ? "Partially Accepted"
            : "Rejected"
          : "Accepted",
        defectReason: data.defectReason || "",
        inspectedBy: data.inspectedBy || "QC",
        inspectedAt: new Date().toISOString(),
        remarks: data.remarks || ""
      };

      record.qcStatus = qc.status;

      const qcRecords = this.getQCRecords();
      qcRecords.push(qc);

      save(KEYS.qc, qcRecords);
      save(KEYS.records, records);

      return qc;
    },

    /* =====================================
       PACKING ORDER SUMMARY
    ===================================== */

    getOrderSummary(orderId) {
      const order = this.getOrder(orderId);

      if (!order) {
        throw new Error("Packing order not found.");
      }

      const records = this.getRecords().filter(
        item => item.orderId === orderId
      );

      return {
        targetQty: order.targetQty,
        packedQty: order.packedQty,
        rejectedQty: order.rejectedQty,
        pendingQty: order.pendingQty,
        recordCount: records.length,
        shipperCount: records.reduce(
          (sum, item) => sum + num(item.shipperCount),
          0
        )
      };
    },

    /* =====================================
       REPORTS
    ===================================== */

    getSummary() {
      const orders = this.getOrders();
      const records = this.getRecords();
      const qc = this.getQCRecords();

      return {
        totalOrders: orders.length,
        draftOrders: orders.filter(
          item => item.status === "Draft"
        ).length,
        releasedOrders: orders.filter(
          item => item.status === "Released"
        ).length,
        inProgressOrders: orders.filter(
          item => item.status === "In Progress"
        ).length,
        completedOrders: orders.filter(
          item => item.status === "Completed"
        ).length,
        totalPackedQty: records.reduce(
          (sum, item) => sum + item.packedQty, 0
        ),
        totalRejectedQty: records.reduce(
          (sum, item) => sum + item.rejectedQty, 0
        ),
        totalShippers: records.reduce(
          (sum, item) => sum + item.shipperCount, 0
        ),
        qcPending: records.filter(
          item => item.qcStatus === "Pending"
        ).length,
        qcRejected: qc.reduce(
          (sum, item) => sum + item.rejectedQty, 0
        )
      };
    },

    getBatchHistory(batchNumber) {
      return this.getRecords().filter(item =>
        item.finishedGoodsBatch === batchNumber ||
        item.packingBatch === batchNumber
      );
    },

    /* =====================================
       RENDER PACKING ORDERS
    ===================================== */

    renderOrders(containerId = "packing-order-container") {
      const container = document.getElementById(containerId);
      if (!container) return;

      const orders = this.getOrders();

      if (!orders.length) {
        container.innerHTML = "<p>No packing orders available.</p>";
        return;
      }

      container.innerHTML = `
        <div class="table-responsive">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Packing Order</th>
                <th>PO Number</th>
                <th>Customer</th>
                <th>Product</th>
                <th>FG Batch</th>
                <th>Target</th>
                <th>Packed</th>
                <th>Pending</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map(item => `
                <tr>
                  <td>${escapeHTML(item.packingOrderNumber)}</td>
                  <td>${escapeHTML(item.poNumber)}</td>
                  <td>${escapeHTML(item.customerName)}</td>
                  <td>${escapeHTML(item.productCode)}</td>
                  <td>${escapeHTML(item.finishedGoodsBatch)}</td>
                  <td>${item.targetQty}</td>
                  <td>${item.packedQty}</td>
                  <td>${item.pendingQty}</td>
                  <td>${escapeHTML(item.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    },

    renderRecords(containerId = "packing-record-container") {
      const container = document.getElementById(containerId);
      if (!container) return;

      const records = this.getRecords();

      if (!records.length) {
        container.innerHTML = "<p>No packing records available.</p>";
        return;
      }

      container.innerHTML = `
        <div class="table-responsive">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Packing Batch</th>
                <th>FG Batch</th>
                <th>Product</th>
                <th>Packed Qty</th>
                <th>Rejected Qty</th>
                <th>Shippers</th>
                <th>QC Status</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(item => `
                <tr>
                  <td>${escapeHTML(item.packingBatch)}</td>
                  <td>${escapeHTML(item.finishedGoodsBatch)}</td>
                  <td>${escapeHTML(item.productCode)}</td>
                  <td>${item.packedQty}</td>
                  <td>${item.rejectedQty}</td>
                  <td>${item.shipperCount}</td>
                  <td>${escapeHTML(item.qcStatus)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    },

    renderAll() {
      this.renderOrders();
      this.renderRecords();
    },

    initialize() {
      this.renderAll();
      console.log("CapMan Packing module initialized.");
    }
  };

  window.CapManPacking = Packing;

})();
    
