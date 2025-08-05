import { Request, Response, NextFunction } from 'express';
import { ErrorMonitoringService } from '../services/error-monitoring.service';
import { StructuredLogger } from '../utils/structured-logger';

const errorMonitoringService = ErrorMonitoringService.getInstance();
const logger = new StructuredLogger();

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  statusCode?: number;
}

/**
 * Global error monitoring middleware
 * Captures and categorizes all unhandled errors
 */
export const errorMonitoringMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Extract context information
  const context: ErrorContext = {
    userId: req.user?.id,
    requestId: req.context?.requestId,
    sessionId: req.context?.sessionId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    path: req.path,
    method: req.method,
    statusCode: res.statusCode,
  };

  // Extract metadata
  const metadata = {
    body: req.body,
    query: req.query,
    params: req.params,
    headers: {
      'content-type': req.get('content-type'),
      accept: req.get('accept'),
      origin: req.get('origin'),
      referer: req.get('referer'),
    },
    timestamp: new Date().toISOString(),
  };

  // Capture the error asynchronously (don't block the response)
  errorMonitoringService.captureError(error, context, metadata).catch((captureError) => {
    logger.error('Failed to capture error in monitoring middleware', captureError as Error, {
      originalError: error.message,
      path: req.path,
    });
  });

  // Continue with the error handling chain
  next(error);
};

/**
 * Middleware to capture validation errors
 */
export const validationErrorMonitoring = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const originalStatus = res.status;

  res.status = function (code: number) {
    if (code === 400) {
      // This is likely a validation error
      const validationError = new Error('Validation failed');

      const context: ErrorContext = {
        userId: req.user?.id,
        requestId: req.context?.requestId,
        sessionId: req.context?.sessionId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        path: req.path,
        method: req.method,
        statusCode: code,
      };

      const metadata = {
        body: req.body,
        query: req.query,
        validationError: true,
      };

      errorMonitoringService
        .captureError(validationError, context, metadata)
        .catch((captureError) => {
          logger.error('Failed to capture validation error', captureError as Error, {
            path: req.path,
          });
        });
    }

    return originalStatus.call(this, code);
  };

  next();
};

/**
 * Middleware to monitor authentication errors
 */
export const authErrorMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  const originalStatus = res.status;

  res.status = function (code: number) {
    if (code === 401) {
      const authError = new Error('Authentication failed');

      const context: ErrorContext = {
        userId: req.user?.id,
        requestId: req.context?.requestId,
        sessionId: req.context?.sessionId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        path: req.path,
        method: req.method,
        statusCode: code,
      };

      const metadata = {
        authenticationAttempt: true,
        headers: {
          authorization: req.get('authorization') ? 'present' : 'missing',
        },
      };

      errorMonitoringService.captureError(authError, context, metadata).catch((captureError) => {
        logger.error('Failed to capture authentication error', captureError as Error, {
          path: req.path,
        });
      });
    }

    return originalStatus.call(this, code);
  };

  next();
};

/**
 * Middleware to monitor authorization errors
 */
export const authzErrorMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  const originalStatus = res.status;

  res.status = function (code: number) {
    if (code === 403) {
      const authzError = new Error('Access forbidden - insufficient permissions');

      const context: ErrorContext = {
        userId: req.user?.id,
        requestId: req.context?.requestId,
        sessionId: req.context?.sessionId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        path: req.path,
        method: req.method,
        statusCode: code,
      };

      const metadata = {
        authorizationFailure: true,
        userRole: req.user?.role,
        requiredPermissions: req.route?.meta?.requiredRole,
      };

      errorMonitoringService.captureError(authzError, context, metadata).catch((captureError) => {
        logger.error('Failed to capture authorization error', captureError as Error, {
          path: req.path,
        });
      });
    }

    return originalStatus.call(this, code);
  };

  next();
};

/**
 * Middleware to monitor rate limiting errors
 */
export const rateLimitErrorMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  const originalStatus = res.status;

  res.status = function (code: number) {
    if (code === 429) {
      const rateLimitError = new Error('Rate limit exceeded');

      const context: ErrorContext = {
        userId: req.user?.id,
        requestId: req.context?.requestId,
        sessionId: req.context?.sessionId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        path: req.path,
        method: req.method,
        statusCode: code,
      };

      const metadata = {
        rateLimitExceeded: true,
        rateLimitHeaders: {
          limit: res.get('X-RateLimit-Limit'),
          remaining: res.get('X-RateLimit-Remaining'),
          reset: res.get('X-RateLimit-Reset'),
        },
      };

      errorMonitoringService
        .captureError(rateLimitError, context, metadata)
        .catch((captureError) => {
          logger.error('Failed to capture rate limit error', captureError as Error, {
            path: req.path,
          });
        });
    }

    return originalStatus.call(this, code);
  };

  next();
};

/**
 * Middleware to monitor database connection errors
 */
export const databaseErrorMonitoring = (error: Error): void => {
  // Check if this is a database-related error
  const dbErrorKeywords = ['database', 'connection', 'query', 'sql', 'deadlock', 'constraint'];
  const isDbError = dbErrorKeywords.some(
    (keyword) =>
      error.message.toLowerCase().includes(keyword) || error.stack?.toLowerCase().includes(keyword),
  );

  if (isDbError) {
    const dbError = new Error(`Database error: ${error.message}`);
    dbError.stack = error.stack;

    const metadata = {
      originalError: error.message,
      databaseError: true,
    };

    errorMonitoringService.captureError(dbError, {}, metadata).catch((captureError) => {
      logger.error('Failed to capture database error', captureError as Error, {
        originalError: error.message,
      });
    });
  }
};

/**
 * Middleware to monitor external service errors
 */
export const externalServiceErrorMonitoring = (serviceName: string) => {
  return (error: Error): void => {
    const serviceError = new Error(`External service error (${serviceName}): ${error.message}`);
    serviceError.stack = error.stack;

    const metadata = {
      serviceName,
      originalError: error.message,
      externalServiceError: true,
    };

    errorMonitoringService.captureError(serviceError, {}, metadata).catch((captureError) => {
      logger.error('Failed to capture external service error', captureError as Error, {
        serviceName,
        originalError: error.message,
      });
    });
  };
};

/**
 * Middleware to monitor timeout errors
 */
export const timeoutErrorMonitoring = (operation: string, timeout: number) => {
  return (error: Error): void => {
    if (error.message.toLowerCase().includes('timeout')) {
      const timeoutError = new Error(`Timeout error in ${operation}: ${error.message}`);
      timeoutError.stack = error.stack;

      const metadata = {
        operation,
        timeoutDuration: timeout,
        originalError: error.message,
        timeoutError: true,
      };

      errorMonitoringService.captureError(timeoutError, {}, metadata).catch((captureError) => {
        logger.error('Failed to capture timeout error', captureError as Error, {
          operation,
          originalError: error.message,
        });
      });
    }
  };
};

/**
 * Middleware to capture async errors in route handlers
 */
export const asyncErrorMonitoring = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch((error: Error) => {
      const context: ErrorContext = {
        userId: req.user?.id,
        requestId: req.context?.requestId,
        sessionId: req.context?.sessionId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        path: req.path,
        method: req.method,
      };

      const metadata = {
        asyncError: true,
        handlerName: fn.name || 'anonymous',
      };

      errorMonitoringService.captureError(error, context, metadata).catch((captureError) => {
        logger.error('Failed to capture async error', captureError as Error, {
          originalError: error.message,
          path: req.path,
        });
      });

      next(error);
    });
  };
};

/**
 * Process-level error monitoring
 */
export const setupProcessErrorMonitoring = (): void => {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', error);

    errorMonitoringService
      .captureError(
        error,
        {},
        {
          uncaughtException: true,
          processEvent: true,
        },
      )
      .catch((captureError) => {
        console.error('Failed to capture uncaught exception:', captureError);
      })
      .finally(() => {
        // Exit process after logging
        process.exit(1);
      });
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error('Unhandled Promise Rejection', error, { promise });

    errorMonitoringService
      .captureError(
        error,
        {},
        {
          unhandledRejection: true,
          processEvent: true,
          reason: String(reason),
        },
      )
      .catch((captureError) => {
        console.error('Failed to capture unhandled rejection:', captureError);
      });
  });

  // Handle warnings
  process.on('warning', (warning: Error) => {
    if (warning.name === 'DeprecationWarning' || warning.name === 'ExperimentalWarning') {
      // Log but don't capture these as errors
      logger.warn('Process Warning', { warning: warning.message, name: warning.name });
    } else {
      errorMonitoringService
        .captureError(
          warning,
          {},
          {
            processWarning: true,
            warningName: warning.name,
          },
        )
        .catch((captureError) => {
          console.error('Failed to capture process warning:', captureError);
        });
    }
  });
};
