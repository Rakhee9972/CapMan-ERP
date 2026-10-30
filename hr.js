
/* =========================================================
   CAPMAN ERP - HR & MANPOWER MANAGEMENT
   File: hr.js

   Features:
   - Employee Master
   - Department Management
   - Shift Allocation
   - Daily Attendance
   - Machine Operator Allocation
   - Manpower Reports

   Prototype: LocalStorage-based
========================================================= */

(function () {
  "use strict";

  const EMPLOYEE_KEY = "capman_hr_employees";
  const ATTENDANCE_KEY = "capman_hr_attendance";
  const SHIFT_KEY = "capman_hr_shifts";
  const ALLOCATION_KEY = "capman_hr_machine_allocation";

  const HR = {
    employees: [],
    attendance: [],
    shifts: [],
    allocations: [],

    departments: [
      "Closure Production",
      "Wadding Production",
      "Packing",
      "Quality",
      "Maintenance",
      "Stores",
      "PPC",
      "Dispatch",
      "Administration"
    ],

    shiftTypes: ["A", "B", "C", "General"],

    load() {
      try {
        this.employees = JSON.parse(localStorage.getItem(EMPLOYEE_KEY)) || [];
        this.attendance = JSON.parse(localStorage.getItem(ATTENDANCE_KEY)) || [];
        this.shifts = JSON.parse(localStorage.getItem(SHIFT_KEY)) || [];
        this.allocations = JSON.parse(localStorage.getItem(ALLOCATION_KEY)) || [];
      } catch (error) {
        console.error("HR loading error:", error);
        this.employees = [];
        this.attendance = [];
        this.shifts = [];
        this.allocations = [];
      }
    },

    save() {
      localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(this.employees));
      localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(this.attendance));
      localStorage.setItem(SHIFT_KEY, JSON.stringify(this.shifts));
      localStorage.setItem(ALLOCATION_KEY, JSON.stringify(this.allocations));
    },

    id(prefix) {
      return prefix + "-" + Date.now() + "-" +
        Math.floor(Math.random() * 1000);
    },

    today() {
      const date = new Date();
      const localDate = new Date(
        date.getTime() - date.getTimezoneOffset() * 60000
      );
      return localDate.toISOString().slice(0, 10);
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
       EMPLOYEE MASTER
    ====================================== */

    addEmployee(data) {
      if (!data.name || !data.department || !data.designation) {
        throw new Error(
          "Employee name, department and designation are required."
        );
      }

      const employeeCode = String(data.employeeCode || this.id("EMP"))
        .trim();

      if (this.employees.some(e => e.employeeCode === employeeCode)) {
        throw new Error("Employee code already exists.");
      }

      const employee = {
        id: this.id("HR"),
        employeeCode,
        name: data.name.trim(),
        department: data.department,
        designation: data.designation.trim(),
        mobile: data.mobile || "",
        joiningDate: data.joiningDate || this.today(),
        experienceYears: Math.max(0, Number(data.experienceYears) || 0),
        employmentType: data.employmentType || "Permanent",
        status: "Active",
        createdAt: new Date().toISOString()
      };

      this.employees.push(employee);
      this.save();

      return employee;
    },

    updateEmployee(employeeId, updates) {
      const employee = this.employees.find(e => e.id === employeeId);
      if (!employee) throw new Error("Employee not found.");

      const allowed = [
        "name",
        "department",
        "designation",
        "mobile",
        "joiningDate",
        "experienceYears",
        "employmentType"
      ];

      allowed.forEach(key => {
        if (updates[key] !== undefined) {
          employee[key] = updates[key];
        }
      });

      this.save();
      return employee;
    },

    changeEmployeeStatus(employeeId, status) {
      const allowed = ["Active", "Inactive", "Resigned"];

      if (!allowed.includes(status)) {
        throw new Error("Invalid employee status.");
      }

      const employee = this.employees.find(e => e.id === employeeId);
      if (!employee) throw new Error("Employee not found.");

      employee.status = status;
      this.save();

      return employee;
    },

    getEmployee(employeeCode) {
      return this.employees.find(
        e => e.employeeCode === employeeCode
      ) || null;
    },

    getActiveEmployees() {
      return this.employees.filter(e => e.status === "Active");
    },

    getEmployeesByDepartment(department) {
      return this.employees.filter(
        e => e.department === department && e.status === "Active"
      );
    },

    /* =====================================
       SHIFT MASTER & ALLOCATION
    ====================================== */

    assignShift(data) {
      if (!data.employeeCode || !data.shift || !data.date) {
        throw new Error("Employee, shift and date are required.");
      }

      const employee = this.getEmployee(data.employeeCode);

      if (!employee || employee.status !== "Active") {
        throw new Error("Active employee not found.");
      }

      if (!this.shiftTypes.includes(data.shift)) {
        throw new Error("Invalid shift.");
      }

      const existing = this.shifts.find(s =>
        s.employeeCode === data.employeeCode &&
        s.date === data.date
      );

      if (existing) {
        existing.shift = data.shift;
        existing.department = data.department || employee.department;
        existing.remarks = data.remarks || "";
        this.save();
        return existing;
      }

      const shiftRecord = {
        id: this.id("SHIFT"),
        employeeCode: data.employeeCode,
        employeeName: employee.name,
        department: data.department || employee.department,
        shift: data.shift,
        date: data.date,
        remarks: data.remarks || "",
        createdAt: new Date().toISOString()
      };

      this.shifts.push(shiftRecord);
      this.save();

      return shiftRecord;
    },

    getEmployeeShift(employeeCode, date) {
      return this.shifts.find(s =>
        s.employeeCode === employeeCode &&
        s.date === date
      ) || null;
    },

    getShiftEmployees(shift, date) {
      return this.shifts.filter(s =>
        s.shift === shift && s.date === date
      );
    },

    /* =====================================
       DAILY ATTENDANCE
    ====================================== */

    markAttendance(data) {
      if (!data.employeeCode || !data.date || !data.status) {
        throw new Error(
          "Employee code, attendance date and status are required."
        );
      }

      const employee = this.getEmployee(data.employeeCode);

      if (!employee) throw new Error("Employee not found.");

      const allowed = [
        "Present",
        "Absent",
        "Leave",
        "Weekly Off",
        "Half Day"
      ];

      if (!allowed.includes(data.status)) {
        throw new Error("Invalid attendance status.");
      }

      const existing = this.attendance.find(a =>
        a.employeeCode === data.employeeCode &&
        a.date === data.date
      );

      if (existing) {
        existing.status = data.status;
        existing.inTime = data.inTime || "";
        existing.outTime = data.outTime || "";
        existing.remarks = data.remarks || "";
        existing.shift = data.shift || "";
        this.save();
        return existing;
      }

      const record = {
        id: this.id("ATT"),
        employeeCode: employee.employeeCode,
        employeeName: employee.name,
        department: employee.department,
        date: data.date,
        status: data.status,
        shift: data.shift || "",
        inTime: data.inTime || "",
        outTime: data.outTime || "",
        remarks: data.remarks || "",
        createdAt: new Date().toISOString()
      };

      this.attendance.push(record);
      this.save();

      return record;
    },

    getAttendanceByDate(date) {
      return this.attendance.filter(a => a.date === date);
    },

    getEmployeeAttendance(employeeCode, fromDate, toDate) {
      return this.attendance.filter(a => {
        if (a.employeeCode !== employeeCode) return false;
        if (fromDate && a.date < fromDate) return false;
        if (toDate && a.date > toDate) return false;
        return true;
      });
    },

    getAttendanceSummary(date) {
      const records = this.getAttendanceByDate(date);

      return {
        date,
        totalMarked: records.length,
        present: records.filter(a => a.status === "Present").length,
        absent: records.filter(a => a.status === "Absent").length,
        leave: records.filter(a => a.status === "Leave").length,
        weeklyOff: records.filter(a => a.status === "Weekly Off").length,
        halfDay: records.filter(a => a.status === "Half Day").length
      };
    },

    /* =====================================
       MACHINE OPERATOR ALLOCATION
    ====================================== */

    allocateMachine(data) {
      if (!data.employeeCode || !data.machineCode || !data.date) {
        throw new Error(
          "Employee, machine and allocation date are required."
        );
      }

      const employee = this.getEmployee(data.employeeCode);

      if (!employee || employee.status !== "Active") {
        throw new Error("Active employee not found.");
      }

      const allocation = {
        id: this.id("ALLOC"),
        employeeCode: employee.employeeCode,
        employeeName: employee.name,
        department: employee.department,
        machineCode: data.machineCode,
        shift: data.shift || "",
        date: data.date,
        role: data.role || "Machine Operator",
        remarks: data.remarks || "",
        status: "Allocated",
        createdAt: new Date().toISOString()
      };

      this.allocations.push(allocation);
      this.save();

      return allocation;
    },

    releaseMachineAllocation(allocationId) {
      const allocation = this.allocations.find(
        a => a.id === allocationId
      );

      if (!allocation) throw new Error("Allocation not found.");

      allocation.status = "Released";
      allocation.releasedAt = new Date().toISOString();

      this.save();
      return allocation;
    },

    getMachineOperators(machineCode, date, shift) {
      return this.allocations.filter(a =>
        a.machineCode === machineCode &&
        a.date === date &&
        a.status === "Allocated" &&
        (!shift || a.shift === shift)
      );
    },

    /* =====================================
       MANPOWER REPORTS
    ====================================== */

    getDepartmentSummary() {
      return this.departments.map(department => ({
        department,
        total: this.employees.filter(
          e => e.department === department
        ).length,
        active: this.employees.filter(
          e => e.department === department &&
          e.status === "Active"
        ).length,
        inactive: this.employees.filter(
          e => e.department === department &&
          e.status !== "Active"
        ).length
      }));
    },

    getManpowerSummary() {
      const active = this.getActiveEmployees();

      return {
        totalEmployees: this.employees.length,
        activeEmployees: active.length,
        inactiveEmployees: this.employees.filter(
          e => e.status !== "Active"
        ).length,
        closure: active.filter(
          e => e.department === "Closure Production"
        ).length,
        wadding: active.filter(
          e => e.department === "Wadding Production"
        ).length,
        packing: active.filter(
          e => e.department === "Packing"
        ).length,
        quality: active.filter(
          e => e.department === "Quality"
        ).length,
        maintenance: active.filter(
          e => e.department === "Maintenance"
        ).length
      };
    },

    getShiftSummary(date) {
      return this.shiftTypes.map(shift => ({
        shift,
        employees: this.getShiftEmployees(shift, date).length
      }));
    },

    getMachineAllocationReport(date) {
      return this.allocations.filter(a =>
        a.date === date && a.status === "Allocated"
      );
    },

    /* =====================================
       SEARCH & FILTER
    ====================================== */

    searchEmployees(searchText) {
      const term = String(searchText || "").toLowerCase();

      return this.employees.filter(e =>
        e.name.toLowerCase().includes(term) ||
        e.employeeCode.toLowerCase().includes(term) ||
        e.department.toLowerCase().includes(term) ||
        e.designation.toLowerCase().includes(term)
      );
    },

    filterEmployees(filters = {}) {
      return this.employees.filter(e => {
        if (filters.department &&
            e.department !== filters.department) return false;

        if (filters.status && e.status !== filters.status) return false;

        if (filters.designation &&
            e.designation !== filters.designation) return false;

        return true;
      });
    },

    /* =====================================
       EMPLOYEE TABLE RENDERING
    ====================================== */

    renderEmployees() {
      const container = document.getElementById(
        "hr-employee-container"
      );

      if (!container) return;

      if (!this.employees.length) {
        container.innerHTML = "<p>No employees registered.</p>";
        return;
      }

      const rows = this.employees.map(e => `
        <tr>
          <td>${this.escape(e.employeeCode)}</td>
          <td>${this.escape(e.name)}</td>
          <td>${this.escape(e.department)}</td>
          <td>${this.escape(e.designation)}</td>
          <td>${this.escape(e.mobile)}</td>
          <td>${this.escape(e.employmentType)}</td>
          <td>${this.escape(e.status)}</td>
        </tr>
      `).join("");

      container.innerHTML = `
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Employee Code</th>
                <th>Name</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Mobile</th>
                <th>Employment Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    },

    renderAttendance(date) {
      const container = document.getElementById(
        "hr-attendance-container"
      );

      if (!container) return;

      const records = this.getAttendanceByDate(date || this.today());

      if (!records.length) {
        container.innerHTML = "<p>No attendance records for this date.</p>";
        return;
      }

      const rows = records.map(a => `
        <tr>
          <td>${this.escape(a.employeeCode)}</td>
          <td>${this.escape(a.employeeName)}</td>
          <td>${this.escape(a.department)}</td>
          <td>${this.escape(a.shift)}</td>
          <td>${this.escape(a.status)}</td>
          <td>${this.escape(a.inTime)}</td>
          <td>${this.escape(a.outTime)}</td>
        </tr>
      `).join("");

      container.innerHTML = `
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Employee Code</th>
                <th>Employee Name</th>
                <th>Department</th>
                <th>Shift</th>
                <th>Status</th>
                <th>In Time</th>
                <th>Out Time</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    },

    initialize() {
      this.load();
      this.renderEmployees();
      this.renderAttendance();
      console.log("CapMan HR module initialized.");
    }
  };

  window.CapManHR = HR;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => HR.initialize());
  } else {
    HR.initialize();
  }

})();
        
