import { IReport } from '../types';
import { Report } from '../models/report.model';
import { IReportRepository, IReportFilter, IPaginationOptions, IPaginatedResult } from '../interfaces/repository.interface';
export declare class InMemoryReportRepository implements IReportRepository {
    private reports;
    create(data: Omit<IReport, 'id' | 'submittedAt' | 'status'>): Promise<Report>;
    findById(id: string): Promise<Report | null>;
    findAll(filter: IReportFilter | undefined, options: IPaginationOptions): Promise<IPaginatedResult<Report>>;
    update(id: string, updates: Partial<Report>): Promise<Report | null>;
    delete(id: string): Promise<boolean>;
    countByStatus(): Promise<Record<IReport['status'], number>>;
}
export declare const reportRepository: IReportRepository;
//# sourceMappingURL=report.repository.d.ts.map