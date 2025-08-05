import { IReport } from '../types';
export declare class Report implements IReport {
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
    constructor(data: Omit<IReport, 'id' | 'submittedAt' | 'status'>);
    assign(userId: string): void;
    updateStatus(status: IReport['status']): void;
}
//# sourceMappingURL=report.model.d.ts.map