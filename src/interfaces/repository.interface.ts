import { IReport } from '../types';
import { Report } from '../models/report.model';

export interface IReportFilter {
  status?: IReport['status'];
  severity?: IReport['severity'];
  assignedTo?: string;
}

export interface IPaginationOptions {
  page: number;
  limit: number;
  sortBy: keyof IReport;
  sortOrder: 'asc' | 'desc';
}

export interface IPaginatedResult<T> {
  items: T[];
  total: number;
}

export interface IReportRepository {
  create(data: Omit<IReport, 'id' | 'submittedAt' | 'status'>): Promise<Report>;
  findById(id: string): Promise<Report | null>;
  findAll(filter: IReportFilter, options: IPaginationOptions): Promise<IPaginatedResult<Report>>;
  update(id: string, updates: Partial<Report>): Promise<Report | null>;
  delete(id: string): Promise<boolean>;
  countByStatus(): Promise<Record<IReport['status'], number>>;
}
