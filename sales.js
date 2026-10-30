
/* ==========================================
   CAPMAN ERP - SALES MANAGEMENT
   Customer Master & Customer Purchase Orders
   Version: 1.0
========================================== */

"use strict";

const SalesModule = {

    customerStorage: "capman_customers",
    orderStorage: "capman_customer_orders",

    customers: [],
    orders: [],

    /* ----------------------------------
       1. INITIALIZE
    ---------------------------------- */

    initialize() {

        try {
            this.customers = JSON.parse(
                localStorage.getItem(this.customerStorage) || "[]"
            );

            this.orders = JSON.parse(
                localStorage.getItem(this.orderStorage) || "[]"
            );

            if (!Array.isArray(this.customers)) this.customers = [];
            if (!Array.isArray(this.orders)) this.orders = [];

        } catch (error) {

            console.error("Sales loading error:", error);

            this.customers = [];
            this.orders = [];
        }

        this.render();

        console.log("Sales module initialized.");
    },

    /* ----------------------------------
       2. SAVE DATA
    ---------------------------------- */

    saveCustomers() {
        try {
            localStorage.setItem(
                this.customerStorage,
                JSON.stringify(this.customers)
            );
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    },

    saveOrders() {
        try {
            localStorage.setItem(
                this.orderStorage,
                JSON.stringify(this.orders)
            );
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    },

    /* ----------------------------------
       3. CUSTOMER MASTER
    ---------------------------------- */

    addCustomer(data) {

        if (!data || !data.name || !data.code) {
            return this.fail(
                "Customer code and name are required."
            );
        }

        const code = String(data.code).trim().toUpperCase();

        if (this.getCustomer(code)) {
            return this.fail(
                "Customer code already exists."
            );
        }

        const customer = {
            id: this.generateId("CUS"),
            code,
            name: String(data.name).trim(),
            contactPerson: String(data.contactPerson || "").trim(),
            phone: String(data.phone || "").trim(),
            email: String(data.email || "").trim(),
            address: String(data.address || "").trim(),
            gstNumber: String(data.gstNumber || "").trim(),
            status: "Active",
            createdAt: new Date().toISOString()
        };

        this.customers.push(customer);

        if (!this.saveCustomers()) {
            this.customers.pop();
            return this.fail("Unable to save customer.");
        }

        this.render();

        this.notify("Customer added successfully.");

        return customer;
    },

    getCustomer(code) {

        return this.customers.find(
            customer =>
                customer.code === String(code).toUpperCase()
        ) || null;
    },

    getAllCustomers() {
        return [...this.customers];
    },

    /* ----------------------------------
       4. UPDATE CUSTOMER
    ---------------------------------- */

    updateCustomer(code, changes) {

        const customer = this.getCustomer(code);

        if (!customer) {
            return this.fail("Customer not found.");
        }

        const oldCustomer = { ...customer };

        const allowed = [
            "name",
            "contactPerson",
            "phone",
            "email",
            "address",
            "gstNumber"
        ];

        allowed.forEach(field => {
            if (changes[field] !== undefined) {
                customer[field] = String(changes[field]).trim();
            }
        });

        if (!this.saveCustomers()) {
            Object.assign(customer, oldCustomer);
            return this.fail("Customer update failed.");
        }

        this.render();

        return customer;
    },

    /* ----------------------------------
       5. CREATE CUSTOMER PO
    ---------------------------------- */

    createOrder(data) {

        if (!data || !data.poNumber || !data.customerCode) {
            return this.fail(
                "PO number and customer are required."
            );
        }

        const customer = this.getCustomer(data.customerCode);

        if (!customer || customer.status !== "Active") {
            return this.fail("Select an active customer.");
        }

        const poNumber = String(data.poNumber).trim();

        if (this.getOrder(poNumber)) {
            return this.fail("Customer PO already exists.");
        }

        const quantity = Number(data.quantity);

        if (!Number.isFinite(quantity) || quantity <= 0) {
            return this.fail("Enter a valid PO quantity.");
        }

        if (!data.productCode) {
            return this.fail("Product code is required.");
        }

        if (!data.deliveryDate) {
            return this.fail("Delivery date is required.");
        }

        const order = {

            id: this.generateId("PO"),

            poNumber,

            customerCode: customer.code,
            customerName: customer.name,

            productCode: String(data.productCode).trim(),
            productName: String(data.productName || "").trim(),

            orderedQty: quantity,

            producedQty: 0,
            dispatchedQty: 0,
            reservedQty: 0,

            deliveryDate: data.deliveryDate,

            priority: data.priority || "Normal",

            status: "Open",

            deliverySchedule: [
                {
                    date: data.deliveryDate,
                    quantity: quantity
                }
            ],

            createdAt: new Date().toISOString(),

            remarks: String(data.remarks || "").trim()
        };

        this.orders.push(order);

        if (!this.saveOrders()) {
            this.orders.pop();
            return this.fail("Unable to save customer PO.");
        }

        this.render();

        this.notify("Customer PO created successfully.");

        return order;
    },

    /* ----------------------------------
       6. GET CUSTOMER ORDER
    ---------------------------------- */

    getOrder(poNumber) {

        return this.orders.find(
            order => order.poNumber === poNumber
        ) || null;
    },

    getAllOrders() {
        return [...this.orders];
    },

    /* ----------------------------------
       7. ORDER BALANCE
    ---------------------------------- */

    getBalance(poNumber) {

        const order = this.getOrder(poNumber);

        if (!order) return null;

        return {

            ordered: order.orderedQty,

            produced: order.producedQty,

            dispatched: order.dispatchedQty,

            reserved: order.reservedQty,

            remainingToProduce: Math.max(
                0,
                order.orderedQty - order.producedQty
            ),

            remainingToDispatch: Math.max(
                0,
                order.orderedQty - order.dispatchedQty
            ),

            availableToAllocate: Math.max(
                0,
                order.producedQty -
                order.dispatchedQty -
                order.reservedQty
            )
        };
    },

    /* ----------------------------------
       8. UPDATE PRODUCTION QUANTITY
       Called by production module later.
    ---------------------------------- */

    recordProduction(poNumber, quantity) {

        const order = this.getOrder(poNumber);

        if (!order) {
            return this.fail("Customer PO not found.");
        }

        if (order.status === "Cancelled" ||
            order.status === "Completed") {
            return this.fail("This PO is not open.");
        }

        const qty = Number(quantity);

        if (!Number.isFinite(qty) || qty <= 0) {
            return this.fail("Invalid production quantity.");
        }

        if (order.producedQty + qty > order.orderedQty) {
            return this.fail(
                "Production quantity exceeds PO balance."
            );
        }

        const oldQty = order.producedQty;
        const oldStatus = order.status;

        order.producedQty += qty;
        this.refreshStatus(order);

        if (!this.saveOrders()) {
            order.producedQty = oldQty;
            order.status = oldStatus;
            return this.fail("Production update failed.");
        }

        this.render();

        return this.getBalance(poNumber);
    },

    /* ----------------------------------
       9. RESERVE FINISHED GOODS
    ---------------------------------- */

    reserveGoods(poNumber, quantity) {

        const order = this.getOrder(poNumber);

        if (!order) {
            return this.fail("Customer PO not found.");
        }

        if (order.status === "Cancelled") {
            return this.fail("Cancelled PO cannot be reserved.");
        }

        const qty = Number(quantity);
        const balance = this.getBalance(poNumber);

        if (!Number.isFinite(qty) || qty <= 0) {
            return this.fail("Invalid reservation quantity.");
        }

        if (qty > balance.availableToAllocate) {
            return this.fail(
                "Insufficient unreserved produced quantity."
            );
        }

        const oldReserved = order.reservedQty;

        order.reservedQty += qty;

        if (!this.saveOrders()) {
            order.reservedQty = oldReserved;
            return this.fail("Reservation failed.");
        }

        this.render();

        return true;
    },

    /* ----------------------------------
       10. RELEASE RESERVED GOODS
    ---------------------------------- */

    releaseReservation(poNumber, quantity) {

        const order = this.getOrder(poNumber);

        if (!order) {
            return this.fail("Customer PO not found.");
        }

        const qty = Number(quantity);

        if (!Number.isFinite(qty) ||
            qty <= 0 ||
            qty > order.reservedQty) {
            return this.fail("Invalid release quantity.");
        }

        const oldReserved = order.reservedQty;

        order.reservedQty -= qty;

        if (!this.saveOrders()) {
            order.reservedQty = oldReserved;
            return this.fail("Reservation release failed.");
        }

        this.render();

        return true;
    },

    /* ----------------------------------
       11. RECORD DISPATCH
       Dispatch module will call this.
    ---------------------------------- */

    recordDispatch(poNumber, quantity) {

        const order = this.getOrder(poNumber);

        if (!order) {
            return this.fail("Customer PO not found.");
        }

        if (order.status === "Cancelled") {
            return this.fail("Cannot dispatch cancelled PO.");
        }

        const qty = Number(quantity);

        if (!Number.isFinite(qty) || qty <= 0) {
            return this.fail("Invalid dispatch quantity.");
        }

        const balance = this.getBalance(poNumber);

        if (qty > balance.availableToAllocate) {
            return this.fail(
                "Dispatch exceeds available unreserved quantity."
            );
        }

        const oldDispatched = order.dispatchedQty;
        const oldStatus = order.status;

        order.dispatchedQty += qty;

        this.refreshStatus(order);

        if (!this.saveOrders()) {

            order.dispatchedQty = oldDispatched;
            order.status = oldStatus;

            return this.fail("Dispatch update failed.");
        }

        this.render();

        return this.getBalance(poNumber);
    },

    /* ----------------------------------
       12. DELIVERY SCHEDULE
    ---------------------------------- */

    addDeliverySchedule(poNumber, date, quantity) {

        const order = this.getOrder(poNumber);

        if (!order) {
            return this.fail("Customer PO not found.");
        }

        const qty = Number(quantity);

        if (!date || !Number.isFinite(qty) || qty <= 0) {
            return this.fail("Invalid delivery schedule.");
        }

        const scheduledTotal =
            order.deliverySchedule.reduce(
                (sum, item) => sum + item.quantity,
                0
            );

        if (scheduledTotal + qty > order.orderedQty) {
            return this.fail(
                "Schedule quantity exceeds PO quantity."
            );
        }

        const oldSchedule = [...order.deliverySchedule];

        order.deliverySchedule.push({
            date,
            quantity: qty
        });

        if (!this.saveOrders()) {
            order.deliverySchedule = oldSchedule;
            return this.fail("Schedule update failed.");
        }

        this.render();

        return true;
    },

    /* ----------------------------------
       13. CANCEL CUSTOMER PO
    ---------------------------------- */

    cancelOrder(poNumber, reason) {

        const order = this.getOrder(poNumber);

        if (!order) {
            return this.fail("Customer PO not found.");
        }

        if (order.status === "Completed") {
            return this.fail("Completed PO cannot be cancelled.");
        }

        if (order.dispatchedQty > 0) {
            return this.fail(
                "Partially dispatched PO requires authorized review."
            );
        }

        if (!reason || !String(reason).trim()) {
            return this.fail("Cancellation reason is required.");
        }

        const oldStatus = order.status;

        order.status = "Cancelled";
        order.cancellationReason = String(reason).trim();
        order.cancelledAt = new Date().toISOString();

        if (!this.saveOrders()) {
            order.status = oldStatus;
            return this.fail("PO cancellation failed.");
        }

        this.render();

        return true;
    },

    /* ----------------------------------
       14. AUTOMATIC STATUS
    ---------------------------------- */

    refreshStatus(order) {

        if (order.status === "Cancelled") return;

        if (order.dispatchedQty >= order.orderedQty) {
            order.status = "Completed";
        } else if (
            order.producedQty > 0 ||
            order.dispatchedQty > 0
        ) {
            order.status = "In Progress";
        } else {
            order.status = "Open";
        }
    },

    /* ----------------------------------
       15. SALES SUMMARY
    ---------------------------------- */

    getSummary() {

        return {

            customers: this.customers.length,

            totalOrders: this.orders.length,

            openOrders: this.orders.filter(
                o => o.status === "Open"
            ).length,

            inProgress: this.orders.filter(
                o => o.status === "In Progress"
            ).length,

            completed: this.orders.filter(
                o => o.status === "Completed"
            ).length,

            cancelled: this.orders.filter(
                o => o.status === "Cancelled"
            ).length,

            totalOrdered: this.orders.reduce(
                (sum, o) => sum + o.orderedQty,
                0
            ),

            totalDispatched: this.orders.reduce(
                (sum, o) => sum + o.dispatchedQty,
                0
            )
        };
    },

    /* ----------------------------------
       16. RENDER CUSTOMER PO TABLE
    ---------------------------------- */

    render() {

        const container = document.getElementById(
            "sales-order-container"
        );

        if (!container) return;

        if (this.orders.length === 0) {

            container.innerHTML = `
                <p class="text-muted">
                    No customer orders available.
                </p>
            `;

            return;
        }

        container.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Customer PO</th>
                            <th>Customer</th>
                            <th>Product</th>
                            <th>Ordered</th>
                            <th>Produced</th>
                            <th>Dispatched</th>
                            <th>Balance</th>
                            <th>Delivery Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${this.orders.map(order => {

                            const balance =
                                this.getBalance(order.poNumber);

                            return `
                                <tr>
                                    <td>${this.escape(order.poNumber)}</td>
                                    <td>${this.escape(order.customerName)}</td>
                                    <td>${this.escape(order.productName || order.productCode)}</td>
                                    <td>${this.number(order.orderedQty)}</td>
                                    <td>${this.number(order.producedQty)}</td>
                                    <td>${this.number(order.dispatchedQty)}</td>
                                    <td>${this.number(balance.remainingToDispatch)}</td>
                                    <td>${this.escape(order.deliveryDate)}</td>
                                    <td>${this.escape(order.status)}</td>
                                </tr>
                            `;
                        }).join("")}
                    </tbody>
                </table>
            </div>
        `;
    },

    /* ----------------------------------
       17. HELPERS
    ---------------------------------- */

    generateId(prefix) {

        return prefix + "-" +
            Date.now().toString(36).toUpperCase() +
            "-" +
            Math.random().toString(36).slice(2, 6).toUpperCase();
    },

    number(value) {

        return Number(value || 0).toLocaleString("en-IN");
    },

    escape(value) {

        const element = document.createElement("div");

        element.textContent = String(value ?? "");

        return element.innerHTML;
    },

    notify(message, type = "success") {

        if (window.CapMan?.notifications) {
            window.CapMan.notifications.show(message, type);
        } else {
            console.log(message);
        }
    },

    fail(message) {

        this.notify(message, "error");

        return false;
    }
};


/* ------------------------------------------
   18. GLOBAL ACCESS
------------------------------------------ */

window.CapManSales = SalesModule;
          
