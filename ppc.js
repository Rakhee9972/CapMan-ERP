
/* =========================================================
   CAPMAN ERP - PRODUCTION PLANNING & CONTROL (PPC)
   File: ppc.js

   Features:
   1. Customer PO-based production planning
   2. Material Requirement Planning (MRP)
   3. Approved BOM validation
   4. Machine allocation
   5. Work order generation
   6. Production scheduling
   7. Material shortage report
   8. Machine load overview

   IMPORTANT:
   - Planning only. No automatic stock deduction.
   - No assumed machine capacity or BOM ratios.
   - BOM must be approved and have valid quantities.
========================================================= */

(function () {
  "use strict";

  const STORAGE = {
    plans: "capman_ppc_plans",
    workOrders: "capman_ppc_work_orders",
    schedules: "capman_ppc_schedule"
  };

  const DEPARTMENTS = {
    CLOSURE: "Closure",
    WADDING: "Wadding"
  };

  const STATUSES = [
    "Draft",
    "Planned",
    "Released",
    "In Progress",
    "Completed",
    "Cancelled"
  ];

  const Utils = {
    read(key) {
      try {
        return JSON.parse(localStorage.getItem(key)) || [];
      } catch (error) {
        console.error("PPC storage read error:", error);
        return [];
      }
    },

    save(key, data) {
      localStorage.setItem(key, JSON.stringify(data));
    },

    id(prefix) {
      return prefix + "-" +
        Date.now().toString(36).toUpperCase() +
        "-" + Math.random().toString(36).slice(2, 7).toUpperCase();
    },

    number(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    },

    date(value) {
      if (!value) return "";
      return String(value).slice(0, 10);
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

    notify(message, type = "info") {
      if (window.CapMan?.Notifications?.show) {
        window.CapMan.Notifications.show(message, type);
      } else {
        console.log("[PPC]", message);
      }
    }
  };

  const PPC = {

    /* ===============================
       DATA ACCESS
    =============================== */

    getPlans() {
      return Utils.read(STORAGE.plans);
    },

    getWorkOrders() {
      return Utils.read(STORAGE.workOrders);
    },

    getSchedules() {
      return Utils.read(STORAGE.schedules);
    },

    savePlans(data) {
      Utils.save(STORAGE.plans, data);
    },

    saveWorkOrders(data) {
      Utils.save(STORAGE.workOrders, data);
    },

    saveSchedules(data) {
      Utils.save(STORAGE.schedules, data);
    },

    /* ===============================
       MASTER DATA ADAPTERS
    =============================== */

    getSalesOrders() {
      const sales = window.CapManSales;
      if (!sales) return [];

      if (typeof sales.getOrders === "function") {
        return sales.getOrders() || [];
      }

      return Array.isArray(sales.orders) ? sales.orders : [];
    },

    getApprovedBOM(productCode) {
      const bom = window.CapManBOM;
      if (!bom) {
        throw new Error("BOM module is not connected.");
      }

      let records = [];

      if (typeof bom.getBOMs === "function") {
        records = bom.getBOMs() || [];
      } else if (typeof bom.getAll === "function") {
        records = bom.getAll() || [];
      } else if (Array.isArray(bom.boms)) {
        records = bom.boms;
      }

      const matching = records.filter(item => {
        const code = item.productCode || item.outputCode || item.code;
        return code === productCode &&
          String(item.status || "").toLowerCase() === "approved" &&
          item.active !== false;
      });

      if (!matching.length) {
        throw new Error(
          "No approved BOM found for " + productCode
        );
      }

      matching.sort((a, b) =>
        Utils.number(b.version) - Utils.number(a.version)
      );

      return matching[0];
    },

    getInventoryBalance(materialCode) {
      const inventory = window.CapManInventory;

      if (!inventory) {
        return {
          available: 0,
          connected: false
        };
      }

      let summary = [];

      if (typeof inventory.getSummary === "function") {
        summary = inventory.getSummary() || [];
      } else if (typeof inventory.getStockSummary === "function") {
        summary = inventory.getStockSummary() || [];
      }

      const item = summary.find(row =>
        (row.materialCode || row.code) === materialCode
      );

      if (!item) {
        return {
          available: 0,
          connected: true
        };
      }

      const available = Utils.number(
        item.availableQty ??
        item.available ??
        item.closingStock ??
        item.balance ??
        item.quantity
      );

      return {
        available: Math.max(0, available),
        connected: true
      };
    },

    getMachines(department) {
      const machines = window.CapManMachines;
      if (!machines) return [];

      let records = [];

      if (typeof machines.getAll === "function") {
        records = machines.getAll() || [];
      } else if (Array.isArray(machines.machines)) {
        records = machines.machines;
      }

      return records.filter(machine => {
        const dept = String(
          machine.department || machine.type || ""
        ).toLowerCase();

        const code = machine.machineCode || machine.code || "";

        if (department === DEPARTMENTS.CLOSURE) {
          return dept.includes("closure") ||
            String(code).startsWith("IM-");
        }

        if (department === DEPARTMENTS.WADDING) {
          return dept.includes("wadding") ||
            String(code).startsWith("WD-");
        }

        return false;
      });
    },

    /* ===============================
       CUSTOMER DEMAND
    =============================== */

    getOrderBalance(order) {
      const ordered = Utils.number(
        order.quantity || order.orderQty
      );

      const produced = Utils.number(order.producedQty);
      const cancelled = Utils.number(order.cancelledQty);

      return Math.max(
        0,
        ordered - produced - cancelled
      );
    },

    getDemandList() {
      return this.getSalesOrders()
        .filter(order => {
          const status = String(order.status || "").toLowerCase();

          return ![
            "cancelled",
            "closed",
            "completed"
          ].includes(status);
        })
        .map(order => ({
          orderId: order.id || order.orderId,
          poNumber: order.poNumber || order.customerPONumber || "",
          customer: order.customerName || order.customer || "",
          productCode: order.productCode || order.itemCode || "",
          quantity: this.getOrderBalance(order),
          priority: order.priority || "Normal",
          deliveryDate: order.deliveryDate || "",
          original: order
        }))
        .filter(item => item.quantity > 0);
    },

    /* ===============================
       BOM VALIDATION
    =============================== */

    validateBOM(bom) {
      const components =
        bom.components || bom.items || bom.materials || [];

      if (!components.length) {
        throw new Error("BOM has no component lines.");
      }

      components.forEach(component => {
        const code =
          component.materialCode ||
          component.componentCode ||
          component.code;

        const qty = Utils.number(
          component.quantity ??
          component.qty ??
          component.baseQuantity
        );

        const uom = component.uom || component.unit;

        if (!code || qty <= 0 || !uom) {
          throw new Error(
            "BOM contains missing material, quantity or UOM."
          );
        }
      });

      return components;
    },

    /* ===============================
       MATERIAL REQUIREMENT PLANNING
    =============================== */

    calculateMRP(productCode, productionQty) {
      productionQty = Utils.number(productionQty);

      if (productionQty <= 0) {
        throw new Error("Enter a valid production quantity.");
      }

      const bom = this.getApprovedBOM(productCode);
      const components = this.validateBOM(bom);

      const requirements = components.map(component => {
        const materialCode =
          component.materialCode ||
          component.componentCode ||
          component.code;

        const perUnit = Utils.number(
          component.quantity ??
          component.qty ??
          component.baseQuantity
        );

        const baseQty = Utils.number(
          bom.baseQuantity || bom.outputQuantity || 1
        );

        if (baseQty <= 0) {
          throw new Error("Invalid BOM base quantity.");
        }

        const required = (productionQty / baseQty) * perUnit;
        const stock = this.getInventoryBalance(materialCode);

        return {
          materialCode,
          materialName:
            component.materialName ||
            component.description ||
            materialCode,
          uom: component.uom || component.unit,
          perUnit,
          requiredQty: required,
          availableQty: stock.available,
          shortageQty: Math.max(0, required - stock.available),
          inventoryConnected: stock.connected
        };
      });

      return {
        productCode,
        productionQty,
        bomCode: bom.bomCode || bom.code || "",
        bomVersion: bom.version || 1,
        requirements,
        totalShortageLines: requirements.filter(
          item => item.shortageQty > 0
        ).length,
        calculatedAt: new Date().toISOString()
      };
    },

    /* ===============================
       CREATE PRODUCTION PLAN
    =============================== */

    createPlan(data) {
      if (!data.orderId) {
        throw new Error("Select a customer order.");
      }

      if (!data.productCode) {
        throw new Error("Product code is required.");
      }

      const quantity = Utils.number(data.quantity);

      if (quantity <= 0) {
        throw new Error("Enter a valid planning quantity.");
      }

      const plan = {
        id: Utils.id("PLAN"),
        planNumber: Utils.id("PPC"),
        orderId: data.orderId,
        poNumber: data.poNumber || "",
        customer: data.customer || "",
        productCode: data.productCode,
        plannedQty: quantity,
        priority: data.priority || "Normal",
        deliveryDate: data.deliveryDate || "",
        plannedStart: data.plannedStart || "",
        plannedEnd: data.plannedEnd || "",
        status: "Draft",
        createdAt: new Date().toISOString(),
        createdBy: data.createdBy || "System"
      };

      const plans = this.getPlans();
      plans.push(plan);
      this.savePlans(plans);

      Utils.notify("Production plan created.", "success");
      return plan;
    },

    /* ===============================
       CHECK MATERIALS
    =============================== */

    checkPlanMaterials(planId) {
      const plan = this.getPlans().find(
        item => item.id === planId
      );

      if (!plan) {
        throw new Error("Production plan not found.");
      }

      const mrp = this.calculateMRP(
        plan.productCode,
        plan.plannedQty
      );

      const plans = this.getPlans();
      const index = plans.findIndex(item => item.id === planId);

      plans[index].mrp = mrp;
      plans[index].materialStatus =
        mrp.totalShortageLines > 0
          ? "Shortage"
          : "Available";

      plans[index].updatedAt = new Date().toISOString();

      this.savePlans(plans);

      return mrp;
    },

    /* ===============================
       MACHINE ALLOCATION
    =============================== */

    allocateMachine(data) {
      const department = data.department;

      if (![
        DEPARTMENTS.CLOSURE,
        DEPARTMENTS.WADDING
      ].includes(department)) {
        throw new Error("Invalid department.");
      }

      if (!data.machineCode) {
        throw new Error("Select a machine.");
      }

      const machines = this.getMachines(department);

      const exists = machines.some(machine =>
        (machine.machineCode || machine.code) === data.machineCode
      );

      if (!exists) {
        throw new Error(
          "Selected machine is not available in this department."
        );
      }

      const schedules = this.getSchedules();

      const start = data.startDateTime;
      const end = data.endDateTime;

      if (!start || !end || new Date(end) <= new Date(start)) {
        throw new Error("Enter a valid schedule time range.");
      }

      const conflict = schedules.some(item =>
        item.machineCode === data.machineCode &&
        item.status !== "Cancelled" &&
        new Date(start) < new Date(item.endDateTime) &&
        new Date(end) > new Date(item.startDateTime)
      );

      if (conflict) {
        throw new Error(
          "Machine already has an overlapping schedule."
        );
      }

      return {
        id: Utils.id("SCH"),
        machineCode: data.machineCode,
        department,
        shift: data.shift || "",
        startDateTime: start,
        endDateTime: end,
        plannedQty: Utils.number(data.plannedQty),
        status: "Scheduled"
      };
    },

    /* ===============================
       WORK ORDER GENERATION
    =============================== */

    createWorkOrder(data) {
      const plan = this.getPlans().find(
        item => item.id === data.planId
      );

      if (!plan) {
        throw new Error("Production plan not found.");
      }

      if (plan.status === "Cancelled") {
        throw new Error("Cannot create work order for cancelled plan.");
      }

      const department = data.department;

      if (![
        DEPARTMENTS.CLOSURE,
        DEPARTMENTS.WADDING
      ].includes(department)) {
        throw new Error("Invalid production department.");
      }

      const quantity = Utils.number(data.plannedQty);

      if (quantity <= 0 || quantity > plan.plannedQty) {
        throw new Error("Invalid work order quantity.");
      }

      const workOrder = {
        id: Utils.id("WO"),
        workOrderNumber: Utils.id("CAPMAN-WO"),
        planId: plan.id,
        orderId: plan.orderId,
        poNumber: plan.poNumber,
        productCode: data.productCode || plan.productCode,
        department,
        plannedQty: quantity,
        actualQty: 0,
        rejectedQty: 0,
        goodQty: 0,
        machineCode: data.machineCode || "",
        shift: data.shift || "",
        plannedStart: data.plannedStart || "",
        plannedEnd: data.plannedEnd || "",
        status: "Draft",
        createdAt: new Date().toISOString()
      };

      const orders = this.getWorkOrders();
      orders.push(workOrder);
      this.saveWorkOrders(orders);

      Utils.notify("Work order created.", "success");
      return workOrder;
    },

    /* ===============================
       RELEASE WORK ORDER
    =============================== */

    updateWorkOrderStatus(workOrderId, newStatus) {
      if (!STATUSES.includes(newStatus)) {
        throw new Error("Invalid work order status.");
      }

      const orders = this.getWorkOrders();
      const index = orders.findIndex(
        item => item.id === workOrderId
      );

      if (index === -1) {
        throw new Error("Work order not found.");
      }

      const order = orders[index];

      const transitions = {
        Draft: ["Planned", "Cancelled"],
        Planned: ["Released", "Cancelled"],
        Released: ["In Progress", "Cancelled"],
        "In Progress": ["Completed"],
        Completed: [],
        Cancelled: []
      };

      if (!transitions[order.status].includes(newStatus)) {
        throw new Error(
          "Invalid status transition: " +
          order.status + " to " + newStatus
        );
      }

      if (newStatus === "Released") {
        if (!order.machineCode) {
          throw new Error("Allocate a machine before release.");
        }

        const plan = this.getPlans().find(
          item => item.id === order.planId
        );

        if (!plan || plan.materialStatus !== "Available") {
          throw new Error(
            "Complete MRP and resolve material shortages before release."
          );
        }
      }

      order.status = newStatus;
      order.updatedAt = new Date().toISOString();

      this.saveWorkOrders(orders);
      return order;
    },

    /* ===============================
       SAVE MACHINE SCHEDULE
    =============================== */

    saveSchedule(data) {
      const schedule = this.allocateMachine(data);
      schedule.workOrderId = data.workOrderId || "";

      const schedules = this.getSchedules();
      schedules.push(schedule);

      this.saveSchedules(schedules);
      return schedule;
    },

    /* ===============================
       RECORD PLAN ACTUALS
       Planning module does not post stock.
    =============================== */

    updateWorkOrderActuals(workOrderId, actualQty, rejectedQty) {
      const orders = this.getWorkOrders();
      const index = orders.findIndex(
        item => item.id === workOrderId
      );

      if (index === -1) {
        throw new Error("Work order not found.");
      }

      const order = orders[index];

      if (!["Released", "In Progress"].includes(order.status)) {
        throw new Error(
          "Work order must be released before recording actuals."
        );
      }

      actualQty = Utils.number(actualQty);
      rejectedQty = Utils.number(rejectedQty);

      if (
        actualQty < 0 ||
        rejectedQty < 0 ||
        rejectedQty > actualQty ||
        actualQty > order.plannedQty
      ) {
        throw new Error("Invalid production quantities.");
      }

      order.actualQty = actualQty;
      order.rejectedQty = rejectedQty;
      order.goodQty = actualQty - rejectedQty;

      order.status = "In Progress";
      order.updatedAt = new Date().toISOString();

      this.saveWorkOrders(orders);
      return order;
    },

    /* ===============================
       PRODUCTION PLAN STATUS
    =============================== */

    updatePlanStatus(planId, status) {
      const plans = this.getPlans();
      const index = plans.findIndex(
        item => item.id === planId
      );

      if (index === -1) {
        throw new Error("Plan not found.");
      }

      if (!["Draft", "Planned", "Cancelled"].includes(status)) {
        throw new Error("Invalid plan status.");
      }

      if (status === "Planned" && !plans[index].mrp) {
        throw new Error("Run MRP before confirming the plan.");
      }

      plans[index].status = status;
      plans[index].updatedAt = new Date().toISOString();

      this.savePlans(plans);
      return plans[index];
    },

    /* ===============================
       REPORTS
    =============================== */

    getMaterialShortageReport() {
      return this.getPlans()
        .filter(plan => plan.mrp)
        .flatMap(plan =>
          (plan.mrp.requirements || [])
            .filter(item => item.shortageQty > 0)
            .map(item => ({
              planNumber: plan.planNumber,
              productCode: plan.productCode,
              materialCode: item.materialCode,
              requiredQty: item.requiredQty,
              availableQty: item.availableQty,
              shortageQty: item.shortageQty,
              uom: item.uom
            }))
        );
    },

    getMachineLoadReport() {
      const schedules = this.getSchedules();

      return this.getMachines(DEPARTMENTS.CLOSURE)
        .concat(this.getMachines(DEPARTMENTS.WADDING))
        .map(machine => {
          const code = machine.machineCode || machine.code;

          const assigned = schedules.filter(item =>
            item.machineCode === code &&
            item.status !== "Cancelled"
          );

   
