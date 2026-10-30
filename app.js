
/* ==========================================
   CAPMAN ERP
   Main Application Controller
   Version: 1.0
========================================== */

"use strict";

/* ------------------------------------------
   1. APPLICATION CONFIGURATION
------------------------------------------ */

const CAPMAN = {
    name: "CapMan ERP",
    version: "1.0.0",
    company: "Cap Manufacturing",
    departments: [
        "Closure Production",
        "Wadding Production"
    ],

    machines: {
        closure: 20,
        wadding: 11
    }
};


/* ------------------------------------------
   2. APPLICATION STATE
------------------------------------------ */

const AppState = {
    currentPage: "dashboard",
    currentUser: null,
    userRole: "guest",
    notifications: [],
    initialized: false
};


/* ------------------------------------------
   3. COMMON UTILITIES
------------------------------------------ */

const Utils = {

    getElement(id) {
        return document.getElementById(id);
    },

    formatNumber(value) {
        return Number(value || 0).toLocaleString("en-IN");
    },

    formatDate(date = new Date()) {
        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    },

    formatTime(date = new Date()) {
        return date.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
    },

    generateId(prefix = "CAP") {
        return prefix + "-" +
            Date.now().toString(36).toUpperCase() +
            "-" +
            Math.random().toString(36).slice(2, 7).toUpperCase();
    },

    isValidNumber(value) {
        return value !== "" &&
            value !== null &&
            Number.isFinite(Number(value)) &&
            Number(value) >= 0;
    },

    escapeHTML(value) {
        const div = document.createElement("div");
        div.textContent = String(value ?? "");
        return div.innerHTML;
    }
};


/* ------------------------------------------
   4. NOTIFICATION SYSTEM
------------------------------------------ */

const Notifications = {

    show(message, type = "info") {

        const notification = {
            id: Utils.generateId("NOT"),
            message: String(message),
            type,
            time: new Date()
        };

        AppState.notifications.unshift(notification);

        // Keep latest 50 notifications
        AppState.notifications =
            AppState.notifications.slice(0, 50);

        let container =
            Utils.getElement("notification-container");

        if (!container) {
            container = document.createElement("div");
            container.id = "notification-container";

            Object.assign(container.style, {
                position: "fixed",
                top: "15px",
                right: "15px",
                zIndex: "9999",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                maxWidth: "90%"
            });

            document.body.appendChild(container);
        }

        const item = document.createElement("div");

        const colors = {
            success: "#15803d",
            error: "#dc2626",
            warning: "#d97706",
            info: "#174ea6"
        };

        Object.assign(item.style, {
            background: colors[type] || colors.info,
            color: "#ffffff",
            padding: "13px 18px",
            borderRadius: "8px",
            fontSize: "14px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
        });

        item.textContent = message;
        container.appendChild(item);

        setTimeout(() => {
            item.remove();
        }, 3500);
    },

    success(message) {
        this.show(message, "success");
    },

    error(message) {
        this.show(message, "error");
    },

    warning(message) {
        this.show(message, "warning");
    },

    info(message) {
        this.show(message, "info");
    }
};


/* ------------------------------------------
   5. PAGE NAVIGATION
------------------------------------------ */

const Navigation = {

    open(pageName) {

        if (!pageName) return;

        const page = String(pageName).toLowerCase();

        const pages = document.querySelectorAll(
            "[data-page-content]"
        );

        const buttons = document.querySelectorAll(
            "[data-page]"
        );

        let pageExists = false;

        pages.forEach(section => {

            const sectionName =
                section.dataset.pageContent.toLowerCase();

            const isActive = sectionName === page;

            section.hidden = !isActive;

            if (isActive) pageExists = true;
        });

        if (!pageExists) {
            Notifications.warning(
                "This module is not connected yet: " + page
            );
            return;
        }

        buttons.forEach(button => {

            const isActive =
                button.dataset.page.toLowerCase() === page;

            button.classList.toggle("active", isActive);
            button.setAttribute(
                "aria-current",
                isActive ? "page" : "false"
            );
        });

        AppState.currentPage = page;

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        document.dispatchEvent(
            new CustomEvent("capman:pagechange", {
                detail: { page }
            })
        );
    },

    initialize() {

        document.addEventListener("click", event => {

            const button = event.target.closest("[data-page]");

            if (!button) return;

            event.preventDefault();

            this.open(button.dataset.page);
        });

    }
};


/* ------------------------------------------
   6. DATE AND TIME
------------------------------------------ */

const Clock = {

    update() {

        const dateElement = Utils.getElement("current-date");
        const timeElement = Utils.getElement("current-time");

        const now = new Date();

        if (dateElement) {
            dateElement.textContent =
                Utils.formatDate(now);
        }

        if (timeElement) {
            timeElement.textContent =
                Utils.formatTime(now);
        }
    },

    initialize() {

        this.update();

        // Update clock every second
        window.setInterval(() => {
            this.update();
        }, 1000);
    }
};


/* ------------------------------------------
   7. MACHINE MASTER CONFIGURATION
------------------------------------------ */

const MachineConfig = {

    getClosureMachines() {

        return Array.from(
            { length: CAPMAN.machines.closure },
            (_, index) => ({
                id: "IM-" +
                    String(index + 1).padStart(2, "0") +
                    "/26",

                department: "Closure",
                status: "Active"
            })
        );
    },

    getWaddingMachines() {

        return Array.from(
            { length: CAPMAN.machines.wadding },
            (_, index) => ({
                id: "WD-" +
                    String(index + 1).padStart(2, "0") +
                    "/26",

                department: "Wadding",
                status: "Active"
            })
        );
    },

    getAllMachines() {

        return [
            ...this.getClosureMachines(),
            ...this.getWaddingMachines()
        ];
    }
};


/* ------------------------------------------
   8. APPLICATION INITIALIZATION
------------------------------------------ */

const CapManApp = {

    initialize() {

        if (AppState.initialized) return;

        console.log("--------------------------------");
        console.log(CAPMAN.name);
        console.log("Version:", CAPMAN.version);
        console.log("Application Started");
        console.log("--------------------------------");

        Navigation.initialize();
        Clock.initialize();

        AppState.initialized = true;

        document.dispatchEvent(
            new CustomEvent("capman:ready")
        );

        console.log(
            "Total Machines:",
            MachineConfig.getAllMachines().length
        );
    }
};


/* ------------------------------------------
   9. START APPLICATION
------------------------------------------ */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        () => CapManApp.initialize()
    );

} else {

    CapManApp.initialize();

}


/* ------------------------------------------
   10. GLOBAL APPLICATION ACCESS
------------------------------------------ */

window.CapMan = {
    config: CAPMAN,
    state: AppState,
    utils: Utils,
    notifications: Notifications,
    navigation: Navigation,
    machines: MachineConfig
};
                      
