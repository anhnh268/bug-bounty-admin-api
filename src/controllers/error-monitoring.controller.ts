import { Request, Response } from 'express';
import {
  ErrorMonitoringService,
  ErrorCategory,
  ErrorSeverity,
} from '../services/error-monitoring.service';
import { asyncHandler } from '../middleware/error.middleware';
import { HTTP_STATUS } from '../constants';

export class ErrorMonitoringController {
  private errorMonitoringService = ErrorMonitoringService.getInstance();

  /**
   * @swagger
   * /api/v1/errors/summary:
   *   get:
   *     summary: Get error monitoring summary
   *     description: Retrieve aggregated error statistics and trends
   *     tags: [Error Monitoring]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Start date for summary period
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: End date for summary period
   *     responses:
   *       200:
   *         description: Error summary retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       type: object
   *                       properties:
   *                         totalErrors:
   *                           type: integer
   *                         errorsByCategory:
   *                           type: object
   *                           additionalProperties:
   *                             type: integer
   *                         errorsBySeverity:
   *                           type: object
   *                           additionalProperties:
   *                             type: integer
   *                         recentErrors:
   *                           type: array
   *                           items:
   *                             type: object
   *                         topErrors:
   *                           type: array
   *                           items:
   *                             type: object
   *                             properties:
   *                               fingerprint:
   *                                 type: string
   *                               category:
   *                                 type: string
   *                               message:
   *                                 type: string
   *                               count:
   *                                 type: integer
   *                         criticalErrors:
   *                           type: array
   *                           items:
   *                             type: object
   *                         trendData:
   *                           type: object
   *                           properties:
   *                             hourly:
   *                               type: array
   *                               items:
   *                                 type: integer
   *                             daily:
   *                               type: array
   *                               items:
   *                                 type: integer
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin access required
   */
  getErrorSummary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    let timeRange: { start: Date; end: Date } | undefined;

    if (req.query.startDate || req.query.endDate) {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      if (startDate && isNaN(startDate.getTime())) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'Invalid startDate format',
          message: 'startDate must be a valid ISO date string',
        });
        return;
      }

      if (endDate && isNaN(endDate.getTime())) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'Invalid endDate format',
          message: 'endDate must be a valid ISO date string',
        });
        return;
      }

      if (startDate && endDate) {
        timeRange = { start: startDate, end: endDate };
      }
    }

    const summary = await this.errorMonitoringService.getErrorSummary(timeRange);

    const response = {
      success: true,
      data: summary,
    };

    res.status(HTTP_STATUS.OK).json(response);
  });

  /**
   * @swagger
   * /api/v1/errors/categories:
   *   get:
   *     summary: Get error categories and severities
   *     description: Retrieve available error categories and severity levels
   *     tags: [Error Monitoring]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Error categories retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       type: object
   *                       properties:
   *                         categories:
   *                           type: array
   *                           items:
   *                             type: string
   *                         severities:
   *                           type: array
   *                           items:
   *                             type: string
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin access required
   */
  getErrorCategories = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const categories = Object.values(ErrorCategory);
    const severities = Object.values(ErrorSeverity);

    const response = {
      success: true,
      data: {
        categories,
        severities,
      },
    };

    res.status(HTTP_STATUS.OK).json(response);
  });

  /**
   * @swagger
   * /api/v1/errors/{errorId}:
   *   get:
   *     summary: Get error details
   *     description: Retrieve detailed information about a specific error
   *     tags: [Error Monitoring]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: errorId
   *         required: true
   *         schema:
   *           type: string
   *         description: Error ID
   *     responses:
   *       200:
   *         description: Error details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       type: object
   *                       properties:
   *                         id:
   *                           type: string
   *                         category:
   *                           type: string
   *                         severity:
   *                           type: string
   *                         message:
   *                           type: string
   *                         stack:
   *                           type: string
   *                         context:
   *                           type: object
   *                         tags:
   *                           type: array
   *                           items:
   *                             type: string
   *                         occurenceCount:
   *                           type: integer
   *                         firstOccurrence:
   *                           type: string
   *                           format: date-time
   *                         lastOccurrence:
   *                           type: string
   *                           format: date-time
   *                         resolved:
   *                           type: boolean
   *       404:
   *         description: Error not found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin access required
   */
  getErrorById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { errorId } = req.params;

    if (!errorId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Missing errorId parameter',
        message: 'errorId is required',
      });
      return;
    }

    const error = this.errorMonitoringService.getErrorById(errorId);

    if (!error) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Error not found',
        message: `Error with ID ${errorId} not found`,
      });
      return;
    }

    const response = {
      success: true,
      data: error,
    };

    res.status(HTTP_STATUS.OK).json(response);
  });

  /**
   * @swagger
   * /api/v1/errors/fingerprint/{fingerprint}:
   *   get:
   *     summary: Get error by fingerprint
   *     description: Retrieve error details using fingerprint for grouping similar errors
   *     tags: [Error Monitoring]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: fingerprint
   *         required: true
   *         schema:
   *           type: string
   *         description: Error fingerprint
   *     responses:
   *       200:
   *         description: Error details retrieved successfully
   *       404:
   *         description: Error not found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin access required
   */
  getErrorByFingerprint = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { fingerprint } = req.params;

    if (!fingerprint) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Missing fingerprint parameter',
        message: 'fingerprint is required',
      });
      return;
    }

    const error = this.errorMonitoringService.getErrorByFingerprint(fingerprint);

    if (!error) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Error not found',
        message: `Error with fingerprint ${fingerprint} not found`,
      });
      return;
    }

    const response = {
      success: true,
      data: error,
    };

    res.status(HTTP_STATUS.OK).json(response);
  });

  /**
   * @swagger
   * /api/v1/errors/fingerprint/{fingerprint}/resolve:
   *   post:
   *     summary: Mark error as resolved
   *     description: Mark an error as resolved by its fingerprint
   *     tags: [Error Monitoring]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: fingerprint
   *         required: true
   *         schema:
   *           type: string
   *         description: Error fingerprint
   *     responses:
   *       200:
   *         description: Error marked as resolved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       type: object
   *                       properties:
   *                         resolved:
   *                           type: boolean
   *       404:
   *         description: Error not found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin access required
   */
  resolveError = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { fingerprint } = req.params;
    const userId = req.user?.id;

    if (!fingerprint) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Missing fingerprint parameter',
        message: 'fingerprint is required',
      });
      return;
    }

    const resolved = await this.errorMonitoringService.resolveError(fingerprint, userId);

    if (!resolved) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Error not found',
        message: `Error with fingerprint ${fingerprint} not found`,
      });
      return;
    }

    const response = {
      success: true,
      data: {
        resolved: true,
      },
      message: 'Error marked as resolved successfully',
    };

    res.status(HTTP_STATUS.OK).json(response);
  });

  /**
   * @swagger
   * /api/v1/errors/health:
   *   get:
   *     summary: Get error monitoring health
   *     description: Check the health status of the error monitoring system
   *     tags: [Error Monitoring]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Error monitoring health retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       type: object
   *                       properties:
   *                         status:
   *                           type: string
   *                           enum: [healthy, degraded, unhealthy]
   *                         errorCount:
   *                           type: integer
   *                         criticalErrorCount:
   *                           type: integer
   *                         recentErrorRate:
   *                           type: integer
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin access required
   */
  getErrorHealth = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const health = this.errorMonitoringService.getHealth();

    const response = {
      success: true,
      data: health,
    };

    res.status(HTTP_STATUS.OK).json(response);
  });

  /**
   * @swagger
   * /api/v1/errors/test:
   *   post:
   *     summary: Generate test error
   *     description: Generate a test error for monitoring system validation (development only)
   *     tags: [Error Monitoring]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               category:
   *                 type: string
   *                 enum: [validation_error, authentication_error, database_error, network_error, security_violation]
   *               message:
   *                 type: string
   *                 default: Test error message
   *     responses:
   *       200:
   *         description: Test error generated successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       type: object
   *                       properties:
   *                         errorId:
   *                           type: string
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin access required
   */
  generateTestError = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: 'Test error generation not allowed in production',
        message: 'This endpoint is only available in development environment',
      });
      return;
    }

    const { category = 'validation_error', message = 'Test error message' } = req.body;

    // Create test error with specific patterns to trigger categorization
    let testMessage = message;
    switch (category) {
      case 'database_error':
        testMessage = `Database connection failed: ${message}`;
        break;
      case 'authentication_error':
        testMessage = `Authentication failed: ${message}`;
        break;
      case 'network_error':
        testMessage = `Network timeout: ${message}`;
        break;
      case 'security_violation':
        testMessage = `Security violation detected: ${message}`;
        break;
      default:
        testMessage = `Validation error: ${message}`;
    }

    const testError = new Error(testMessage);

    const errorId = await this.errorMonitoringService.captureError(
      testError,
      {
        userId: req.user?.id,
        requestId: req.context?.requestId,
        sessionId: req.context?.sessionId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        path: req.path,
        method: req.method,
      },
      {
        testError: true,
        generatedBy: req.user?.id || 'anonymous',
        category,
      },
    );

    const response = {
      success: true,
      data: {
        errorId,
      },
      message: 'Test error generated successfully',
    };

    res.status(HTTP_STATUS.OK).json(response);
  });
}

export const errorMonitoringController = new ErrorMonitoringController();
