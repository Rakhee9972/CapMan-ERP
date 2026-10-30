
/* =========================================================
   CAPMAN ERP - MAINTENANCE MANAGEMENT
   File: maintenance.js
   Features:
   - Preventive maintenance schedule
   - Breakdown register
   - Downtime tracking
   - Maintenance work orders
   - Spare parts usage records
   - Machine-wise maintenance history

   Prototype: LocalStorage-based.
   Spare parts are recorded here but are NOT deducted
   from inventory until ERP integration is completed.
========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "capman_maintenance_records";
  const PM_KEY = "capman_pm_schedules";
  const PARTS_KEY = "capman_maintenance_parts";

  const Maintenance = {
    records: [],
    schedules: [],
    parts: [],

    load() {
      try {
        this.records = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        this.schedules = JSON.parse(localStorage.getItem(PM_KEY)) || [];
        this.parts = JSON.parse(localStorage.getItem(PARTS_KEY)) || [];
      } catch (error) {
        console.error("Maintenance data loading error:", error);
        this.records = [];
        this.schedules = [];
        this.parts = [];
      }
    },

    save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
      localStorage.setItem(PM_KEY, JSON.stringify(this.schedules));
      localStorage.setItem(PARTS_KEY, JSON.stringify(this.parts));
    },

    id(prefix) {
      return prefix + "-" + Date.now() + "-" +
        Math.floor(Math.random() * 1000);
    },

    dateNow() {
      return new Date().toISOString();
    },

    validNumber(value, fieldName) {
      const number = Number(value);

      if (!Number.isFinite(number) || number < 0) {
        throw new Error(fieldName + " must be a valid non-negative number.");
      }

      return number;
    },

    getMachine(machineCode) {
      if (!machineCode) {
        throw new Error("Machine code is required.");
      }

      if (
        window.CapManMachines &&
        typeof window.CapManMachines.getByCode === "function"
      ) {
        const machine = window.CapManMachines.getByCode(machineCode);
        if (!machine) throw new Error("Machine not found.");
        return machine;
      }

      return { code: machineCode };
    },

    /* -------------------------------
       PREVENTIVE MAINTENANCE
    -------------------------------- */

    addSchedule(data) {
      if (!data.machineCode || !data.description || !data.dueDate) {
        throw new Error("Machine, description and due date are required.");
      }

      this.getMachine(data.machineCode);

      const intervalDays = this.validNumber(
        data.intervalDays || 0,
        "Interval days"
      );

      const schedule = {
        id: this.id("PM"),
        machineCode: data.machineCode,
        description: data.description.trim(),
        maintenanceType: data.maintenanceType || "Preventive",
        intervalDays,
        dueDate: data.dueDate,
        assignedTo: data.assignedTo || "",
        status: "Scheduled",
        lastCompletedDate: null,
        createdAt: this.dateNow()
      };

      this.schedules.push(schedule);
      this.save();

      return schedule;
    },

    updateSchedule(scheduleId, updates) {
      const schedule = this.schedules.find(s => s.id === scheduleId);
      if (!schedule) throw new Error("PM schedule not found.");

      if (updates.description !== undefined) {
        schedule.description = String(updates.description).trim();
      }

      if (updates.dueDate !== undefined) {
        schedule.dueDate = updates.dueDate;
      }

      if (updates.assignedTo !== undefined) {
        schedule.assignedTo = updates.assignedTo;
      }

      if (updates.status !== undefined) {
        schedule.status = updates.status;
      }

      this.save();
      return schedule;
    },

    completeSchedule(scheduleId, completedDate) {
      const schedule = this.schedules.find(s => s.id === scheduleId);
      if (!schedule) throw new Error("PM schedule not found.");

      const completed = completedDate || new Date().toISOString().slice(0, 10);

      schedule.lastCompletedDate = completed;
      schedule.status = "Completed";

      if (schedule.intervalDays > 0) {
        const nextDate = new Date(completed + "T00:00:00");
        nextDate.setDate(nextDate.getDate() + schedule.intervalDays);
        schedule.dueDate = nextDate.toISOString().slice(0, 10);
        schedule.status = "Scheduled";
      }

      this.save();
      return schedule;
    },

    getDueSchedules() {
      const today = new Date().toISOString().slice(0, 10);

      return this.schedules.filter(s =>
        s.status !== "Cancelled" &&
        s.dueDate <= today
      );
    },

    /* -------------------------------
       BREAKDOWN REGISTER
    -------------------------------- */

    reportBreakdown(data) {
      if (!data.machineCode || !data.problem) {
        throw new Error("Machine and breakdown problem are required.");
      }

      this.getMachine(data.machineCode);

      const record = {
        id: this.id("BRK"),
        workOrderNo: this.id("MWO"),
        machineCode: data.machineCode,
        department: data.department || "",
        problem: data.problem.trim(),
        breakdownCategory: data.breakdownCategory || "Mechanical",
        priority: data.priority || "Medium",
        reportedBy: data.reportedBy || "",
        assignedTo: data.assignedTo || "",
        startTime: data.startTime || this.dateNow(),
        endTime: null,
        downtimeMinutes: 0,
        rootCause: "",
        correctiveAction: "",
        preventiveAction: "",
        sparePartsUsed: [],
        status: "Open",
        createdAt: this.dateNow(),
        completedAt: null
      };

      this.records.push(record);
      this.save();

      return record;
    },

    startMaintenance(recordId, technician) {
      const record = this.records.find(r => r.id === recordId);
      if (!record) throw new Error("Maintenance record not found.");

      if (record.status === "Completed") {
        throw new Error("Completed maintenance cannot be restarted.");
      }

      record.status = "In Progress";
      record.assignedTo = technician || record.assignedTo;
      record.workStartedAt = this.dateNow();

      this.save();
      return record;
    },

    completeMaintenance(recordId, data) {
      const record = this.records.find(r => r.id === recordId);
      if (!record) throw new Error("Maintenance record not found.");

      if (record.status === "Completed") {
        throw new Error("This maintenance record is already completed.");
      }

      const endTime = data.endTime || this.dateNow();
      const start = new Date(record.startTime).getTime();
      const end = new Date(endTime).getTime();

      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        throw new Error("Invalid maintenance start or end time.");
      }

      record.endTime = endTime;
      record.downtimeMinutes = Math.round((end - start) / 60000);
      record.rootCause = data.rootCause || "";
      record.correctiveAction = data.correctiveAction || "";
      record.preventiveAction = data.preventiveAction || "";
      record.status = "Completed";
      record.completedAt = this.dateNow();

      this.save();
      return record;
    },

    updateStatus(recordId, status) {
      const allowed = ["Open", "In Progress", "On Hold", "Completed"];

      if (!allowed.includes(status)) {
        throw new Error("Invalid maintenance status.");
      }

      const record = this.records.find(r => r.id === recordId);
      if (!record) throw new Error("Maintenance record not found.");

      if (record.status === "Completed" && status !== "Completed") {
        throw new Error("Completed record cannot be reopened here.");
      }

      record.status = status;
      this.save();

      return record;
    },

    /* -------------------------------
       SPARE PARTS USAGE REGISTER
    -------------------------------- */

    recordSparePart(data) {
      if (!data.recordId || !data.partName) {
        throw new Error("Maintenance record and spare part are required.");
      }

      const record = this.records.find(r => r.id === data.recordId);
      if (!record) throw new Error("Maintenance record not found.");

      if (record.status === "Completed") {
        throw new Error("Cannot add parts to completed maintenance.");
      }

      const quantity = this.validNumber(data.quantity, "Quantity");

      if (quantity <= 0) {
        throw new Error("Spare part quantity must be greater than zero.");
      }

      const part = {
        id: this.id("PART"),
        recordId: data.recordId,
        machineCode: record.machineCode,
        partName: data.partName.trim(),
        partCode: data.partCode || "",
        quantity,
        unit: data.unit || "PCS",
        remarks: data.remarks || "",
        recordedAt: this.dateNow()
      };

      this.parts.push(part);
      record.sparePartsUsed.push(part.id);

      this.save();
      return part;
    },

    getPartsByRecord(recordId) {
      return this.parts.filter(p => p.recordId === recordId);
    },

    /* -------------------------------
       REPORTS AND SUMMARY
    -------------------------------- */

    getSummary() {
      const total = this.records.length;
      const open = this.records.filter(r => r.status === "Open").length;
      const inProgress = this.records.filter(
        r => r.status === "In Progress"
      ).length;
      const completed = this.records.filter(
        r => r.status === "Completed"
      ).length;

      const totalDowntime = this.records.reduce(
        (sum, r) => sum + Number(r.downtimeMinutes || 0),
        0
      );

      return {
        totalBreakdowns: total,
        open,
        inProgress,
        completed,
        totalDowntimeMinutes: totalDowntime,
        totalDowntimeHours: Number((totalDowntime / 60).toFixed(2)),
        pmSchedules: this.schedules.length,
        pmDue: this.getDueSchedules().length
      };
    },

    getMachineHistory(machineCode) {
      return this.records
        .filter(r => r.machineCode === machineCode)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    getBreakdownReport() {
      return this.records.map(r => ({
        workOrderNo: r.workOrderNo,
        machineCode: r.machineCode,
        problem: r.problem,
        category: r.breakdownCategory,
        priority: r.priority,
        status: r.status,
        downtimeMinutes: r.downtimeMinutes,
        assignedTo: r.assignedTo
      }));
    },

    getPMReport() {
      return this.schedules.map(s => ({
        id: s.id,
        machineCode: s.machineCode,
        description: s.description,
        dueDate: s.dueDate,
        status: s.status,
        assignedTo: s.assignedTo
      }));
    },

    /* -------------------------------
       SEARCH AND FILTER
    -------------------------------- */

    filterRecords(filters = {}) {
      return this.records.filter(r => {
        if (filters.machineCode &&
            r.machineCode !== filters.machineCode) return false;

        if (filters.status && r.status !== filters.status) return false;

        if (filters.priority && r.priority !== filters.priority) return false;

        if (filters.department &&
            r.department !== filters.department) return false;

        return true;
      });
    },

    /* -------------------------------
       TABLE RENDERING
    -------------------------------- */

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
        "maintenance-table-container"
      );

      if (!container) return;

      if (!this.records.length) {
        container.innerHTML = "<p>No maintenance records found.</p>";
        return;
      }

      const rows = this.records.map(record => `
        <tr>
          <td>${this.escape(record.workOrderNo)}</td>
          <td>${this.escape(record.machineCode)}</td>
          <td>${this.escape(record.problem)}</td>
          <td>${this.escape(record.priority)}</td>
          <td>${this.escape(record.assignedTo)}</td>
          <td>${this.escape(record.downtimeMinutes)}</td>
          <td>${this.escape(record.status)}</td>
        </tr>
      `).join("");

      container.innerHTML = `
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Work Order</th>
                <th>Machine</th>
                <th>Problem</th>
                <th>Priority</th>
                <th>Technician</th>
                <th>Downtime (Min)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    },

    renderPMSchedules() {
      const container = document.getElementById(
        "maintenance-pm-container"
      );

      if (!container) return;

      if (!this.schedules.length) {
        container.innerHTML = "<p>No PM schedules found.</p>";
        return;
      }

      const rows = this.schedules.map(s => `
        <tr>
          <td>${this.escape(s.machineCode)}</td>
          <td>${this.escape(s.description)}</td>
          <td>${this.escape(s.dueDate)}</td>
          <td>${this.escape(s.intervalDays)}</td>
          <td>${this.escape(s.assignedTo)}</td>
          <td>${this.escape(s.status)}</td>
        </tr>
      `).join("");

      container.innerHTML = `
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Machine</th>
                <th>PM Activity</th>
                <th>Due Date</th>
                <th>Interval (Days)</th>
                <th>Assigned To</th>
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
      this.render();
      this.renderPMSchedules();
      console.log("CapMan Maintenance module initialized.");
    }
  };

  window.CapManMaintenance = Maintenance;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      Maintenance.initialize();
    });
  } else {
    Maintenance.initialize();
  }

})();
