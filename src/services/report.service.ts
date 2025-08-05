import { IReport, IPaginatedResponse } from '../types';
import { IRequestContext } from '../types/context';
import { Report, CreateReportDto } from '../types/report.types';
import { IReportRepository } from '../interfaces/report.repository.interface';
import { ILogger } from '../interfaces/logger.interface';
import { AppError } from '../middleware/error.middleware';
import { ListReportsQueryDto } from '../dtos/report.dto';
import { ERROR_MESSAGES, HTTP_STATUS } from '../constants';

export class ReportService {
  constructor(
    private readonly reportRepository: IReportRepository,
    private readonly logger: ILogger,
  ) {}

  /**
   * Creates a new vulnerability report
   * @throws {AppError} When report creation fails
   */
  async createReport(data: CreateReportDto, context?: IRequestContext): Promise<Report> {
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

  /**
   * Retrieves a report by ID
   * @throws {AppError} When report is not found
   */
  async getReportById(id: string, context?: IRequestContext): Promise<Report> {
    const report = await this.reportRepository.findById(id);

    if (!report) {
      this.logger.warn('Report not found', {
        reportId: id,
        userId: context?.user.id,
        requestId: context?.requestId,
      });
      throw new AppError(HTTP_STATUS.NOT_FOUND, `${ERROR_MESSAGES.REPORT_NOT_FOUND}: ${id}`);
    }

    return report;
  }

  /**
   * Lists reports with filtering and pagination
   */
  async listReports(
    query: ListReportsQueryDto,
    context?: IRequestContext,
  ): Promise<IPaginatedResponse<Report>> {
    const { page, limit, status, severity, sortBy, sortOrder } = query;

    this.logger.debug('Listing reports', {
      query,
      userId: context?.user.id,
      requestId: context?.requestId,
    });

    const result = await this.reportRepository.findAll({
      where: { 
        ...(status && { status: { eq: status as any } }),
        ...(severity && { severity: { eq: severity as any } })
      },
      pagination: { page, limit },
      orderBy: { sortBy: sortBy as keyof Report, sortOrder }
    });
    const { items, total } = result;

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Assigns a report to a triager
   * @throws {AppError} When report cannot be assigned
   */
  async assignReport(
    reportId: string,
    assigneeId: string,
    context?: IRequestContext,
  ): Promise<Report> {
    const report = await this.getReportById(reportId, context);

    if (report.status === 'resolved' || report.status === 'rejected') {
      this.logger.warn('Attempted to assign closed report', {
        reportId,
        status: report.status,
        userId: context?.user.id,
        requestId: context?.requestId,
      });
      throw new AppError(HTTP_STATUS.BAD_REQUEST, ERROR_MESSAGES.CANNOT_ASSIGN_RESOLVED);
    }

    await this.reportRepository.assign(reportId, assigneeId);

    this.logger.info('Report assigned', {
      reportId,
      assigneeId,
      userId: context?.user.id,
      requestId: context?.requestId,
    });

    return report;
  }

  /**
   * Updates the status of a report
   */
  async updateReportStatus(
    reportId: string,
    status: IReport['status'],
    context?: IRequestContext,
  ): Promise<Report> {
    const report = await this.getReportById(reportId, context);
    const previousStatus = report.status;

    const updatedReport = await this.reportRepository.update(reportId, { 
      status: status as any,
      ...(status === 'resolved' && { resolvedAt: new Date() })
    });

    this.logger.info('Report status updated', {
      reportId,
      previousStatus,
      newStatus: status,
      userId: context?.user.id,
      requestId: context?.requestId,
    });

    return updatedReport || report;
  }

  /**
   * Gets statistics of reports by status
   */
  async getReportStats(context?: IRequestContext): Promise<Record<IReport['status'], number>> {
    this.logger.debug('Getting report statistics', {
      userId: context?.user.id,
      requestId: context?.requestId,
    });

    const stats = await this.reportRepository.getStatistics();
    return stats.byStatus;
  }
}
