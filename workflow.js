/* =========================================================
   CAPMAN ERP - WORKFLOW & APPROVAL MODULE
   File: workflow.js
========================================================= */

(function () {
    "use strict";

    const STORAGE_KEY = "capman_workflow_requests";
    const HISTORY_KEY = "capman_workflow_history";

    const Workflow = {

        requests: [],
        history: [],

        load() {
            try {
                this.requests = JSON.parse(
                    localStorage.getItem(STORAGE_KEY) || "[]"
                );

                this.history = JSON.parse(
                    localStorage.getItem(HISTORY_KEY) || "[]"
                );
            } catch (error) {
                this.requests = [];
                this.history = [];
            }
        },

        save() {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(this.requests)
            );

            localStorage.setItem(
                HISTORY_KEY,
                JSON.stringify(this.history)
            );
        },

        generateId() {
            return "WF-" +
                Date.now() +
                "-" +
                Math.floor(Math.random() * 1000);
        },

        /* CREATE APPROVAL REQUEST */

        createRequest(data) {
            if (!data || !data.module || !data.reference) {
                throw new Error(
                    "Module and reference are required."
                );
            }

            const request = {
                id: this.generateId(),
                module: String(data.module).toUpperCase(),
                reference: String(data.reference),
                description: data.description || "",
                requestedBy: data.requestedBy || "System User",
                requestedAt: new Date().toISOString(),
                status: "PENDING",
                approvedBy: "",
                approvedAt: null,
                rejectionReason: ""
            };

            this.requests.push(request);

            this.history.push({
                requestId: request.id,
                action: "REQUEST_CREATED",
                user: request.requestedBy,
                timestamp: new Date().toISOString(),
                remarks: request.description
            });

            this.save();

            return request;
        },

        /* APPROVE REQUEST */

        approveRequest(requestId, approvedBy, remarks = "") {
            const request = this.requests.find(
                item => item.id === requestId
            );

            if (!request) {
                throw new Error("Approval request not found.");
            }

            if (request.status !== "PENDING") {
                throw new Error(
                    "Only pending requests can be approved."
                );
            }

            request.status = "APPROVED";
            request.approvedBy = approvedBy || "System User";
            request.approvedAt = new Date().toISOString();

            this.history.push({
                requestId,
                action: "APPROVED",
                user: request.approvedBy,
                timestamp: new Date().toISOString(),
                remarks
            });

            this.save();

            return request;
        },

        /* REJECT REQUEST */

        rejectRequest(requestId, rejectedBy, reason) {
            if (!reason || !String(reason).trim()) {
                throw new Error(
                    "Rejection reason is mandatory."
                );
            }

            const request = this.requests.find(
                item => item.id === requestId
            );

            if (!request) {
                throw new Error("Approval request not found.");
            }

            if (request.status !== "PENDING") {
                throw new Error(
                    "Only pending requests can be rejected."
                );
            }

            request.status = "REJECTED";
            request.approvedBy = rejectedBy || "System User";
            request.rejectionReason = String(reason).trim();

            this.history.push({
                requestId,
                action: "REJECTED",
                user: request.approvedBy,
                timestamp: new Date().toISOString(),
                remarks: request.rejectionReason
            });

            this.save();

            return request;
        },

        /* GET PENDING REQUESTS */

        getPendingRequests(module = null) {
            return this.requests.filter(request => {
                return request.status === "PENDING" &&
                    (!module ||
                        request.module === String(module).toUpperCase());
            });
        },

        /* GET REQUEST HISTORY */

        getHistory(requestId = null) {
            if (!requestId) {
                return [...this.history];
            }

            return this.history.filter(
                item => item.requestId === requestId
            );
        },

        /* GET ALL REQUESTS */

        getAllRequests() {
            return [...this.requests];
        },

        /* SUMMARY */

        getSummary() {
            return {
                total: this.requests.length,

                pending: this.requests.filter(
                    item => item.status === "PENDING"
                ).length,

                approved: this.requests.filter(
                    item => item.status === "APPROVED"
                ).length,

                rejected: this.requests.filter(
                    item => item.status === "REJECTED"
                ).length
            };
        },

        /* RENDER APPROVAL TABLE */

        render(containerId = "workflow-approval-container") {
            const container = document.getElementById(
                containerId
            );

            if (!container) return;

            const requests = this.getAllRequests();

            container.innerHTML = `
                <h3>Approval Workflow</h3>

                <div class="workflow-summary">
                    <span>Pending: ${this.getSummary().pending}</span>
                    <span>Approved: ${this.getSummary().approved}</span>
                    <span>Rejected: ${this.getSummary().rejected}</span>
                </div>

                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Request ID</th>
                                <th>Module</th>
                                <th>Reference</th>
                                <th>Requested By</th>
                                <th>Date</th>
                                <th>Status</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${requests.map(request => `
                                <tr>
                                    <td>${request.id}</td>
                                    <td>${request.module}</td>
                                    <td>${request.reference}</td>
                                    <td>${request.requestedBy}</td>
                                    <td>${new Date(
                                        request.requestedAt
                                    ).toLocaleDateString()}</td>
                                    <td>${request.status}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            `;
        },

        initialize() {
            this.load();
        }
    };

    Workflow.initialize();

    window.CapManWorkflow = Workflow;

})();
