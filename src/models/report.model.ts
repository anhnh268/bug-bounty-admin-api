import { IReport } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class Report implements IReport {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'triaged' | 'in_progress' | 'resolved' | 'rejected';
  submittedBy: string;
  submittedAt: Date;
  assignedTo?: string;
  assignedAt?: Date;
  category: string;
  affectedAsset: string;
  reproductionSteps?: string[];
  impact?: string;

  constructor(data: Omit<IReport, 'id' | 'submittedAt' | 'status'>) {
    this.id = uuidv4();
    this.title = data.title;
    this.description = data.description;
    this.severity = data.severity;
    this.status = 'pending';
    this.submittedBy = data.submittedBy;
    this.submittedAt = new Date();
    this.category = data.category;
    this.affectedAsset = data.affectedAsset;
    this.reproductionSteps = data.reproductionSteps;
    this.impact = data.impact;
  }

  assign(userId: string): void {
    this.assignedTo = userId;
    this.assignedAt = new Date();
    if (this.status === 'pending') {
      this.status = 'triaged';
    }
  }

  updateStatus(status: IReport['status']): void {
    this.status = status;
  }
}
