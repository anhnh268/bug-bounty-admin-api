import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { Request, Response } from 'express';
import { config, isDevelopment } from '../config/config';
import { logger } from '../utils/logger';
import { IApiResponse } from '../types';
import { HTTP_STATUS } from '../constants';

/**
 * Create rate limiter with custom configuration
 */
const createRateLimiter = (options: {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs || config.rateLimit.windowMs,
    max: options.maxRequests || config.rateLimit.maxRequests,
    skipSuccessfulRequests:
      options.skipSuccessfulRequests ?? config.rateLimit.skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
      });

      const response: IApiResponse = {
        success: false,
        error: 'Too Many Requests',
        message: options.message || 'Too many requests from this IP, please try again later',
      };

      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json(response);
    },
    skip: (req: Request) => {
      // Skip rate limiting in test environment
      if (config.env === 'test') {
        return true;
      }

      // Skip for health checks
      if (req.path === '/health') {
        return true;
      }

      return false;
    },
  });
};

/**
 * General API rate limiter
 */
export const generalRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many API requests from this IP, please try again later',
});

/**
 * Strict rate limiter for sensitive endpoints
 */
export const strictRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 20, // limit each IP to 20 requests per windowMs
  message: 'Too many requests to sensitive endpoint, please try again later',
  skipSuccessfulRequests: true,
});

/**
 * Auth endpoints rate limiter (login, register, etc.)
 */
export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // limit each IP to 10 auth attempts per windowMs
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: true,
});

/**
 * Speed limiter - gradually slow down requests
 */
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per windowMs without delay
  delayMs: 500, // add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // maximum delay of 20 seconds
  skip: (req: Request) => {
    return config.env === 'test' || req.path === '/health';
  },
});

/**
 * Development-friendly rate limiter (more permissive)
 */
export const devRateLimit = isDevelopment
  ? createRateLimiter({
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 1000, // very high limit for development
    })
  : generalRateLimit;

/**
 * Rate limiter for report creation (prevent spam)
 */
export const reportCreationRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // limit to 10 report submissions per hour
  message: 'Too many report submissions from this IP, please try again later',
});
