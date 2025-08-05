import { ReportService } from './report.service';
import { DatabaseReportRepository } from '../database/repositories/report.repository';
import { logger } from '../utils/logger';

// Service factory for dependency injection
class ServiceFactory {
  private static reportServiceInstance: ReportService;

  static getReportService(): ReportService {
    if (!this.reportServiceInstance) {
      const databaseReportRepository = new DatabaseReportRepository();
      this.reportServiceInstance = new ReportService(databaseReportRepository, logger);
    }
    return this.reportServiceInstance;
  }
}

export const reportService = ServiceFactory.getReportService();
