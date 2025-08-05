import { Request, Response, NextFunction } from 'express';
import { MetricsCollector } from '../monitoring/metrics';
import { StructuredLogger } from '../utils/structured-logger';

export interface MonitoringRequest extends Request {
  startTime?: number;
  requestId?: string;
}

const metricsCollector = MetricsCollector.getInstance();
const logger = new StructuredLogger();

export const requestMetrics = (req: MonitoringRequest, res: Response, next: NextFunction): void => {
  req.startTime = Date.now();

  // Track active connections
  const metrics = metricsCollector.getPerformanceMetrics();
  metrics.activeConnections++;

  res.on('finish', () => {
    if (req.startTime) {
      const duration = Date.now() - req.startTime;

      // Record metrics
      metricsCollector.recordHttpRequest(req, res, duration);

      // Log structured request data
      logger.httpRequest(req, res, duration);

      // Track connection completion
      metrics.activeConnections = Math.max(0, metrics.activeConnections - 1);
    }
  });

  res.on('error', (error: Error) => {
    logger.httpError(req, error, res.statusCode || 500);
    metricsCollector.recordMetric('http_errors_total', 1, 'count', {
      method: req.method,
      path: req.path,
      error_type: error.name,
    });
  });

  next();
};

export const businessEventTracking = (
  eventName: string,
  extractTags?: (req: Request, res: Response) => Record<string, string>,
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        const tags = extractTags ? extractTags(req, res) : {};
        metricsCollector.recordBusinessEvent(eventName, tags);
        logger.businessEvent(eventName, {
          userId: req.user?.id,
          requestId: req.context?.requestId,
          ...tags,
        });
      }
    });
    next();
  };
};

export const securityEventTracking = (req: Request, res: Response, next: NextFunction): void => {
  // Track authentication attempts
  if (req.path.includes('auth') || req.path.includes('login')) {
    res.on('finish', () => {
      if (res.statusCode === 401) {
        metricsCollector.recordSecurityEvent('auth_failure', 'medium', {
          method: req.method,
          path: req.path,
          ip: req.ip || 'unknown',
          user_agent: req.get('user-agent') || 'unknown',
        });
        logger.securityEvent('Authentication failure', 'medium', {
          ip: req.ip || 'unknown',
          userAgent: req.get('user-agent'),
          path: req.path,
        });
      }
    });
  }

  // Track suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /drop.*table/i, // SQL injection
    /exec\(/i, // Code execution
  ];

  const requestData = JSON.stringify([req.params, req.query, req.body]);
  const hasSuspiciousPattern = suspiciousPatterns.some((pattern) => pattern.test(requestData));

  if (hasSuspiciousPattern) {
    metricsCollector.recordSecurityEvent('suspicious_request', 'high', {
      method: req.method,
      path: req.path,
      ip: req.ip || 'unknown',
    });
    logger.securityEvent('Suspicious request pattern detected', 'high', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      path: req.path,
      patterns: 'potential_injection',
    });
  }

  next();
};

export const slowQueryTracking = (threshold: number = 1000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json;

    res.json = function (data: any) {
      const duration = Date.now() - (req as MonitoringRequest).startTime!;

      if (duration > threshold) {
        metricsCollector.recordMetric('slow_requests_total', 1, 'count', {
          method: req.method,
          path: req.path,
          duration: duration.toString(),
        });
        logger.warn('Slow request detected', {
          method: req.method,
          path: req.path,
          duration: `${duration}ms`,
          threshold: `${threshold}ms`,
          userId: req.user?.id,
          requestId: req.context?.requestId,
        });
      }

      return originalJson.call(this, data);
    };

    next();
  };
};

export const resourceMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  const memUsage = process.memoryUsage();
  const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  // Alert on high memory usage
  if (memUsagePercent > 85) {
    logger.warn('High memory usage detected', {
      heap_used: memUsage.heapUsed,
      heap_total: memUsage.heapTotal,
      usage_percent: Math.round(memUsagePercent),
      path: req.path,
    });
  }

  // Track memory usage per request
  res.on('finish', () => {
    const endMemUsage = process.memoryUsage();
    const memoryDelta = endMemUsage.heapUsed - memUsage.heapUsed;

    if (Math.abs(memoryDelta) > 10 * 1024 * 1024) {
      // > 10MB change
      metricsCollector.recordMetric('memory_usage_delta', memoryDelta, 'bytes', {
        method: req.method,
        path: req.path,
      });
    }
  });

  next();
};
