import { IReport, IPaginatedResponse } from '../types';
import { IRequestContext } from '../types/context';
import { Report } from '../models/report.model';
import { IReportRepository } from '../interfaces/repository.interface';
import { ILogger } from '../interfaces/logger.interface';
import { CreateReportDto, ListReportsQueryDto } from '../dtos/report.dto';
export declare class ReportService {
    private readonly reportRepository;
    private readonly logger;
    constructor(reportRepository: IReportRepository, logger: ILogger);
    createReport(data: CreateReportDto, context?: IRequestContext): Promise<Report>;
    getReportById(id: string, context?: IRequestContext): Promise<Report>;
    listReports(query: ListReportsQueryDto, context?: IRequestContext): Promise<IPaginatedResponse<Report>>;
    assignReport(reportId: string, assigneeId: string, context?: IRequestContext): Promise<Report>;
    updateReportStatus(reportId: string, status: IReport['status'], context?: IRequestContext): Promise<Report>;
    getReportStats(context?: IRequestContext): Promise<Record<IReport['status'], number>>;
}
//# sourceMappingURL=report.service.d.ts.map