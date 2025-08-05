import { IReport } from '../types';
import { Report } from '../models/report.model';
import {
  IReportRepository,
  IReportFilter,
  IPaginationOptions,
  IPaginatedResult,
} from '../interfaces/repository.interface';

export class InMemoryReportRepository implements IReportRepository {
  private reports: Map<string, Report> = new Map();

  async create(data: Omit<IReport, 'id' | 'submittedAt' | 'status'>): Promise<Report> {
    const report = new Report(data);
    this.reports.set(report.id, report);
    return report;
  }

  async findById(id: string): Promise<Report | null> {
    return this.reports.get(id) || null;
  }

  async findAll(
    filter: IReportFilter = {},
    options: IPaginationOptions,
  ): Promise<IPaginatedResult<Report>> {
    const { page, limit, sortBy, sortOrder } = options;
    let reports = Array.from(this.reports.values());

    // Apply filters
    if (filter.status) {
      reports = reports.filter((r) => r.status === filter.status);
    }
    if (filter.severity) {
      reports = reports.filter((r) => r.severity === filter.severity);
    }
    if (filter.assignedTo) {
      reports = reports.filter((r) => r.assignedTo === filter.assignedTo);
    }

    // Sort
    reports.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];

      if (aValue === undefined || bValue === undefined) return 0;

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Paginate
    const total = reports.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const items = reports.slice(startIndex, endIndex);

    return { items, total };
  }

  async update(id: string, updates: Partial<Report>): Promise<Report | null> {
    const report = this.reports.get(id);
    if (!report) return null;

    Object.assign(report, updates);
    return report;
  }

  async delete(id: string): Promise<boolean> {
    return this.reports.delete(id);
  }

  async countByStatus(): Promise<Record<IReport['status'], number>> {
    const counts: Record<IReport['status'], number> = {
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

export const reportRepository: IReportRepository = new InMemoryReportRepository();
