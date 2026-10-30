
/* =========================================================
   CAPMAN ERP - WAREHOUSE MANAGEMENT SYSTEM
   File: warehouse.js

   Features:
   - RM / WIP / SFG / FG warehouses
   - Rack and bin master
   - Warehouse-wise stock locations
   - Batch-wise stock tracking
   - Internal stock transfers
   - Stock movement history
   - Warehouse reports

   IMPORTANT:
   This is a planning and location-control prototype.
   Inventory integration will be completed later.
========================================================= */

(function () {
  "use strict";

  const KEYS = {
    warehouses: "capman_warehouses",
    locations: "capman_warehouse_locations",
    transfers: "capman_warehouse_transfers",
    movements: "capman_warehouse_movements"
  };

  const DEFAULT_WAREHOUSES = [
    {
      code: "WH-RM",
      name: "Raw Material Warehouse",
      type: "RM",
      description: "Raw materials and packing materials"
    },
    {
      code: "WH-WIP",
      name: "Work In Progress Warehouse",
      type: "WIP",
      description: "Production issued materials"
    },
    {
      code: "WH-SFG",
      name: "Semi Finished Goods Warehouse",
      type: "SFG",
      description: "Outer Caps and Inner Caps"
    },
    {
      code: "WH-FG",
      name: "Finished Goods Warehouse",
      type: "FG",
      description: "Finished Caps ready for dispatch"
    },
    {
      code: "WH-QC",
      name: "Quality Hold Warehouse",
      type: "QC",
      description: "Material awaiting quality disposition"
    }
  ];

  const read = key => {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (error) {
      console.error("Warehouse storage error:", error);
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

  const Warehouse = {

    /* =====================================
       INITIALIZE DEFAULT MASTER DATA
    ===================================== */

    initializeDefaults() {
      const existing = read(KEYS.warehouses);

      if (!existing.length) {
        save(KEYS.warehouses, DEFAULT_WAREHOUSES);
      }

      return read(KEYS.warehouses);
    },

    /* =====================================
       WAREHOUSE MASTER
    ===================================== */

    getAll() {
      return read(KEYS.warehouses);
    },

    getActive() {
      return this.getAll().filter(item => item.active !== false);
    },

    getByCode(code) {
      return this.getAll().find(
        item => item.code === code
      ) || null;
    },

    createWarehouse(data) {
      if (!data.code || !data.name || !data.type) {
        throw new Error(
          "Warehouse code, name and type are required."
        );
      }

      const warehouses = this.getAll();

      if (warehouses.some(item => item.code === data.code)) {
        throw new Error("Warehouse code already exists.");
      }

      const warehouse = {
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        type: data.type.toUpperCase(),
        description: data.description || "",
        active: true,
        createdAt: new Date().toISOString()
      };

      warehouses.push(warehouse);
      save(KEYS.warehouses, warehouses);

      return warehouse;
    },

    updateWarehouse(code, changes) {
      const warehouses = this.getAll();
      const index = warehouses.findIndex(
        item => item.code === code
      );

      if (index === -1) {
        throw new Error("Warehouse not found.");
      }

      ["name", "description", "active"].forEach(key => {
        if (changes[key] !== undefined) {
          warehouses[index][key] = changes[key];
        }
      });

      warehouses[index].updatedAt = new Date().toISOString();

      save(KEYS.warehouses, warehouses);
      return warehouses[index];
    },

    /* =====================================
       RACK / BIN MASTER
    ===================================== */

    getLocations() {
      return read(KEYS.locations);
    },

    getLocationsByWarehouse(warehouseCode) {
      return this.getLocations().filter(
        item => item.warehouseCode === warehouseCode &&
          item.active !== false
      );
    },

    createLocation(data) {
      if (!this.getByCode(data.warehouseCode)) {
        throw new Error("Warehouse does not exist.");
      }

      if (!data.rack || !data.bin) {
        throw new Error("Rack and bin are required.");
      }

      const locations = this.getLocations();

      const duplicate = locations.some(item =>
        item.warehouseCode === data.warehouseCode &&
        item.rack === data.rack &&
        item.bin === data.bin
      );

      if (duplicate) {
        throw new Error("This rack/bin already exists.");
      }

      const location = {
        id: makeId("LOC"),
        warehouseCode: data.warehouseCode,
        rack: data.rack.trim().toUpperCase(),
        bin: data.bin.trim().toUpperCase(),
        description: data.description || "",
        active: true,
        createdAt: new Date().toISOString()
      };

      locations.push(location);
      save(KEYS.locations, locations);

      return location;
    },

    deactivateLocation(locationId) {
      const locations = this.getLocations();
      const index = locations.findIndex(
        item => item.id === locationId
      );

      if (index === -1) {
        throw new Error("Location not found.");
      }

      locations[index].active = false;
      save(KEYS.locations, locations);

      return locations[index];
    },

    validateLocation(warehouseCode, rack, bin) {
      return this.getLocations().some(item =>
        item.warehouseCode === warehouseCode &&
        item.rack === rack &&
        item.bin === bin &&
        item.active !== false
      );
    },

    /* =====================================
       INVENTORY ADAPTER
    ===================================== */

    getInventoryStock() {
      const inventory = window.CapManInventory;

      if (!inventory) return [];

      if (typeof inventory.getStock === "function") {
        return inventory.getStock() || [];
      }

      if (typeof inventory.getAllStock === "function") {
        return inventory.getAllStock() || [];
      }

      return [];
    },

    getWarehouseStock(warehouseCode) {
      return this.getInventoryStock().filter(item =>
        item.warehouseCode === warehouseCode
      );
    },

    getStockByLocation(warehouseCode, rack, bin) {
      return this.getWarehouseStock(warehouseCode).filter(item =>
        item.rack === rack && item.bin === bin
      );
    },

    /* =====================================
       INTERNAL TRANSFER REQUEST
    ===================================== */

    createTransfer(data) {
      if (!data.fromWarehouse || !data.toWarehouse) {
        throw new Error("Select source and destination warehouses.");
      }

      if (data.fromWarehouse === data.toWarehouse) {
        throw new Error(
          "Source and destination warehouses cannot be the same."
        );
      }

      if (!this.getByCode(data.fromWarehouse) ||
          !this.getByCode(data.toWarehouse)) {
        throw new Error("Invalid warehouse selection.");
      }

      if (!data.materialCode || !data.batchNumber) {
        throw new Error("Material and batch are required.");
      }

      const quantity = num(data.quantity);

      if (quantity <= 0) {
        throw new Error("Transfer quantity must be greater than zero.");
      }

      if (data.fromRack && data.fromBin &&
          !this.validateLocation(
            data.fromWarehouse,
            data.fromRack,
            data.fromBin
          )) {
        throw new Error("Invalid source rack/bin.");
      }

      if (data.toRack && data.toBin &&
          !this.validateLocation(
            data.toWarehouse,
            data.toRack,
            data.toBin
          )) {
        throw new Error("Invalid destination rack/bin.");
      }

      const transfer = {
        id: makeId("TRF"),
        transferNumber: makeId("CAP-TRF"),
        materialCode: data.materialCode,
        batchNumber: data.batchNumber,
        quantity,
        uom: data.uom || "",
        fromWarehouse: data.fromWarehouse,
        fromRack: data.fromRack || "",
        fromBin: data.fromBin || "",
        toWarehouse: data.toWarehouse,
        toRack: data.toRack || "",
        toBin: data.toBin || "",
        reason: data.reason || "",
        requestedBy: data.requestedBy || "System",
        status: "Draft",
        createdAt: new Date().toISOString()
      };

      const transfers = read(KEYS.transfers);
      transfers.push(transfer);
      save(KEYS.transfers, transfers);

      return transfer;
    },

    /* =====================================
       APPROVE TRANSFER REQUEST
    ===================================== */

    approveTransfer(transferId, approvedBy) {
      const transfers = read(KEYS.transfers);
      const index = transfers.findIndex(
        item => item.id === transferId
      );

      if (index === -1) {
        throw new Error("Transfer not found.");
      }

      if (transfers[index].status !== "Draft") {
        throw new Error("Only draft transfers can be approved.");
      }

      transfers[index].status = "Approved";
      transfers[index].approvedBy = approvedBy || "Admin";
      transfers[index].approvedAt = new Date().toISOString();

      save(KEYS.transfers, transfers);
      return transfers[index];
    },

    /* =====================================
       COMPLETE TRANSFER
       Does not change inventory until integrated.
    ===================================== */

    completeTransfer(transferId, completedBy) {
      const transfers = read(KEYS.transfers);
      const index = transfers.findIndex(
        item => item.id === transferId
      );

      if (index === -1) {
        throw new Error("Transfer not found.");
      }

      const transfer = transfers[index];

      if (transfer.status !== "Approved") {
        throw new Error("Transfer must be approved first.");
      }

      throw new Error(
        "Inventory transfer posting is not connected yet. " +
        "No stock was moved. Complete this during integration."
      );
    },

    /* =====================================
       CANCEL TRANSFER
    ===================================== */

    cancelTransfer(transferId, reason) {
      const transfers = read(KEYS.transfers);
      const index = transfers.findIndex(
        item => item.id === transferId
      );

      if (index === -1) {
        throw new Error("Transfer not found.");
      }

      if (["Completed", "Cancelled"].includes(
        transfers[index].status
      )) {
        throw new Error("This transfer cannot be cancelled.");
      }

      if (!reason || !reason.trim()) {
        throw new Error("Cancellation reason is required.");
      }

      transfers[index].status = "Cancelled";
      transfers[index].cancelReason = reason;
      transfers[index].cancelledAt = new Date().toISOString();

      save(KEYS.transfers, transfers);
      return transfers[index];
    },

    /* =====================================
       MOVEMENT HISTORY
    ===================================== */

    getMovements() {
      return read(KEYS.movements);
    },

    recordMovement(data) {
      if (!data.materialCode || !data.quantity) {
        throw new Error("Material and quantity are required.");
      }

      const movement = {
        id: makeId("MOV"),
        reference: data.reference || "",
        movementType: data.movementType || "Internal",
        materialCode: data.materialCode,
        batchNumber: data.batchNumber || "",
        quantity: num(data.quantity),
        uom: data.uom || "",
        fromWarehouse: data.fromWarehouse || "",
        toWarehouse: data.toWarehouse || "",
        date: new Date().toISOString(),
        recordedBy: data.recordedBy || "System"
      };

      const movements = this.getMovements();
      movements.push(movement);
      save(KEYS.movements, movements);

      return movement;
    },

    /* =====================================
       WAREHOUSE STOCK SUMMARY
    ===================================== */

    getSummary() {
      const warehouses = this.getActive();
      const stock = this.getInventoryStock();

      return warehouses.map(warehouse => {
        const items = stock.filter(item =>
          item.warehouseCode === warehouse.code
        );

        return {
          warehouseCode: warehouse.code,
          warehouseName: warehouse.name,
          type: warehouse.type,
          itemCount: items.length,
          totalQuantity: items.reduce(
            (sum, item) => sum + num(
              item.availableQty ??
              item.quantity ??
              item.balance
            ),
            0
          )
        };
      });
    },

    getTransferSummary() {
      const transfers = read(KEYS.transfers);

      return {
        total: transfers.length,
        draft: transfers.filter(
          item => item.status === "Draft"
        ).length,
        approved: transfers.filter(
          item => item.status === "Approved"
        ).length,
        completed: transfers.filter(
          item => item.status === "Completed"
        ).length,
        cancelled: transfers.filter(
          item => item.status === "Cancelled"
        ).length
      };
    },

    /* =====================================
       RENDER WAREHOUSE TABLE
    ===================================== */

    renderWarehouses(containerId = "warehouse-table-container") {
      const container = document.getElementById(containerId);
      if (!container) return;

      const warehouses = this.getAll();

      container.innerHTML = `
        <div class="table-responsive">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Warehouse Code</th>
                <th>Warehouse Name</th>
                <th>Type</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${warehouses.map(item => `
                <tr>
                  <td>${escapeHTML(item.code)}</td>
                  <td>${escapeHTML(item.name)}</td>
                  <td>${escapeHTML(item.type)}</td>
                  <td>${escapeHTML(item.description)}</td>
                  <td>${item.active === false ? "Inactive" : "Active"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    },

    renderLocations(containerId = "warehouse-location-container") {
      const container = document.getElementById(containerId);
      if (!container) return;

      const locations = this.getLocations();

      if (!locations.length) {
        container.innerHTML = "<p>No rack/bin locations created.</p>";
        return;
      }

      container.innerHTML = `
        <div class="table-responsive">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>Rack</th>
                <th>Bin</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${locations.map(item => `
                <tr>
                  <td>${escapeHTML(item.warehouseCode)}</td>
                  <td>${escapeHTML(item.rack)}</td>
                  <td>${escapeHTML(item.bin)}</td>
                  <td>${escapeHTML(item.description)}</td>
                  <td>${item.active === false ? "Inactive" : "Active"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    },

    renderTransfers(containerId = "warehouse-transfer-container") {
      const container = document.getElementById(containerId);
      if (!container) return;

      const transfers = read(KEYS.transfers);

      if (!transfers.length) {
        container.innerHTML = "<p>No stock transfers available.</p>";
        return;
      }

      container.innerHTML = `
        <div class="table-responsive">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Transfer No.</th>
                <th>Material</th>
                <th>Batch</th>
                <th>Quantity</th>
                <th>From</th>
                <th>To</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${transfers.map(item => `
                <tr>
                  <td>${escapeHTML(item.transferNumber)}</td>
                  <td>${escapeHTML(item.materialCode)}</td>
                  <td>${escapeHTML(item.batchNumber)}</td>
                  <td>${item.quantity} ${escapeHTML(item.uom)}</td>
                  <td>${escapeHTML(item.fromWarehouse)}</td>
                  <td>${escapeHTML(item.toWarehouse)}</td>
                  <td>${escapeHTML(item.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    },

    renderAll() {
      this.initializeDefaults();
      this.renderWarehouses();
      this.renderLocations();
      this.renderTransfers();
    },

    initialize() {
      this.renderAll();
      console.log("CapMan Warehouse module initialized.");
    }
  };

  window.CapManWarehouse = Warehouse;

})();
      
