import { Request, Response, NextFunction } from 'express';
import { StructuredLogger } from './structured-logger';
import { MetricsCollector } from '../monitoring/metrics';

const logger = new StructuredLogger();
const metricsCollector = MetricsCollector.getInstance();

export interface PerformanceOptions {
  threshold?: number; // Threshold in milliseconds to log slow operations
  includeHeaders?: boolean;
  includeMemory?: boolean;
}

// Performance timing decorator
export function timed(options: PerformanceOptions = {}) {
  const { threshold = 1000, includeMemory = false } = options;

  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = process.hrtime.bigint();
      const startMemory = includeMemory ? process.memoryUsage() : null;

      try {
        const result = await method.apply(this, args);

        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

        if (duration > threshold) {
          const context: any = {
            method: propertyName,
            duration: `${duration.toFixed(2)}ms`,
            threshold: `${threshold}ms`,
          };

          if (includeMemory && startMemory) {
            const endMemory = process.memoryUsage();
            context.memory_delta = {
              heap_used: endMemory.heapUsed - startMemory.heapUsed,
              heap_total: endMemory.heapTotal - startMemory.heapTotal,
              external: endMemory.external - startMemory.external,
            };
          }

          logger.warn('Slow operation detected', context);
        }

        // Record metrics
        metricsCollector.recordMetric('method_duration', duration, 'milliseconds', {
          method: propertyName,
          class: target.constructor.name,
        });

        return result;
      } catch (error) {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000;

        logger.error('Method execution failed', error as Error, {
          method: propertyName,
          duration: `${duration.toFixed(2)}ms`,
        });

        throw error;
      }
    };
  };
}

// Request performance middleware
export const requestTiming = (options: PerformanceOptions = {}) => {
  const { threshold = 2000, includeHeaders = false, includeMemory = false } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = process.hrtime.bigint();
    const startMemory = includeMemory ? process.memoryUsage() : null;

    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      const context: any = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration.toFixed(2)}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.user?.id,
        requestId: req.context?.requestId,
      };

      if (includeHeaders) {
        context.headers = {
          contentLength: res.get('Content-Length'),
          contentType: res.get('Content-Type'),
        };
      }

      if (includeMemory && startMemory) {
        const endMemory = process.memoryUsage();
        context.memory_delta = {
          heap_used: endMemory.heapUsed - startMemory.heapUsed,
          heap_total: endMemory.heapTotal - startMemory.heapTotal,
          external: endMemory.external - startMemory.external,
        };
      }

      if (duration > threshold) {
        logger.warn('Slow request detected', {
          ...context,
          threshold: `${threshold}ms`,
        });

        metricsCollector.recordMetric('slow_requests_total', 1, 'count', {
          method: req.method,
          path: req.path,
          status_code: res.statusCode.toString(),
        });
      }

      // Record performance metrics
      metricsCollector.recordMetric('request_duration', duration, 'milliseconds', {
        method: req.method,
        path: req.path,
        status_code: res.statusCode.toString(),
      });
    });

    next();
  };
};

// Database query performance wrapper
export async function timedQuery<T>(
  operation: string,
  query: () => Promise<T>,
  threshold: number = 500,
): Promise<T> {
  const startTime = process.hrtime.bigint();

  try {
    const result = await query();

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;

    if (duration > threshold) {
      logger.warn('Slow database query detected', {
        operation,
        duration: `${duration.toFixed(2)}ms`,
        threshold: `${threshold}ms`,
      });
    }

    metricsCollector.recordDatabaseQuery(operation, 'unknown', duration, true);

    return result;
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;

    logger.error('Database query failed', error as Error, {
      operation,
      duration: `${duration.toFixed(2)}ms`,
    });

    metricsCollector.recordDatabaseQuery(operation, 'unknown', duration, false);

    throw error;
  }
}

// Memory monitoring utilities
export class MemoryMonitor {
  private static thresholds = {
    warning: 0.8, // 80% of heap
    critical: 0.9, // 90% of heap
  };

  static checkMemoryUsage(): {
    status: 'healthy' | 'warning' | 'critical';
    usage: NodeJS.MemoryUsage;
    usagePercent: number;
  } {
    const usage = process.memoryUsage();
    const usagePercent = usage.heapUsed / usage.heapTotal;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (usagePercent > this.thresholds.critical) {
      status = 'critical';
    } else if (usagePercent > this.thresholds.warning) {
      status = 'warning';
    }

    if (status !== 'healthy') {
      logger.warn('High memory usage detected', {
        status,
        usage_percent: Math.round(usagePercent * 100),
        heap_used: usage.heapUsed,
        heap_total: usage.heapTotal,
      });

      metricsCollector.recordMetric('memory_pressure', usagePercent, 'ratio', {
        status,
      });
    }

    return {
      status,
      usage,
      usagePercent: Math.round(usagePercent * 100),
    };
  }

  static forceGarbageCollection(): boolean {
    if (global.gc) {
      const beforeGC = process.memoryUsage();
      global.gc();
      const afterGC = process.memoryUsage();

      const freed = beforeGC.heapUsed - afterGC.heapUsed;

      logger.info('Garbage collection completed', {
        freed_bytes: freed,
        freed_mb: Math.round(freed / 1024 / 1024),
        before: beforeGC,
        after: afterGC,
      });

      metricsCollector.recordMetric('gc_freed_bytes', freed, 'bytes');

      return true;
    }

    logger.warn('Garbage collection not available');
    return false;
  }
}

// Performance optimization middleware
export const performanceOptimization = (req: Request, res: Response, next: NextFunction): void => {
  // Add compression headers for JSON responses
  if (req.accepts('json')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  // Add performance-related headers
  res.setHeader('X-Response-Time', Date.now().toString());

  // Monitor memory every 100 requests (rough estimate)
  if (Math.random() < 0.01) {
    const memoryStatus = MemoryMonitor.checkMemoryUsage();

    if (memoryStatus.status === 'critical') {
      // Force garbage collection if available
      MemoryMonitor.forceGarbageCollection();
    }
  }

  next();
};

// Circuit breaker pattern for external services
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime?: number;
  private state: 'closed' | 'open' | 'half_open' = 'closed';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeout: number = 60000, // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half_open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    return (
      this.lastFailureTime !== undefined && Date.now() - this.lastFailureTime >= this.resetTimeout
    );
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';

      logger.warn('Circuit breaker opened', {
        failure_count: this.failureCount,
        threshold: this.failureThreshold,
      });

      metricsCollector.recordMetric('circuit_breaker_opened', 1, 'count');
    }
  }

  getState(): 'closed' | 'open' | 'half_open' {
    return this.state;
  }
}
