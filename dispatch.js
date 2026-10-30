
/* =========================================================
   CAPMAN ERP - PACKING & DISPATCH MANAGEMENT
   File: dispatch.js

   Workflow:
   Finished Goods -> Packing -> Dispatch -> Customer

   Prototype: LocalStorage-based

   IMPORTANT:
   This module records dispatch transactions.
   Inventory deduction and Sales PO updates will be
   connected during the integration stage.
========================================================= */

(function () {
  "use strict";

  const PACKING_KEY = "capman_packing_orders";
  const DISPATCH_KEY = "capman_dispatch_records";

  const Dispatch = {
    packingOrders: [],
    dispatchRecords: [],

    load() {
      try {
        this.packingOrders =
          JSON.parse(localStorage.getItem(PACKING_KEY)) || [];

        this.dispatchRecords =
          JSON.parse(localStorage.getItem(DISPATCH_KEY)) || [];
      } catch (error) {
        console.error("Dispatch loading error:", error);
        this.packingOrders = [];
        this.dispatchRecords = [];
      }
    },

    save() {
      localStorage.setItem(
        PACKING_KEY,
        JSON.stringify(this.packingOrders)
      );

      localStorage.setItem(
        DISPATCH_KEY,
        JSON.stringify(this.dispatchRecords)
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

    number(value, field) {
      const result = Number(value);

      if (!Number.isFinite(result) || result < 0) {
        throw new Error(field + " must be a valid non-negative number.");
      }

      return result;
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
       CUSTOMER PO VALIDATION
    ====================================== */

    getCustomerOrder(orderId) {
      const sales = window.CapManSales;

      if (!sales || !Array.isArray(sales.orders)) {
        throw new Error("Sales module is not available.");
      }

      const order = sales.orders.find(
        o => o.id === orderId ||
             o.orderNo === orderId ||
             o.poNumber === orderId
      );

      if (!order) throw new Error("Customer PO not found.");

      return order;
    },

    /* =====================================
       PACKING ORDER
    ====================================== */

    createPackingOrder(data) {
      if (
        !data.customerOrderId ||
        !data.productCode ||
        !data.finishedGoodsBatch ||
        !data.targetQuantity
      ) {
        throw new Error(
          "Customer PO, product, FG batch and target quantity are required."
        );
      }

      const order = this.getCustomerOrder(data.customerOrderId);
      const targetQuantity = this.number(
        data.targetQuantity,
        "Target quantity"
      );

      if (targetQuantity <= 0) {
        throw new Error("Target quantity must be greater than zero.");
      }

      const packing = {
        id: this.id("PACK"),
        packingOrderNo: this.id("PKO"),
        customerOrderId: data.customerOrderId,
        customerName: data.customerName || order.customerName || "",
        customerPONumber: data.customerPONumber ||
          order.poNumber || "",
        productCode: data.productCode,
        finishedGoodsBatch: data.finishedGoodsBatch,
        targetQuantity,
        packedQuantity: 0,
        rejectedQuantity: 0,
        pendingQuantity: targetQuantity,
        capsPerShipper: data.capsPerShipper
          ? this.number(data.capsPerShipper, "Caps per shipper")
          : 0,
        polyethyleneBags: 0,
        shippersUsed: 0,
        packingCoversUsed: 0,
        status: "Draft",
        packingDate: data.packingDate || this.today(),
        packedBy: data.packedBy || "",
        remarks: data.remarks || "",
        createdAt: new Date().toISOString()
      };

      if (this.packingOrders.some(p =>
        p.customerOrderId === data.customerOrderId &&
        p.finishedGoodsBatch === data.finishedGoodsBatch &&
        ["Draft", "Released", "In Progress"].includes(p.status)
      )) {
        throw new Error(
          "An active packing order already exists for this PO and FG batch."
        );
      }

      this.packingOrders.push(packing);
      this.save();

      return packing;
    },

    releasePackingOrder(packingOrderId) {
      const packing = this.getPackingOrder(packingOrderId);

      if (packing.status !== "Draft") {
        throw new Error("Only draft packing orders can be released.");
      }

      packing.status = "Released";
      packing.releasedAt = new Date().toISOString();

      this.save();
      return packing;
    },

    getPackingOrder(packingOrderId) {
      const packing = this.packingOrders.find(p =>
        p.id === packingOrderId ||
        p.packingOrderNo === packingOrderId
      );

      if (!packing) throw new Error("Packing order not found.");

      return packing;
    },

    /* =====================================
       RECORD PACKING OUTPUT
    ====================================== */

    recordPacking(data) {
      if (!data.packingOrderId) {
        throw new Error("Packing order is required.");
      }

      const packing = this.getPackingOrder(data.packingOrderId);

      if (!["Released", "In Progress"].includes(packing.status)) {
        throw new Error("Packing order is not available for packing.");
      }

      const packed = this.number(data.packedQuantity, "Packed quantity");
      const rejected = this.number(data.rejectedQuantity || 0, "Rejected quantity");

      if (packed <= 0) {
        throw new Error("Packed quantity must be greater than zero.");
      }

      if (packed + rejected >
          packing.pendingQuantity) {
        throw new Error("Packing quantity exceeds pending order quantity.");
      }

      const bags = this.number(
        data.polyethyleneBags || 0,
        "Polyethylene bags"
      );

      const shippers = this.number(
        data.shippersUsed || 0,
        "Shippers used"
      );

      const covers = this.number(
        data.packingCoversUsed || 0,
        "Packing covers"
      );

      if (shippers > 0 && packing.capsPerShipper > 0) {
        const capacity = shippers * packing.capsPerShipper;

        if (packed > capacity) {
          throw new Error(
            "Packed quantity exceeds shipper capacity."
          );
        }
      }

      packing.packedQuantity += packed;
      packing.rejectedQuantity += rejected;
      packing.pendingQuantity -= packed + rejected;

      packing.polyethyleneBags += bags;
      packing.shippersUsed += shippers;
      packing.packingCoversUsed += covers;

      packing.status = packing.pendingQuantity === 0
        ? "Completed"
        : "In Progress";

      packing.lastPackingAt = new Date().toISOString();

      this.save();
      return packing;
    },

    /* =====================================
       PACKING MATERIAL SUMMARY
    ====================================== */

    getPackingMaterialSummary(packingOrderId) {
      const packing = this.getPackingOrder(packingOrderId);

      return {
        polyethyleneBags: packing.polyethyleneBags,
        shippersUsed: packing.shippersUsed,
        packingCoversUsed: packing.packingCoversUsed,
        packedQuantity: packing.packedQuantity,
        rejectedQuantity: packing.rejectedQuantity
      };
    },

    /* =====================================
       DISPATCH CREATION
    ====================================== */

    createDispatch(data) {
      if (
        !data.customerOrderId ||
        !data.packingOrderId ||
        !data.dispatchQuantity ||
        !data.customerName
      ) {
        throw new Error(
          "Customer PO, packing order, quantity and customer are required."
        );
      }

      const order = this.getCustomerOrder(data.customerOrderId);
      const packing = this.getPackingOrder(data.packingOrderId);

      if (packing.customerOrderId !== data.customerOrderId) {
        throw new Error(
          "Packing order does not belong to the selected customer PO."
        );
      }

      if (packing.status !== "Completed") {
        throw new Error("Packing order must be completed before dispatch.");
      }

      const quantity = this.number(
        data.dispatchQuantity,
        "Dispatch quantity"
      );

      if (quantity <= 0) {
        throw new Error("Dispatch quantity must be greater than zero.");
      }

      const alreadyDispatched = this.dispatchRecords
        .filter(d =>
          d.customerOrderId === data.customerOrderId &&
          d.status !== "Cancelled"
        )
        .reduce((sum, d) => sum + d.dispatchQuantity, 0);

      const orderedQty = this.number(order.quantity, "PO quantity");
      const availablePacked = packing.packedQuantity -
        this.dispatchRecords
          .filter(d =>
            d.packingOrderId === packing.id &&
            d.status !== "Cancelled"
          )
          .reduce((sum, d) => sum + d.dispatchQuantity, 0);

      if (quantity > availablePacked) {
        throw new Error("Dispatch quantity exceeds available packed quantity.");
      }

      if (alreadyDispatched + quantity > orderedQty) {
        throw new Error("Dispatch quantity exceeds customer PO balance.");
      }

      const dispatch = {
        id: this.id("DISP"),
        dispatchNo: data.dispatchNo || this.id("DC"),
        customerOrderId: data.customerOrderId,
        customerName: data.customerName,
        customerPONumber: data.customerPONumber ||
          order.poNumber || "",
        packingOrderId: packing.id,
        productCode: packing.productCode,
        finishedGoodsBatch: packing.finishedGoodsBatch,
        dispatchQuantity: quantity,
        dispatchDate: data.dispatchDate || this.today(),
        deliveryChallanNo: data.deliveryChallanNo || "",
        invoiceNo: data.invoiceNo || "",
        vehicleNumber: data.vehicleNumber || "",
        transporter: data.transporter || "",
        driverName: data.driverName || "",
        driverMobile: data.driverMobile || "",
        destination: data.destination || "",
        eWayBillNo: data.eWayBillNo || "",
        remarks: data.remarks || "",
        status: "Prepared",
        createdAt: new Date().toISOString(),
        dispatchedAt: null
      };

      this.dispatchRecords.push(dispatch);
      this.save();

      return dispatch;
    },

    /* =====================================
       DISPATCH CONFIRMATION
    ====================================== */

    confirmDispatch(dispatchId) {
      const dispatch = this.getDispatch(dispatchId);

      if (dispatch.status !== "Prepared") {
        throw new Error("Only prepared dispatches can be confirmed.");
      }

      dispatch.status = "Dispatched";
      dispatch.dispatchedAt = new Date().toISOString();

      this.save();
      return dispatch;
    },

    markDelivered(dispatchId, data = {}) {
      const dispatch = this.getDispatch(dispatchId);

      if (dispatch.status !== "Dispatched") {
        throw new Error("Only dispatched records can be marked delivered.");
      }

      dispatch.status = "Delivered";
      dispatch.deliveryDate = data.deliveryDate || this.today();
      dispatch.receivedBy = data.receivedBy || "";
      dispatch.deliveryRemarks = data.remarks || "";
      dispatch.deliveredAt = new Date().toISOString();

      this.save();
      return dispatch;
    },

    cancelDispatch(dispatchId, reason) {
      const dispatch = this.getDispatch(dispatchId);

      if (dispatch.status !== "Prepared") {
        throw new Error(
          "Only prepared dispatches can be cancelled in this prototype."
        );
      }

      dispatch.status = "Cancelled";
      dispatch.cancellationReason = reason || "";
      dispatch.cancelledAt = new Date().toISOString();

      this.save();
      return dispatch;
    },

    getDispatch(dispatchId) {
      const dispatch = this.dispatchRecords.find(d =>
        d.id === dispatchId || d.dispatchNo === dispatchId
      );

      if (!dispatch) throw new Error("Dispatch record not found.");

      return dispatch;
    },

    /* =====================================
       CUSTOMER PO BALANCE
    ====================================== */

    getPOBalance(customerOrderId) {
      const order = this.getCustomerOrder(customerOrderId);

      const dispatched = this.dispatchRecords
        .filter(d =>
          d.customerOrderId === customerOrderId &&
          d.status !== "Cancelled"
        )
        .reduce((sum, d) => sum + d.dispatchQuantity, 0);

      const ordered = this.number(order.quantity, "PO quantity");

      return {
        customerOrderId,
        orderedQuantity: ordered,
        dispatchedQuantity: dispatched,
        pendingDispatch: Math.max(0, ordered - dispatched),
        dispatchPercentage: ordered
          ? Number((dispatched / ordered * 100).toFixed(2))
          : 0,
        status: dispatched >= ordered
          ? "Fully Dispatched"
          : dispatched > 0
            ? "Partially Dispatched"
            : "Not Dispatched"
      };
    },

    getAllPOBalances() {
      const sales = window.CapManSales;

      if (!sales || !Array.isArray(sales.orders)) return [];

      return sales.orders.map(order => ({
        order,
        balance: this.getPOBalance(order.id)
      }));
    },

    /* =====================================
       DISPATCH REPORTS
    ====================================== */

    getDispatchSummary() {
      const active = this.dispatchRecords.filter(
        d => d.status !== "Cancelled"
      );

      return {
        totalDispatches: active.length,
        prepared: active.filter(d => d.status === "Prepared").length,
        dispatched: active.filter(d => d.status === "Dispatched").length,
        delivered: active.filter(d => d.status === "Delivered").length,
        totalDispatchedQuantity: active.reduce(
          (sum, d) => sum + d.dispatchQuantity, 0
        )
      };
    },

    getCustomerDispatchHistory(customerName) {
      return this.dispatchRecords.filter(
        d => d.customerName === customerName
      );
    },

    filterDispatches(filters = {}) {
      return this.dispatchRecords.filter(d => {
        if (filters.status && d.status !== filters.status) return false;

        if (filters.customerName &&
            d.customerName !== filters.customerName) return false;

        if (filters.fromDate &&
            d.dispatchDate < filters.fromDate) return false;

        if (filters.toDate &&
            d.dispatchDate > filters.toDate) return false;

        return true;
      });
    },

    /* =====================================
       TABLE RENDERING
    ====================================== */

    renderPackingOrders() {
      const container = document.getElementById(
        "packing-order-container"
      );

      if (!container) return;

      if (!this.packingOrders.length) {
        container.innerHTML = "<p>No packing orders found.</p>";
        return;
      }

      const rows = this.packingOrders.map(p => `
        <tr>
          <td>${this.escape(p.packingOrderNo)}</td>
          <td>${this.escape(p.customerName)}</td>
          <td>${this.escape(p.finishedGoodsBatch)}</td>
          <td>${this.escape(p.targetQuantity)}</td>
          <td>${this.escape(p.packedQuantity)}</td>
          <td>${this.escape(p.pendingQuantity)}</td>
          <td>${this.escape(p.status)}</td>
        </tr>
      `).join("");

      container.innerHTML = `
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Packing Order</th>
                <th>Customer</th>
                <th>FG Batch</th>
                <th>Target Qty</th>
                <th>Packed Qty</th>
                <th>Pending Qty</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    },

    renderDispatches() {
      const container = document.getElementById(
        "dispatch-table-container"
      );

      if (!container) return;

      if (!this.dispatchRecords.length) {
        container.innerHTML = "<p>No dispatch records found.</p>";
        return;
      }

      const rows = this.dispatchRecords.map(d => `
        <tr>
          <td>${this.escape(d.dispatchNo)}</td>
          <td>${this.escape(d.customerName)}</td>
          <td>${this.escape(d.customerPONumber)}</td>
          <td>${this.escape(d.dispatchQuantity)}</td>
          <td>${this.escape(d.dispatchDate)}</td>
          <td>${this.escape(d.vehicleNumber)}</td>
          <td>${this.escape(d.transporter)}</td>
          <td>${this.escape(d.status)}</td>
        </tr>
      `).join("");

      container.innerHTML = `
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Dispatch No.</th>
                <th>Customer</th>
                <th>Customer PO</th>
                <th>Quantity</th>
                <th>Date</th>
                <th>Vehicle</th>
                <th>Transporter</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    },

    initialize() {
      this.load();
      this.renderPackingOrders();
      this.renderDispatches();

      console.log("CapMan Dispatch module initialized.");
    }
  };

  window.CapManDispatch = Dispatch;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      Dispatch.initialize();
    });
  } else {
    Dispatch.initialize();
  }

})();
        
