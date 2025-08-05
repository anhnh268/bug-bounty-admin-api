export enum ReportStatus {
  PENDING = 'pending',
  TRIAGED = 'triaged', 
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  REJECTED = 'rejected'
}

export enum ReportSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export type ReportSeverityString = 'critical' | 'high' | 'medium' | 'low';

export interface Report {
  id: string;
  title: string;
  description: string;
  url?: string;
  severity: ReportSeverity;
  status: ReportStatus;
  assignedTo?: string;
  submittedBy: string;
  reproductionSteps?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export interface CreateReportDto {
  title: string;
  description: string;
  url?: string;
  severity: ReportSeverityString;
  reproductionSteps?: string | string[];
  expectedBehavior?: string;
  actualBehavior?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}