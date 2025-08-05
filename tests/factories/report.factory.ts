import { IReport } from '../../src/types';
import { Report } from '../../src/models/report.model';
import { CreateReportDto } from '../../src/dtos/report.dto';

export class ReportFactory {
  private static counter = 0;

  static createReportDto(overrides?: Partial<CreateReportDto>): CreateReportDto {
    this.counter++;
    return {
      title: `Test Report ${this.counter}`,
      description: `Test description for report ${this.counter}`,
      severity: 'medium',
      category: 'Test Category',
      affectedAsset: `https://example.com/test-${this.counter}`,
      submittedBy: `test-user-${this.counter}@example.com`,
      reproductionSteps: ['Step 1', 'Step 2', 'Step 3'],
      impact: 'Test impact description',
      ...overrides,
    };
  }

  static createReport(overrides?: Partial<IReport>): Report {
    const data = this.createReportDto(overrides);
    return new Report(data);
  }

  static createMultipleReports(count: number, overrides?: Partial<IReport>): Report[] {
    return Array.from({ length: count }, () => this.createReport(overrides));
  }

  static createReportWithStatus(
    status: IReport['status'], 
    overrides?: Partial<IReport>
  ): Report {
    const report = this.createReport(overrides);
    report.status = status;
    return report;
  }

  static createAssignedReport(assigneeId: string, overrides?: Partial<IReport>): Report {
    const report = this.createReport(overrides);
    report.assign(assigneeId);
    return report;
  }
}