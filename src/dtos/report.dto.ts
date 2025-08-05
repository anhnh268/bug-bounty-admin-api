import { z } from 'zod';
import { API_CONSTANTS } from '../constants';

const severityEnum = z.enum(['critical', 'high', 'medium', 'low']);
const statusEnum = z.enum(['pending', 'triaged', 'in_progress', 'resolved', 'rejected']);

export const createReportSchema = z.object({
  title: z.string().min(API_CONSTANTS.MIN_TITLE_LENGTH).max(API_CONSTANTS.MAX_TITLE_LENGTH),
  description: z
    .string()
    .min(API_CONSTANTS.MIN_DESCRIPTION_LENGTH)
    .max(API_CONSTANTS.MAX_DESCRIPTION_LENGTH),
  severity: severityEnum,
  category: z.string().min(2).max(50),
  affectedAsset: z.string().min(2).max(200),
  reproductionSteps: z.array(z.string()).optional(),
  impact: z.string().max(API_CONSTANTS.MAX_IMPACT_LENGTH).optional(),
  submittedBy: z.string().email(),
});

export const updateReportStatusSchema = z.object({
  status: statusEnum,
});

export const assignReportSchema = z.object({
  assigneeId: z.string().uuid(),
});

export const listReportsQuerySchema = z.object({
  status: statusEnum.optional(),
  severity: severityEnum.optional(),
  page: z.coerce.number().int().positive().default(API_CONSTANTS.DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(API_CONSTANTS.MAX_LIMIT)
    .default(API_CONSTANTS.DEFAULT_LIMIT),
  sortBy: z.enum(['submittedAt', 'severity', 'status']).default('submittedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateReportDto = z.infer<typeof createReportSchema>;
export type UpdateReportStatusDto = z.infer<typeof updateReportStatusSchema>;
export type AssignReportDto = z.infer<typeof assignReportSchema>;
export type ListReportsQueryDto = z.infer<typeof listReportsQuerySchema>;
