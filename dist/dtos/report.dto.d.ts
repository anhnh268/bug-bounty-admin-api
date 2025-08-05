import { z } from 'zod';
export declare const createReportSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    severity: z.ZodEnum<["critical", "high", "medium", "low"]>;
    category: z.ZodString;
    affectedAsset: z.ZodString;
    reproductionSteps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    impact: z.ZodOptional<z.ZodString>;
    submittedBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    description: string;
    severity: "critical" | "high" | "medium" | "low";
    category: string;
    affectedAsset: string;
    submittedBy: string;
    reproductionSteps?: string[] | undefined;
    impact?: string | undefined;
}, {
    title: string;
    description: string;
    severity: "critical" | "high" | "medium" | "low";
    category: string;
    affectedAsset: string;
    submittedBy: string;
    reproductionSteps?: string[] | undefined;
    impact?: string | undefined;
}>;
export declare const updateReportStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["pending", "triaged", "in_progress", "resolved", "rejected"]>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "triaged" | "in_progress" | "resolved" | "rejected";
}, {
    status: "pending" | "triaged" | "in_progress" | "resolved" | "rejected";
}>;
export declare const assignReportSchema: z.ZodObject<{
    assigneeId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    assigneeId: string;
}, {
    assigneeId: string;
}>;
export declare const listReportsQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["pending", "triaged", "in_progress", "resolved", "rejected"]>>;
    severity: z.ZodOptional<z.ZodEnum<["critical", "high", "medium", "low"]>>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodDefault<z.ZodEnum<["submittedAt", "severity", "status"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortBy: "severity" | "status" | "submittedAt";
    sortOrder: "asc" | "desc";
    severity?: "critical" | "high" | "medium" | "low" | undefined;
    status?: "pending" | "triaged" | "in_progress" | "resolved" | "rejected" | undefined;
}, {
    severity?: "critical" | "high" | "medium" | "low" | undefined;
    status?: "pending" | "triaged" | "in_progress" | "resolved" | "rejected" | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: "severity" | "status" | "submittedAt" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export type CreateReportDto = z.infer<typeof createReportSchema>;
export type UpdateReportStatusDto = z.infer<typeof updateReportStatusSchema>;
export type AssignReportDto = z.infer<typeof assignReportSchema>;
export type ListReportsQueryDto = z.infer<typeof listReportsQuerySchema>;
//# sourceMappingURL=report.dto.d.ts.map