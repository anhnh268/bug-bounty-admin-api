"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRepository = exports.InMemoryReportRepository = void 0;
const report_model_1 = require("../models/report.model");
class InMemoryReportRepository {
    reports = new Map();
    async create(data) {
        const report = new report_model_1.Report(data);
        this.reports.set(report.id, report);
        return report;
    }
    async findById(id) {
        return this.reports.get(id) || null;
    }
    async findAll(filter = {}, options) {
        const { page, limit, sortBy, sortOrder } = options;
        let reports = Array.from(this.reports.values());
        if (filter.status) {
            reports = reports.filter((r) => r.status === filter.status);
        }
        if (filter.severity) {
            reports = reports.filter((r) => r.severity === filter.severity);
        }
        if (filter.assignedTo) {
            reports = reports.filter((r) => r.assignedTo === filter.assignedTo);
        }
        reports.sort((a, b) => {
            const aValue = a[sortBy];
            const bValue = b[sortBy];
            if (aValue === undefined || bValue === undefined)
                return 0;
            if (aValue < bValue)
                return sortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue)
                return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        const total = reports.length;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const items = reports.slice(startIndex, endIndex);
        return { items, total };
    }
    async update(id, updates) {
        const report = this.reports.get(id);
        if (!report)
            return null;
        Object.assign(report, updates);
        return report;
    }
    async delete(id) {
        return this.reports.delete(id);
    }
    async countByStatus() {
        const counts = {
            pending: 0,
            triaged: 0,
            in_progress: 0,
            resolved: 0,
            rejected: 0,
        };
        for (const report of this.reports.values()) {
            counts[report.status]++;
        }
        return counts;
    }
}
exports.InMemoryReportRepository = InMemoryReportRepository;
exports.reportRepository = new InMemoryReportRepository();
//# sourceMappingURL=report.repository.js.map