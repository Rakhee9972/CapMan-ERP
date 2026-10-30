
/* =========================================================
   CAPMAN ERP - USER MASTER & ACCESS MANAGEMENT
   File: users.js

   Features:
   - User Master
   - Employee Linking
   - Role Assignment
   - Module Permissions
   - Activate / Deactivate Users
   - Login Activity Log

   IMPORTANT:
   This is a frontend prototype.
   It does NOT provide secure authentication.
   Never store real passwords in LocalStorage.
========================================================= */

(function () {
  "use strict";

  const USER_KEY = "capman_erp_users";
  const ACTIVITY_KEY = "capman_erp_user_activity";

  const Users = {
    users: [],
    activities: [],

    modules: [
      "DASHBOARD",
      "SALES",
      "PURCHASE",
      "PPC",
      "MACHINES",
      "MATERIALS",
      "BOM",
      "INVENTORY",
      "PRODUCTION",
      "QUALITY",
      "MAINTENANCE",
      "HR",
      "TRACEABILITY",
      "REPORTS",
      "SETTINGS",
      "USER_MANAGEMENT"
    ],

    load() {
      try {
        this.users =
          JSON.parse(localStorage.getItem(USER_KEY)) || [];

        this.activities =
          JSON.parse(localStorage.getItem(ACTIVITY_KEY)) || [];
      } catch (error) {
        console.error("User module loading error:", error);
        this.users = [];
        this.activities = [];
      }
    },

    save() {
      localStorage.setItem(USER_KEY, JSON.stringify(this.users));
      localStorage.setItem(
        ACTIVITY_KEY,
        JSON.stringify(this.activities)
      );
    },

    id(prefix) {
      return prefix + "-" + Date.now() + "-" +
        Math.floor(Math.random() * 10000);
    },

    /* =====================================
       HELPERS
    ====================================== */

    normalizeUsername(username) {
      return String(username || "").trim().toLowerCase();
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

    getSettings() {
      return window.CapManSettings || null;
    },

    getRole(roleCode) {
      const settings = this.getSettings();

      if (!settings || typeof settings.getRole !== "function") {
        throw new Error("ERP Settings module is not available.");
      }

      return settings.getRole(roleCode);
    },

    /* =====================================
       USER MASTER
    ====================================== */

    createUser(data) {
      if (!data.name || !data.username || !data.roleCode) {
        throw new Error(
          "Name, username and role are required."
        );
      }

      const username = this.normalizeUsername(data.username);

      if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
        throw new Error(
          "Username must be 3-40 characters and contain only letters, numbers, dots, underscores or hyphens."
        );
      }

      if (this.users.some(u => u.username === username)) {
        throw new Error("Username already exists.");
      }

      const role = this.getRole(data.roleCode);

      if (!role || role.status !== "Active") {
        throw new Error("Select a valid active role.");
      }

      const user = {
        id: this.id("USER"),
        userCode: this.id("USR"),
        name: String(data.name).trim(),
        username,
        email: String(data.email || "").trim(),
        employeeCode: data.employeeCode || "",
        department: data.department || "",
        designation: data.designation || "",
        roleCode: role.code,
        roleName: role.name,
        status: "Active",
        mustChangePassword: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
        lastLoginStatus: null
      };

      this.users.push(user);
      this.save();

      return user;
    },

    updateUser(userId, updates) {
      const user = this.users.find(u => u.id === userId);

      if (!user) throw new Error("User not found.");

      const allowed = [
        "name",
        "email",
        "employeeCode",
        "department",
        "designation"
      ];

      allowed.forEach(key => {
        if (updates[key] !== undefined) {
          user[key] = String(updates[key]).trim();
        }
      });

      if (updates.roleCode !== undefined) {
        const role = this.getRole(updates.roleCode);

        if (!role || role.status !== "Active") {
          throw new Error("Select a valid active role.");
        }

        user.roleCode = role.code;
        user.roleName = role.name;
      }

      this.save();
      return user;
    },

    changeStatus(userId, status) {
      if (!["Active", "Inactive", "Locked"].includes(status)) {
        throw new Error("Invalid user status.");
      }

      const user = this.users.find(u => u.id === userId);

      if (!user) throw new Error("User not found.");

      user.status = status;
      this.save();

      return user;
    },

    getUser(userId) {
      return this.users.find(u => u.id === userId) || null;
    },

    getUserByUsername(username) {
      const normalized = this.normalizeUsername(username);

      return this.users.find(u =>
        u.username === normalized
      ) || null;
    },

    getActiveUsers() {
      return this.users.filter(u => u.status === "Active");
    },

    getUsersByDepartment(department) {
      return this.users.filter(u =>
        u.department === department
      );
    },

    /* =====================================
       EMPLOYEE LINKING
    ====================================== */

    linkEmployee(userId, employeeCode) {
      const user = this.getUser(userId);

      if (!user) throw new Error("User not found.");

      const hr = window.CapManHR;

      if (!hr || typeof hr.getEmployee !== "function") {
        throw new Error("HR module is not available.");
      }

      const employee = hr.getEmployee(employeeCode);

      if (!employee) throw new Error("Employee not found.");

      const alreadyLinked = this.users.some(u =>
        u.employeeCode === employeeCode &&
        u.id !== userId
      );

      if (alreadyLinked) {
        throw new Error("Employee is already linked to another user.");
      }

      user.employeeCode = employee.employeeCode;
      user.name = employee.name;
      user.department = employee.department;
      user.designation = employee.designation;

      this.save();
      return user;
    },

    /* =====================================
       ROLE & PERMISSIONS
    ====================================== */

    getPermissions(userId) {
      const user = this.getUser(userId);

      if (!user) throw new Error("User not found.");

      const role = this.getRole(user.roleCode);

      if (!role || role.status !== "Active") return [];

      return [...role.permissions];
    },

    hasPermission(userId, moduleName) {
      const user = this.getUser(userId);

      if (!user || user.status !== "Active") return false;

      const role = this.getRole(user.roleCode);

      if (!role || role.status !== "Active") return false;

      return role.permissions.includes("ALL") ||
        role.permissions.includes(moduleName);
    },

    getAccessibleModules(userId) {
      const user = this.getUser(userId);

      if (!user || user.status !== "Active") return [];

      const permissions = this.getPermissions(userId);

      if (permissions.includes("ALL")) {
        return [...this.modules];
      }

      return this.modules.filter(module =>
        permissions.includes(module)
      );
    },

    /* =====================================
       LOGIN ACTIVITY PLACEHOLDER
    ====================================== */

    /*
      This method records an event supplied by the UI.
      It does NOT authenticate the user.
      Real login verification must happen on a backend.
    */

    recordLoginEvent(username, result) {
      const user = this.getUserByUsername(username);

      const activity = {
        id: this.id("LOGIN"),
        userId: user ? user.id : null,
        username: this.normalizeUsername(username),
        event: result === "Success" ? "Login Success" : "Login Failed",
        timestamp: new Date().toISOString()
      };

      this.activities.push(activity);

      if (user && result === "Success") {
        user.lastLoginAt = activity.timestamp;
        user.lastLoginStatus = "Success";
      }

      this.save();
      return activity;
    },

    getUserActivity(userId) {
      return this.activities.filter(
        a => a.userId === userId
      ).sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
      );
    },

    /* =====================================
       SEARCH & FILTER
    ====================================== */

    searchUsers(searchText) {
      const term = String(searchText || "").toLowerCase();

      return this.users.filter(u =>
        u.name.toLowerCase().includes(term) ||
        u.username.includes(term) ||
        u.userCode.toLowerCase().includes(term) ||
        u.department.toLowerCase().includes(term)
      );
    },

    filterUsers(filters = {}) {
      return this.users.filter(u => {
        if (filters.department &&
            u.department !== filters.department) return false;

        if (filters.roleCode &&
            u.roleCode !== filters.roleCode) return false;

        if (filters.status &&
            u.status !== filters.status) return false;

        return true;
      });
    },

    /* =====================================
       USER SUMMARY
    ====================================== */

    getSummary() {
      return {
        totalUsers: this.users.length,

        activeUsers: this.users.filter(
          u => u.status === "Active"
        ).length,

        inactiveUsers: this.users.filter(
          u => u.status === "Inactive"
        ).length,

        lockedUsers: this.users.filter(
          u => u.status === "Locked"
        ).length,

        linkedEmployees: this.users.filter(
          u => Boolean(u.employeeCode)
        ).length,

        unlinkedUsers: this.users.filter(
          u => !u.employeeCode
        ).length
      };
    },

    /* =====================================
       TABLE RENDERING
    ====================================== */

    renderUsers() {
      const container = document.getElementById(
        "users-table-container"
      );

      if (!container) return;

      if (!this.users.length) {
        container.innerHTML = "<p>No ERP users created.</p>";
        return;
      }

      const rows = this.users.map(user => `
        <tr>
          <td>${this.escape(user.userCode)}</td>
          <td>${this.escape(user.name)}</td>
          <td>${this.escape(user.username)}</td>
          <td>${this.escape(user.employeeCode)}</td>
          <td>${this.escape(user.department)}</td>
          <td>${this.escape(user.roleName)}</td>
          <td>${this.escape(user.status)}</td>
        </tr>
      `).join("");

      container.innerHTML = `
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>User Code</th>
                <th>Name</th>
                <th>Username</th>
                <th>Employee Code</th>
                <th>Department</th>
                <th>Role</th>
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
      this.renderUsers();

      console.log("CapMan User Management initialized.");
    }
  };

  window.CapManUsers = Users;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      Users.initialize();
    });
  } else {
    Users.initialize();
  }

})();
          
