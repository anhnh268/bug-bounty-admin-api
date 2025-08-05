"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listReportsQuerySchema = exports.assignReportSchema = exports.updateReportStatusSchema = exports.createReportSchema = void 0;
const zod_1 = require("zod");
const constants_1 = require("../constants");
const severityEnum = zod_1.z.enum(['critical', 'high', 'medium', 'low']);
const statusEnum = zod_1.z.enum(['pending', 'triaged', 'in_progress', 'resolved', 'rejected']);
exports.createReportSchema = zod_1.z.object({
    title: zod_1.z.string().min(constants_1.API_CONSTANTS.MIN_TITLE_LENGTH).max(constants_1.API_CONSTANTS.MAX_TITLE_LENGTH),
    description: zod_1.z
        .string()
        .min(constants_1.API_CONSTANTS.MIN_DESCRIPTION_LENGTH)
        .max(constants_1.API_CONSTANTS.MAX_DESCRIPTION_LENGTH),
    severity: severityEnum,
    category: zod_1.z.string().min(2).max(50),
    affectedAsset: zod_1.z.string().min(2).max(200),
    reproductionSteps: zod_1.z.array(zod_1.z.string()).optional(),
    impact: zod_1.z.string().max(constants_1.API_CONSTANTS.MAX_IMPACT_LENGTH).optional(),
    submittedBy: zod_1.z.string().email(),
});
exports.updateReportStatusSchema = zod_1.z.object({
    status: statusEnum,
});
exports.assignReportSchema = zod_1.z.object({
    assigneeId: zod_1.z.string().uuid(),
});
exports.listReportsQuerySchema = zod_1.z.object({
    status: statusEnum.optional(),
    severity: severityEnum.optional(),
    page: zod_1.z.coerce.number().int().positive().default(constants_1.API_CONSTANTS.DEFAULT_PAGE),
    limit: zod_1.z.coerce
        .number()
        .int()
        .positive()
        .max(constants_1.API_CONSTANTS.MAX_LIMIT)
        .default(constants_1.API_CONSTANTS.DEFAULT_LIMIT),
    sortBy: zod_1.z.enum(['submittedAt', 'severity', 'status']).default('submittedAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
//# sourceMappingURL=report.dto.js.map