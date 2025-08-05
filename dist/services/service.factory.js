"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportService = void 0;
const report_service_1 = require("./report.service");
const report_repository_1 = require("../repositories/report.repository");
const logger_1 = require("../utils/logger");
class ServiceFactory {
    static reportServiceInstance;
    static getReportService() {
        if (!this.reportServiceInstance) {
            this.reportServiceInstance = new report_service_1.ReportService(report_repository_1.reportRepository, logger_1.logger);
        }
        return this.reportServiceInstance;
    }
}
exports.reportService = ServiceFactory.getReportService();
//# sourceMappingURL=service.factory.js.map