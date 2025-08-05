"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportController = exports.ReportController = void 0;
const service_factory_1 = require("../services/service.factory");
const error_middleware_1 = require("../middleware/error.middleware");
const constants_1 = require("../constants");
class ReportController {
    createReport = (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const data = req.body;
        const report = await service_factory_1.reportService.createReport(data, req.context);
        const response = {
            success: true,
            data: report,
            message: 'Report created successfully',
        };
        res.status(constants_1.HTTP_STATUS.CREATED).json(response);
    });
    getReports = (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const query = req.query;
        const result = await service_factory_1.reportService.listReports(query, req.context);
        const response = {
            success: true,
            data: result,
        };
        res.status(constants_1.HTTP_STATUS.OK).json(response);
    });
    getReportById = (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        const report = await service_factory_1.reportService.getReportById(id, req.context);
        const response = {
            success: true,
            data: report,
        };
        res.status(constants_1.HTTP_STATUS.OK).json(response);
    });
    assignReport = (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        const { assigneeId } = req.body;
        const report = await service_factory_1.reportService.assignReport(id, assigneeId, req.context);
        const response = {
            success: true,
            data: report,
            message: 'Report assigned successfully',
        };
        res.status(constants_1.HTTP_STATUS.OK).json(response);
    });
    updateReportStatus = (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { id } = req.params;
        const { status } = req.body;
        const report = await service_factory_1.reportService.updateReportStatus(id, status, req.context);
        const response = {
            success: true,
            data: report,
            message: 'Report status updated successfully',
        };
        res.status(constants_1.HTTP_STATUS.OK).json(response);
    });
    getReportStats = (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const stats = await service_factory_1.reportService.getReportStats(req.context);
        const response = {
            success: true,
            data: stats,
        };
        res.status(constants_1.HTTP_STATUS.OK).json(response);
    });
}
exports.ReportController = ReportController;
exports.reportController = new ReportController();
//# sourceMappingURL=report.controller.js.map