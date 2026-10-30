
/* =========================================================
   CAPMAN ERP - SETTINGS & CONFIGURATION
   File: settings.js

   Features:
   - Company Settings
   - Financial Year
   - Departments
   - Units of Measurement
   - Shift Timings
   - User Roles
   - Document Numbering
   - ERP Preferences
   - Local Data Backup & Restore

   Prototype: LocalStorage-based
========================================================= */

(function () {
  "use strict";

  const SETTINGS_KEY = "capman_erp_settings";
  const DEPARTMENT_KEY = "capman_erp_departments";
  const UOM_KEY = "capman_erp_uom";
  const SHIFT_KEY = "capman_erp_shift_config";
  const ROLE_KEY = "capman_erp_roles";
  const SERIES_KEY = "capman_erp_document_series";

  const Settings = {

    defaults: {
      company: {
        name: "CapMan Industries",
        address: "",
        city: "",
        state: "Telangana",
        country: "India",
        pincode: "",
        phone: "",
        email: "",
        gstNumber: "",
        currency: "INR",
        timezone: "Asia/Kolkata"
      },

      financialYear: {
        startMonth: 4,
        startDay: 1,
        label: "April - March"
      },

      preferences: {
        dateFormat: "DD-MM-YYYY",
        decimalPlaces: 2,
        negativeStockAllowed: false,
        duplicateDocumentAllowed: false,
        autoBackupReminder: true,
        fifoEnabled: true
      }
    },

    defaultDepartments: [
      "Closure Production",
      "Wadding Production",
      "Packing",
      "Quality",
      "Maintenance",
      "Stores",
      "PPC",
      "Purchase",
      "Sales",
      "Dispatch",
      "HR",
      "Accounts",
      "Administration"
    ],

    defaultUOM: [
      { code: "KG", name: "Kilogram", category: "Weight" },
      { code: "G", name: "Gram", category: "Weight" },
      { code: "PCS", name: "Pieces", category: "Count" },
      { code: "BOX", name: "Box", category: "Packaging" },
      { code: "BAG", name: "Bag", category: "Packaging" },
      { code: "LTR", name: "Litre", category: "Volume" },
      { code: "MTR", name: "Metre", category: "Length" }
    ],

    defaultShifts: [
      {
        code: "A",
        name: "A Shift",
        startTime: "06:00",
        endTime: "14:00",
        breakMinutes: 30,
        status: "Active"
      },
      {
        code: "B",
        name: "B Shift",
        startTime: "14:00",
        endTime: "22:00",
        breakMinutes: 30,
        status: "Active"
      },
      {
        code: "C",
        name: "C Shift",
        startTime: "22:00",
        endTime: "06:00",
        breakMinutes: 30,
        status: "Active"
      },
      {
        code: "G",
        name: "General Shift",
        startTime: "09:00",
        endTime: "18:00",
        breakMinutes: 60,
        status: "Active"
      }
    ],

    defaultRoles: [
      {
        code: "ADMIN",
        name: "Administrator",
        permissions: ["ALL"],
        status: "Active"
      },
      {
        code: "PLANT_HEAD",
        name: "Plant Head",
        permissions: [
          "DASHBOARD",
          "PRODUCTION",
          "PPC",
          "INVENTORY",
          "QUALITY",
          "MAINTENANCE",
          "REPORTS"
        ],
        status: "Active"
      },
      {
        code: "PPC",
        name: "PPC Executive",
        permissions: [
          "SALES",
          "PPC",
          "PRODUCTION",
          "INVENTORY",
          "REPORTS"
        ],
        status: "Active"
      },
      {
        code: "PRODUCTION",
        name: "Production Executive",
        permissions: [
          "PRODUCTION",
          "MACHINES",
          "QUALITY",
          "REPORTS"
        ],
        status: "Active"
      },
      {
        code: "STORES",
        name: "Stores Executive",
        permissions: [
          "PURCHASE",
          "INVENTORY",
          "GRN",
          "REPORTS"
        ],
        status: "Active"
      },
      {
        code: "QUALITY",
        name: "Quality Executive",
        permissions: [
          "QUALITY",
          "INSPECTION",
          "CAPA",
          "REPORTS"
        ],
        status: "Active"
      },
      {
        code: "MAINTENANCE",
        name: "Maintenance Executive",
        permissions: [
          "MACHINES",
          "MAINTENANCE",
          "REPORTS"
        ],
        status: "Active"
      },
      {
        code: "HR",
        name: "HR Executive",
        permissions: [
          "HR",
          "ATTENDANCE",
          "REPORTS"
        ],
        status: "Active"
      }
    ],

    defaultSeries: [
      { document: "Customer PO", prefix: "CPO", nextNumber: 1 },
      { document: "Purchase Requisition", prefix: "PR", nextNumber: 1 },
      { document: "Purchase Order", prefix: "PO", nextNumber: 1 },
      { document: "GRN", prefix: "GRN", nextNumber: 1 },
      { document: "Production Order", prefix: "WO", nextNumber: 1 },
      { document: "Material Issue", prefix: "MI", nextNumber: 1 },
      { document: "Quality Inspection", prefix: "QC", nextNumber: 1 },
      { document: "Maintenance Order", prefix: "MWO", nextNumber: 1 },
      { document: "Dispatch", prefix: "DSP", nextNumber: 1 }
    ],

    company: {},
    financialYear: {},
    preferences: {},
    departments: [],
    uom: [],
    shifts: [],
    roles: [],
    series: [],

    /* =====================================
       STORAGE
    ====================================== */

    load() {
      try {
        const saved = JSON.parse(
          localStorage.getItem(SETTINGS_KEY)
        );

        const savedDepartments = JSON.parse(
          localStorage.getItem(DEPARTMENT_KEY)
        );

        const savedUOM = JSON.parse(
          localStorage.getItem(UOM_KEY)
        );

        const savedShifts = JSON.parse(
          localStorage.getItem(SHIFT_KEY)
        );

        const savedRoles = JSON.parse(
          localStorage.getItem(ROLE_KEY)
        );

        const savedSeries = JSON.parse(
          localStorage.getItem(SERIES_KEY)
        );

        const config = saved || this.defaults;

        this.company = {
          ...this.defaults.company,
          ...(config.company || {})
        };

        this.financialYear = {
          ...this.defaults.financialYear,
          ...(config.financialYear || {})
        };

        this.preferences = {
          ...this.defaults.preferences,
          ...(config.preferences || {})
        };

        this.departments = Array.isArray(savedDepartments)
          ? savedDepartments : [...this.defaultDepartments];

        this.uom = Array.isArray(savedUOM)
          ? savedUOM : [...this.defaultUOM];

        this.shifts = Array.isArray(savedShifts)
          ? savedShifts : this.defaultShifts.map(s => ({ ...s }));

        this.roles = Array.isArray(savedRoles)
          ? savedRoles : this.defaultRoles.map(r => ({
              ...r,
              permissions: [...r.permissions]
            }));

        this.series = Array.isArray(savedSeries)
          ? savedSeries : this.defaultSeries.map(s => ({ ...s }));

      } catch (error) {
        console.error("Settings loading error:", error);
        throw new Error("Unable to load ERP settings.");
      }
    },

    save() {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        company: this.company,
        financialYear: this.financialYear,
        preferences: this.preferences
      }));

      localStorage.setItem(DEPARTMENT_KEY, JSON.stringify(this.departments));
      localStorage.setItem(UOM_KEY, JSON.stringify(this.uom));
      localStorage.setItem(SHIFT_KEY, JSON.stringify(this.shifts));
      localStorage.setItem(ROLE_KEY, JSON.stringify(this.roles));
      localStorage.setItem(SERIES_KEY, JSON.stringify(this.series));
    },

    /* =====================================
       COMPANY PROFILE
    ====================================== */

    updateCompany(data) {
      const allowed = [
        "name",
        "address",
        "city",
        "state",
        "country",
        "pincode",
        "phone",
        "email",
        "gstNumber",
        "currency",
        "timezone"
      ];

      allowed.forEach(key => {
        if (data[key] !== undefined) {
          this.company[key] = String(data[key]).trim();
        }
      });

      this.save();
      return this.company;
    },

    getCompany() {
      return { ...this.company };
    },

    /* =====================================
       FINANCIAL YEAR
    ====================================== */

    updateFinancialYear(data) {
      const month = Number(data.startMonth);
      const day = Number(data.startDay);

      if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error("Financial year month must be 1 to 12.");
      }

      if (!Number.isInteger(day) || day < 1 || day > 28) {
        throw new Error("Financial year start day must be 1 to 28.");
      }

      this.financialYear = {
        startMonth: month,
        startDay: day,
        label: data.label || "Custom Financial Year"
      };

      this.save();
      return this.financialYear;
    },

    getCurrentFinancialYear(date = new Date()) {
      const year = date.getFullYear();
      const start = new Date(
        year,
        this.financialYear.startMonth - 1,
        this.financialYear.startDay
      );

      const startYear = date >= start ? year : year - 1;
      const endYear = startYear + 1;

      return {
        startYear,
        endYear,
        label: startYear + "-" + endYear
      };
    },

    /* =====================================
       DEPARTMENT MASTER
    ====================================== */

    addDepartment(name) {
      const department = String(name || "").trim();

      if (!department) {
        throw new Error("Department name is required.");
      }

      const exists = this.departments.some(
        d => d.toLowerCase() === department.toLowerCase()
      );

      if (exists) throw new Error("Department already exists.");

      this.departments.push(department);
      this.save();

      return department;
    },

    removeDepartment(name) {
      const index = this.departments.indexOf(name);

      if (index === -1) throw new Error("Department not found.");

      this.departments.splice(index, 1);
      this.save();

      return true;
    },

    /* =====================================
       UNIT OF MEASUREMENT
    ====================================== */

    addUOM(data) {
      if (!data.code || !data.name) {
        throw new Error("UOM code and name are required.");
      }

      const code = String(data.code).trim().toUpperCase();

      if (this.uom.some(u => u.code === code)) {
        throw new Error("UOM code already exists.");
      }

      const record = {
        code,
        name: String(data.name).trim(),
        category: data.category || "Other"
      };

      this.uom.push(record);
      this.save();

      return record;
    },

    getUOM(code) {
      return this.uom.find(u => u.code === code) || null;
    },

    /* =====================================
       SHIFT CONFIGURATION
    ====================================== */

    updateShift(code, updates) {
      const shift = this.shifts.find(s => s.code === code);

      if (!shift) throw new Error("Shift not found.");

      const allowed = [
        "name",
        "startTime",
        "endTime",
        "breakMinutes",
        "status"
      ];

      allowed.forEach(key => {
        if (updates[key] !== undefined) {
          shift[key] = updates[key];
        }
      });

      if (
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(shift.startTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(shift.endTime)
      ) {
        throw new Error("Invalid shift time.");
      }

      const breakMinutes = Number(shift.breakMinutes);

      if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
        throw new Error("Invalid break duration.");
      }

      shift.breakMinutes = breakMinutes;

      this.save();
      return shift;
    },

    /* =====================================
       ROLE & PERMISSION MASTER
    ====================================== */

    addRole(data) {
      if (!data.code || !data.name) {
        throw new Error("Role code and name are required.");
      }

      const code = String(data.code).trim().toUpperCase();

      if (this.roles.some(r => r.code === code)) {
        throw new Error("Role code already exists.");
      }

      const role = {
        code,
        name: String(data.name).trim(),
        permissions: Array.isArray(data.permissions)
          ? [...new Set(data.permissions)]
          : [],
        status: "Active"
      };

      this.roles.push(role);
      this.save();

      return role;
    },

    updateRole(code, updates) {
      const role = this.roles.find(r => r.code === code);

      if (!role) throw new Error("Role not found.");

      if (updates.name !== undefined) {
        role.name = updates.name;
      }

      if (updates.permissions !== undefined) {
        if (!Array.isArray(updates.permissions)) {
          throw new Error("Permissions must be an array.");
        }

        role.permissions = [...new Set(updates.permissions)];
      }

      if (updates.status !== undefined) {
        role.status = updates.status;
      }

      this.save();
      return role;
    },

    getRole(code) {
      return this.roles.find(r => r.code === code) || null;
    },

    hasPermission(roleCode, permission) {
      const role = this.getRole(roleCode);

      if (!role || role.status !== "Active") return false;

      return role.permissions.includes("ALL") ||
        role.permissions.includes(permission);
    },

    /* =====================================
       DOCUMENT NUMBERING
    ====================================== */

    getNextDocumentNumber(documentName) {
      const series = this.series.find(
        s => s.document === documentName
      );

      if (!series) {
        throw new Error("Document series not configured.");
      }

      const number = String(series.nextNumber).padStart(5, "0");

      return series.prefix + "-" + number;
    },

    consumeDocumentNumber(documentName) {
      const series = this.series.find(
        s => s.document === documentName
      );

      if (!series) {
        throw new Error("Document series not configured.");
      }

      const documentNumber = this.getNextDocumentNumber(documentName);

      series.nextNumber++;
      this.save();

      return documentNumber;
    },

    updateDocumentSeries(documentName, data) {
      const series = this.series.find(
        s => s.document === documentName
      );

      if (!series) throw new Error("Document series not found.");

      if (data.prefix !== undefined) {
        series.prefix = String(data.prefix).trim().toUpperCase();
      }

      if (data.nextNumber !== undefined) {
        const number = Number(data.nextNumber);

        if (!Number.isInteger(number) || number < 1) {
          throw new Error("Next number must be a positive integer.");
        }

        series.nextNumber = number;
      }

      this.save();
      return series;
    },

    /* =====================================
       ERP PREFERENCES
    ====================================== */

    updatePreferences(data) {
      const allowed = [
        "dateFormat",
        "decimalPlaces",
        "negativeStockAllowed",
        "duplicateDocumentAllowed",
        "autoBackupReminder",
        "fifoEnabled"
      ];

      allowed.forEach(key => {
        if (data[key] !== undefined) {
          this.preferences[key] = data[key];
        }
      });

      const decimals = Number(this.preferences.decimalPlaces);

      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 4) {
        throw new Error("Decimal places must be between 0 and 4.");
      }

      this.preferences.decimalPlaces = decimals;

      this.save();
      return this.preferences;
    },

    /* =====================================
       LOCAL DATA BACKUP
    ====================================== */

    exportBackup() {
      const keys = [
        SETTINGS_KEY,
        DEPARTMENT_KEY,
        UOM_KEY,
        SHIFT_KEY,
        ROLE_KEY,
        SERIES_KEY,

        "capman_machine_master",
        "capman_material_master",
        "capman_bom_master",

        "capman_customers",
        "capman_customer_orders",

        "capman_suppliers",
        "capman_purchase_requisitions",
        "capman_purchase_orders",

        "capman_inventory_stock",
        "capman_inventory_ledger",

        "capman_production_entries",

        "capman_quality_inspections",
        "capman_quality_capa",

        "capman_maintenance_records",
        "capman_pm_schedules",
        "capman_maintenance_parts",

        "capman_hr_employees",
        "capman_hr_attendance",
        "capman_hr_shifts",
        "capman_hr_machine_allocation"
      ];

      const backup = {
        application: "CapMan ERP",
        backupVersion: 1,
        createdAt: new Date().toISOString(),
        data: {}
      };

      keys.forEach(key => {
        const value = localStorage.getItem(key);

        if (value !== null) {
          backup.data[key] = JSON.parse(value);
        }
      });

      return backup;
    },

    downloadBackup() {
      const backup = this.exportBackup();

      const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: "application/json" }
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "CapMan-ERP-Backup-" +
        new Date().toISOString().slice(0, 10) + ".json";

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    },

    restoreBackup(backup) {
      if (
        !backup ||
        backup.application !== "CapMan ERP" ||
        !backup.data ||
        typeof backup.data !== "object" ||
        Array.isArray(backup.data)
      ) {
        throw new Error("Invalid CapMan ERP backup file.");
      }

      const approvedKeys = [
        SETTINGS_KEY,
        DEPARTMENT_KEY,
        UOM_KEY,
        SHIFT_KEY,
        ROLE_KEY,
        SERIES_KEY,
        "capman_machine_master",
        "capman_material_master",
        "capman_bom_master",
        "capman_customers",
        "capman_customer_orders",
        "capman_suppliers",
        "capman_purchase_requisitions",
        "capman_purchase_orders",
        "capman_inventory_stock",
        "capman_inventory_ledger",
        "capman_production_entries",
        "capman_quality_inspections",
        "capman_quality_capa",
        "capman_maintenance_records",
        "capman_pm_schedules",
        "capman_maintenance_parts",
        "capman_hr_employees",
        "capman_hr_attendance",
        "capman_hr_shifts",
        "capman_hr_machine_allocation"
      ];

      const entries = Object.entries(backup.data);

      entries.forEach(([key, value]) => {
        if (!approvedKeys.includes(key)) {
          throw new Error("Backup contains an unsupported data key.");
        }

        if (value === undefined) {
          throw new Error("Backup contains invalid data.");
        }
      });

      const previous = {};

      approvedKeys.forEach(key => {
        previous[key] = localStorage.getItem(key);
      });

      try {
        entries.forEach(([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value));
        });
      } catch (error) {
        approvedKeys.forEach(key => {
          if (previous[key] === null) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, previous[key]);
          }
        });

        throw new Error("Backup restore failed. Previous data was restored.");
      }

      this.load();
      return true;
    },

    /* =====================================
       INITIALIZATION
    ====================================== */

    initialize() {
      this.load();
      this.save();

      console.log("CapMan ERP Settings initialized.");
    }
  };

  window.CapManSettings = Settings;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      Settings.initialize();
    });
  } else {
    Settings.initialize();
  }

})();
