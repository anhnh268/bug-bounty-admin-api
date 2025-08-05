"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTest = exports.isProduction = exports.isDevelopment = exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
const constants_1 = require("../constants");
dotenv_1.default.config();
const configSchema = zod_1.z.object({
    env: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    port: zod_1.z.number().min(1).max(65535).default(3000),
    apiToken: zod_1.z.string().min(1),
    cors: zod_1.z.object({
        origin: zod_1.z.string().default('*'),
        credentials: zod_1.z.boolean().default(true),
    }),
    pagination: zod_1.z.object({
        defaultPage: zod_1.z.number().positive().default(constants_1.API_CONSTANTS.DEFAULT_PAGE),
        defaultLimit: zod_1.z.number().positive().default(constants_1.API_CONSTANTS.DEFAULT_LIMIT),
        maxLimit: zod_1.z.number().positive().default(constants_1.API_CONSTANTS.MAX_LIMIT),
    }),
});
const rawConfig = {
    env: process.env.NODE_ENV,
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
    apiToken: process.env.API_TOKEN || 'default-dev-token',
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true,
    },
    pagination: {
        defaultPage: constants_1.API_CONSTANTS.DEFAULT_PAGE,
        defaultLimit: constants_1.API_CONSTANTS.DEFAULT_LIMIT,
        maxLimit: constants_1.API_CONSTANTS.MAX_LIMIT,
    },
};
exports.config = configSchema.parse(rawConfig);
exports.isDevelopment = exports.config.env === 'development';
exports.isProduction = exports.config.env === 'production';
exports.isTest = exports.config.env === 'test';
//# sourceMappingURL=config.js.map