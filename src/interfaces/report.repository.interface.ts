import { Report, CreateReportDto, ReportStatus } from '../types/report.types';
import { FindOptions, PaginatedResponse } from '../types/utility.types';

export interface IReportRepository {
  create(data: CreateReportDto): Promise<Report>;
  findById(id: string): Promise<Report | null>;
  findAll(options?: FindOptions<Report>): Promise<PaginatedResponse<Report>>;
  update(id: string, data: Partial<Report>): Promise<Report | null>;
  delete(id: string): Promise<boolean>;
  assign(id: string, assigneeId: string): Promise<Report | null>;
  findByStatus(status: ReportStatus, options?: FindOptions<Report>): Promise<Report[]>;
  findByAssignee(assigneeId: string, options?: FindOptions<Report>): Promise<Report[]>;
  getStatistics(): Promise<{
    total: number;
    byStatus: Record<ReportStatus, number>;
    bySeverity: Record<string, number>;
  }>;
  countByStatus(status: ReportStatus): Promise<number>;
}