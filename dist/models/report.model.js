"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Report = void 0;
const uuid_1 = require("uuid");
class Report {
    id;
    title;
    description;
    severity;
    status;
    submittedBy;
    submittedAt;
    assignedTo;
    assignedAt;
    category;
    affectedAsset;
    reproductionSteps;
    impact;
    constructor(data) {
        this.id = (0, uuid_1.v4)();
        this.title = data.title;
        this.description = data.description;
        this.severity = data.severity;
        this.status = 'pending';
        this.submittedBy = data.submittedBy;
        this.submittedAt = new Date();
        this.category = data.category;
        this.affectedAsset = data.affectedAsset;
        this.reproductionSteps = data.reproductionSteps;
        this.impact = data.impact;
    }
    assign(userId) {
        this.assignedTo = userId;
        this.assignedAt = new Date();
        if (this.status === 'pending') {
            this.status = 'triaged';
        }
    }
    updateStatus(status) {
        this.status = status;
    }
}
exports.Report = Report;
//# sourceMappingURL=report.model.js.map