"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
const error_middleware_1 = require("../middleware/error.middleware");
const constants_1 = require("../constants");
class ReportService {
    reportRepository;
    logger;
    constructor(reportRepository, logger) {
        this.reportRepository = reportRepository;
        this.logger = logger;
    }
    async createReport(data, context) {
        this.logger.info('Creating new report', {
            userId: context?.user.id,
            requestId: context?.requestId,
            severity: data.severity,
        });
        const report = await this.reportRepository.create(data);
        this.logger.info('Report created successfully', {
            reportId: report.id,
            userId: context?.user.id,
            requestId: context?.requestId,
        });
        return report;
    }
    async getReportById(id, context) {
        const report = await this.reportRepository.findById(id);
        if (!report) {
            this.logger.warn('Report not found', {
                reportId: id,
                userId: context?.user.id,
                requestId: context?.requestId,
            });
            throw new error_middleware_1.AppError(constants_1.HTTP_STATUS.NOT_FOUND, `${constants_1.ERROR_MESSAGES.REPORT_NOT_FOUND}: ${id}`);
        }
        return report;
    }
    async listReports(query, context) {
        const { page, limit, status, severity, sortBy, sortOrder } = query;
        this.logger.debug('Listing reports', {
            query,
            userId: context?.user.id,
            requestId: context?.requestId,
        });
        const { items, total } = await this.reportRepository.findAll({ status, severity }, { page, limit, sortBy, sortOrder });
        const totalPages = Math.ceil(total / limit);
        return {
            items,
            total,
            page,
            limit,
            totalPages,
        };
    }
    async assignReport(reportId, assigneeId, context) {
        const report = await this.getReportById(reportId, context);
        if (report.status === 'resolved' || report.status === 'rejected') {
            this.logger.warn('Attempted to assign closed report', {
                reportId,
                status: report.status,
                userId: context?.user.id,
                requestId: context?.requestId,
            });
            throw new error_middleware_1.AppError(constants_1.HTTP_STATUS.BAD_REQUEST, constants_1.ERROR_MESSAGES.CANNOT_ASSIGN_RESOLVED);
        }
        report.assign(assigneeId);
        await this.reportRepository.update(reportId, report);
        this.logger.info('Report assigned', {
            reportId,
            assigneeId,
            userId: context?.user.id,
            requestId: context?.requestId,
        });
        return report;
    }
    async updateReportStatus(reportId, status, context) {
        const report = await this.getReportById(reportId, context);
        const previousStatus = report.status;
        report.updateStatus(status);
        await this.reportRepository.update(reportId, report);
        this.logger.info('Report status updated', {
            reportId,
            previousStatus,
            newStatus: status,
            userId: context?.user.id,
            requestId: context?.requestId,
        });
        return report;
    }
    async getReportStats(context) {
        this.logger.debug('Getting report statistics', {
            userId: context?.user.id,
            requestId: context?.requestId,
        });
        return await this.reportRepository.countByStatus();
    }
}
exports.ReportService = ReportService;
//# sourceMappingURL=report.service.js.map