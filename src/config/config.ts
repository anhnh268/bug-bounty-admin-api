import dotenv from 'dotenv';
import { z } from 'zod';
import { API_CONSTANTS } from '../constants';

dotenv.config();

const configSchema = z.object({
  env: z.enum(['development', 'test', 'production']).default('development'),
  port: z.number().min(1).max(65535).default(3001),
  apiToken: z.string().min(1),
  cors: z.object({
    origin: z.string().default('*'),
    credentials: z.boolean().default(true),
  }),
  pagination: z.object({
    defaultPage: z.number().positive().default(API_CONSTANTS.DEFAULT_PAGE),
    defaultLimit: z.number().positive().default(API_CONSTANTS.DEFAULT_LIMIT),
    maxLimit: z.number().positive().default(API_CONSTANTS.MAX_LIMIT),
  }),
  jwt: z.object({
    accessTokenSecret: z.string().min(32),
    refreshTokenSecret: z.string().min(32),
    accessTokenExpiry: z.string().default('15m'),
    refreshTokenExpiry: z.string().default('7d'),
  }),
  rateLimit: z.object({
    windowMs: z.number().default(15 * 60 * 1000), // 15 minutes
    maxRequests: z.number().default(100),
    skipSuccessfulRequests: z.boolean().default(false),
  }),
});

const rawConfig = {
  env: process.env.NODE_ENV,
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  apiToken: process.env.API_TOKEN || 'default-dev-token',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  pagination: {
    defaultPage: API_CONSTANTS.DEFAULT_PAGE,
    defaultLimit: API_CONSTANTS.DEFAULT_LIMIT,
    maxLimit: API_CONSTANTS.MAX_LIMIT,
  },
  jwt: {
    accessTokenSecret:
      process.env.JWT_ACCESS_SECRET || 'super-secret-access-token-key-for-development-only-at-least-32-chars',
    refreshTokenSecret:
      process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-token-key-for-development-only-at-least-32-chars',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  rateLimit: {
    windowMs: process.env.RATE_LIMIT_WINDOW_MS
      ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10)
      : 15 * 60 * 1000,
    maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS
      ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10)
      : 100,
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
  },
};

export const config = configSchema.parse(rawConfig);

export const isDevelopment = config.env === 'development';
export const isProduction = config.env === 'production';
export const isTest = config.env === 'test';
