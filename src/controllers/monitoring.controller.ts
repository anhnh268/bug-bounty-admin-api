import { Request, Response } from 'express';
import { MetricsCollector } from '../monitoring/metrics';
import { CacheService } from '../services/cache.service';
import { asyncHandler } from '../middleware/error.middleware';
import { HTTP_STATUS } from '../constants';

export class MonitoringController {
  private metricsCollector = MetricsCollector.getInstance();
  private cacheService = CacheService.getInstance();

  /**
   * @swagger
   * /api/v1/monitoring/health:
   *   get:
   *     summary: Health check with detailed status
   *     description: Returns comprehensive health status including memory, error rates, and response times
   *     tags: [Monitoring]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Health status retrieved successfully
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
   *                           enum: [healthy, warning, critical]
   *                           example: healthy
   *                         checks:
   *                           type: object
   *                           properties:
   *                             memory:
   *                               type: object
   *                               properties:
   *                                 status:
   *                                   type: string
   *                                   example: healthy
   *                                 heap_used:
   *                                   type: number
   *                                   example: 45678912
   *                                 heap_total:
   *                                   type: number
   *                                   example: 67108864
   *                                 usage_percent:
   *                                   type: number
   *                                   example: 68
   *                             error_rate:
   *                               type: object
   *                               properties:
   *                                 status:
   *                                   type: string
   *                                   example: healthy
   *                                 value:
   *                                   type: number
   *                                   example: 2.5
   *                                 unit:
   *                                   type: string
   *                                   example: percentage
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  getHealthStatus = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const healthStatus = this.metricsCollector.getHealthStatus();

    const response = {
      success: true,
      data: {
        ...healthStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
      },
    };

    const statusCode =
      healthStatus.status === 'healthy'
        ? HTTP_STATUS.OK
        : healthStatus.status === 'warning'
          ? HTTP_STATUS.OK
          : HTTP_STATUS.SERVICE_UNAVAILABLE;

    res.status(statusCode).json(response);
  });

  /**
   * @swagger
   * /api/v1/monitoring/metrics:
   *   get:
   *     summary: Get application metrics
   *     description: Returns detailed application metrics including request counts, response times, and performance data
   *     tags: [Monitoring]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: metric
   *         schema:
   *           type: string
   *         description: Filter by specific metric name
   *         example: http_requests_total
   *       - in: query
   *         name: summary
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Return summarized metrics instead of raw data
   *     responses:
   *       200:
   *         description: Metrics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       type: object
   *                       description: Metrics data (structure varies based on summary parameter)
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  getMetrics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { metric, summary } = req.query;

    let data;
    if (summary === 'true') {
      data = this.metricsCollector.getMetricsSummary();
    } else if (metric && typeof metric === 'string') {
      data = this.metricsCollector.getMetrics(metric);
    } else {
      data = this.metricsCollector.getMetrics();
      // Convert Map to object for JSON serialization
      if (data instanceof Map) {
        data = Object.fromEntries(data);
      }
    }

    const response = {
      success: true,
      data: {
        metrics: data,
        collected_at: new Date().toISOString(),
        performance: this.metricsCollector.getPerformanceMetrics(),
      },
    };

    res.status(HTTP_STATUS.OK).json(response);
  });

  /**
   * @swagger
   * /api/v1/monitoring/performance:
   *   get:
   *     summary: Get performance metrics
   *     description: Returns system performance metrics including memory usage, CPU usage, and request statistics
   *     tags: [Monitoring]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Performance metrics retrieved successfully
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
   *                         request_count:
   *                           type: number
   *                           example: 1542
   *                         error_count:
   *                           type: number
   *                           example: 23
   *                         active_connections:
   *                           type: number
   *                           example: 5
   *                         memory_usage:
   *                           type: object
   *                           properties:
   *                             heap_used:
   *                               type: number
   *                               example: 45678912
   *                             heap_total:
   *                               type: number
   *                               example: 67108864
   *                             external:
   *                               type: number
   *                               example: 1234567
   *                         average_response_time:
   *                           type: number
   *                           example: 145.6
   *                         uptime:
   *                           type: number
   *                           example: 86400
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  getPerformanceMetrics = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const performance = this.metricsCollector.getPerformanceMetrics();
    const avgResponseTime =
      performance.requestDuration.length > 0
        ? performance.requestDuration.reduce((a, b) => a + b, 0) /
          performance.requestDuration.length
        : 0;

    const response = {
      success: true,
      data: {
        request_count: performance.requestCount,
        error_count: performance.errorCount,
        active_connections: performance.activeConnections,
        memory_usage: performance.memoryUsage,
        cpu_usage: performance.cpuUsage,
        average_response_time: Math.round(avgResponseTime * 100) / 100,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
    };

    res.status(HTTP_STATUS.OK).json(response);
  });

  /**
   * @swagger
   * /api/v1/monitoring/logs:
   *   post:
   *     summary: Create a custom log entry
   *     description: Allows creating custom log entries for testing or debugging
   *     tags: [Monitoring]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - level
   *               - message
   *             properties:
   *               level:
   *                 type: string
   *                 enum: [debug, info, warn, error]
   *                 example: info
   *               message:
   *                 type: string
   *                 example: "Custom log message for testing"
   *               context:
   *                 type: object
   *                 description: Additional context data
   *                 example:
   *                   userId: "123"
   *                   action: "test_logging"
   *     responses:
   *       201:
   *         description: Log entry created successfully
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
   *                         logged_at:
   *                           type: string
   *                           format: date-time
   *                           example: "2024-01-15T10:30:00.000Z"
   *       400:
   *         description: Invalid log level or missing required fields
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  createLogEntry = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { level, message, context } = req.body;

    if (!level || !message) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Missing required fields: level and message',
      });
      return;
    }

    const validLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLevels.includes(level)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: `Invalid log level. Must be one of: ${validLevels.join(', ')}`,
      });
      return;
    }

    // Create logger instance and log the message
    const logger = new (await import('../utils/structured-logger')).StructuredLogger();
    const logContext = {
      ...context,
      userId: req.user?.id,
      requestId: req.context?.requestId,
      custom_log: true,
    };

    switch (level) {
      case 'debug':
        logger.debug(message, logContext);
        break;
      case 'info':
        logger.info(message, logContext);
        break;
      case 'warn':
        logger.warn(message, logContext);
        break;
      case 'error':
        logger.error(message, logContext);
        break;
    }

    const response = {
      success: true,
      data: {
        logged_at: new Date().toISOString(),
        level,
        message,
        context: logContext,
      },
      message: 'Log entry created successfully',
    };

    res.status(HTTP_STATUS.CREATED).json(response);
  });

  /**
   * @swagger
   * /api/v1/monitoring/cache:
   *   get:
   *     summary: Get cache statistics and status
   *     description: Returns cache performance metrics including hit rate, memory usage, and health status
   *     tags: [Monitoring]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Cache statistics retrieved successfully
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
   *                         stats:
   *                           type: object
   *                           properties:
   *                             hits:
   *                               type: number
   *                               example: 1543
   *                             misses:
   *                               type: number
   *                               example: 245
   *                             sets:
   *                               type: number
   *                               example: 456
   *                             deletes:
   *                               type: number
   *                               example: 23
   *                             errors:
   *                               type: number
   *                               example: 2
   *                             hitRate:
   *                               type: number
   *                               example: 86.29
   *                         health:
   *                           type: object
   *                           properties:
   *                             status:
   *                               type: string
   *                               enum: [healthy, degraded, unhealthy]
   *                               example: healthy
   *                             latency:
   *                               type: number
   *                               example: 2.5
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  getCacheStatus = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const stats = this.cacheService.getStats();
    const health = await this.cacheService.healthCheck();

    const response = {
      success: true,
      data: {
        stats,
        health,
        timestamp: new Date().toISOString(),
      },
    };

    res.status(HTTP_STATUS.OK).json(response);
  });
}

export const monitoringController = new MonitoringController();
