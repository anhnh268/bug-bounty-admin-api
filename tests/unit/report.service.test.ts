import { ReportService } from '../../src/services/report.service';
import { IReportRepository } from '../../src/interfaces/repository.interface';
import { ILogger } from '../../src/interfaces/logger.interface';
import { AppError } from '../../src/middleware/error.middleware';
import { ReportFactory } from '../factories/report.factory';
import { ERROR_MESSAGES } from '../../src/constants';

describe('ReportService', () => {
  let reportService: ReportService;
  let mockRepository: jest.Mocked<IReportRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countByStatus: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    reportService = new ReportService(mockRepository, mockLogger);
  });

  describe('createReport', () => {
    it('should create a new report', async () => {
      const reportData = ReportFactory.createReportDto({
        title: 'XSS Vulnerability',
        severity: 'high',
      });
      const mockReport = ReportFactory.createReport(reportData);
      
      mockRepository.create.mockResolvedValue(mockReport);

      const result = await reportService.createReport(reportData);

      expect(mockRepository.create).toHaveBeenCalledWith(reportData);
      expect(result).toEqual(mockReport);
      expect(mockLogger.info).toHaveBeenCalledTimes(2);
    });
  });

  describe('getReportById', () => {
    it('should return a report by id', async () => {
      const mockReport = ReportFactory.createReport();
      mockRepository.findById.mockResolvedValue(mockReport);

      const result = await reportService.getReportById('test-id');

      expect(mockRepository.findById).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockReport);
    });

    it('should throw 404 error if report not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(reportService.getReportById('non-existent')).rejects.toThrow(AppError);
      await expect(reportService.getReportById('non-existent')).rejects.toThrow(
        `${ERROR_MESSAGES.REPORT_NOT_FOUND}: non-existent`,
      );
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('assignReport', () => {
    it('should assign a report to a user', async () => {
      const mockReport = ReportFactory.createReport();
      const assigneeId = '550e8400-e29b-41d4-a716-446655440000';

      mockRepository.findById.mockResolvedValue(mockReport);
      mockRepository.update.mockResolvedValue(mockReport);

      const assignSpy = jest.spyOn(mockReport, 'assign');

      const result = await reportService.assignReport('report-id', assigneeId);

      expect(assignSpy).toHaveBeenCalledWith(assigneeId);
      expect(mockRepository.update).toHaveBeenCalledWith('report-id', mockReport);
      expect(result.assignedTo).toBe(assigneeId);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should not allow assigning resolved reports', async () => {
      const mockReport = ReportFactory.createReportWithStatus('resolved');
      mockRepository.findById.mockResolvedValue(mockReport);

      await expect(reportService.assignReport('report-id', 'assignee-id')).rejects.toThrow(
        ERROR_MESSAGES.CANNOT_ASSIGN_RESOLVED,
      );
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('listReports', () => {
    it('should return paginated reports', async () => {
      const mockReports = ReportFactory.createMultipleReports(5);
      mockRepository.findAll.mockResolvedValue({
        items: mockReports,
        total: 5,
      });

      const query = {
        page: 1,
        limit: 20,
        sortBy: 'submittedAt' as const,
        sortOrder: 'desc' as const,
      };

      const result = await reportService.listReports(query);

      expect(result.items).toEqual(mockReports);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(1);
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });
});