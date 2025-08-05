export interface IReport {
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
}
export interface IUser {
    id: string;
    email: string;
    role: 'admin' | 'triager' | 'viewer';
}
export interface IAuthRequest extends Express.Request {
    user?: IUser;
}
export interface IApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface IPaginationParams {
    page: number;
    limit: number;
}
export interface IPaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
//# sourceMappingURL=index.d.ts.map