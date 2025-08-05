import { Request, Response, NextFunction } from 'express';
import { AuditService, AuditEventType, AuditSeverity } from '../services/audit.service';
import { StructuredLogger } from '../utils/structured-logger';

const auditService = AuditService.getInstance();
const logger = new StructuredLogger();

export interface AuditableRequest extends Request {
  startTime?: number;
  auditContext?: {
    resource?: string;
    action?: string;
    resourceId?: string;
    sensitiveData?: boolean;
  };
}

// Audit middleware for all requests
export const auditLogging = (req: AuditableRequest, res: Response, next: NextFunction): void => {
  req.startTime = Date.now();

  // Capture original end method to log when response is sent
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any): Response {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    const outcome = res.statusCode >= 200 && res.statusCode < 400 ? 'success' : 'failure';

    // Determine event type based on method and outcome
    let eventType: AuditEventType;
    if (req.method === 'GET') {
      eventType = AuditEventType.DATA_READ;
    } else if (req.method === 'POST') {
      eventType = AuditEventType.DATA_CREATE;
    } else if (req.method === 'PUT' || req.method === 'PATCH') {
      eventType = AuditEventType.DATA_UPDATE;
    } else if (req.method === 'DELETE') {
      eventType = AuditEventType.DATA_DELETE;
    } else {
      eventType = AuditEventType.DATA_READ; // Default
    }

    // Determine severity based on status code and context
    let severity: AuditSeverity;
    if (res.statusCode >= 500) {
      severity = AuditSeverity.ERROR;
    } else if (res.statusCode >= 400) {
      severity = AuditSeverity.WARNING;
    } else if (req.auditContext?.sensitiveData) {
      severity = AuditSeverity.WARNING; // Sensitive data access
    } else {
      severity = AuditSeverity.INFO;
    }

    // Log the audit event
    auditService
      .logEvent({
        eventType,
        severity,
        userId: req.user?.id,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        sessionId: req.context?.sessionId,
        requestId: req.context?.requestId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        resource: req.auditContext?.resource || req.route?.path || req.path,
        resourceId: req.auditContext?.resourceId || req.params?.id,
        action: req.auditContext?.action || req.method,
        outcome,
        details: {
          method: req.method,
          path: req.path,
          query: req.query,
          statusCode: res.statusCode,
          contentLength: res.get('content-length'),
        },
        metadata: {
          duration,
          dataSize: chunk ? Buffer.byteLength(chunk) : 0,
        },
        traceId: req.context?.traceId,
      })
      .catch((error) => {
        logger.error('Failed to log audit event', error as Error, { path: req.path });
      });

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Middleware to mark sensitive data access
export const sensitiveDataAccess = (resource: string) => {
  return (req: AuditableRequest, _res: Response, next: NextFunction): void => {
    req.auditContext = {
      ...req.auditContext,
      resource,
      sensitiveData: true,
    };
    next();
  };
};

// Middleware for authentication events
export const auditAuthentication = (req: Request, res: Response, next: NextFunction): void => {
  const originalJson = res.json;

  res.json = function (data: any) {
    const isLoginEndpoint = req.path.includes('login') || req.path.includes('auth');
    const isSuccess = res.statusCode >= 200 && res.statusCode < 300;

    if (isLoginEndpoint) {
      const eventType = isSuccess ? AuditEventType.LOGIN_SUCCESS : AuditEventType.LOGIN_FAILURE;
      const severity = isSuccess ? AuditSeverity.INFO : AuditSeverity.WARNING;

      auditService
        .logEvent({
          eventType,
          severity,
          userId: req.user?.id || (isSuccess ? data?.user?.id : undefined),
          userEmail: req.user?.email || (isSuccess ? data?.user?.email : undefined),
          userRole: req.user?.role || (isSuccess ? data?.user?.role : undefined),
          sessionId: req.context?.sessionId,
          requestId: req.context?.requestId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          resource: 'authentication',
          action: 'login',
          outcome: isSuccess ? 'success' : 'failure',
          details: {
            endpoint: req.path,
            method: req.method,
            statusCode: res.statusCode,
            failureReason: !isSuccess ? data?.error : undefined,
          },
          traceId: req.context?.traceId,
        })
        .catch((error) => {
          logger.error('Failed to log authentication audit event', error as Error);
        });
    }

    return originalJson.call(this, data);
  };

  next();
};

// Middleware for authorization failures
export const auditAuthorization = (req: Request, res: Response, next: NextFunction): void => {
  const originalStatus = res.status;

  res.status = function (code: number) {
    if (code === 403) {
      auditService
        .logEvent({
          eventType: AuditEventType.UNAUTHORIZED_ACCESS,
          severity: AuditSeverity.WARNING,
          userId: req.user?.id,
          userEmail: req.user?.email,
          userRole: req.user?.role,
          sessionId: req.context?.sessionId,
          requestId: req.context?.requestId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          resource: req.route?.path || req.path,
          resourceId: req.params?.id,
          action: req.method,
          outcome: 'denied',
          details: {
            requiredRole: req.route?.meta?.requiredRole,
            userRole: req.user?.role,
            path: req.path,
            method: req.method,
          },
          traceId: req.context?.traceId,
        })
        .catch((error) => {
          logger.error('Failed to log authorization audit event', error as Error);
        });
    }

    return originalStatus.call(this, code);
  };

  next();
};

// Middleware for bulk operations
export const auditBulkOperation = (operationType: string) => {
  return (req: AuditableRequest, res: Response, next: NextFunction): void => {
    req.auditContext = {
      ...req.auditContext,
      resource: 'bulk_operation',
      action: operationType,
    };

    const originalJson = res.json;
    res.json = function (data: any) {
      const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
      const recordsAffected = data?.recordsAffected || data?.count || data?.length || 0;

      auditService
        .logEvent({
          eventType: AuditEventType.BULK_OPERATION,
          severity: recordsAffected > 100 ? AuditSeverity.WARNING : AuditSeverity.INFO,
          userId: req.user?.id,
          userEmail: req.user?.email,
          userRole: req.user?.role,
          sessionId: req.context?.sessionId,
          requestId: req.context?.requestId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          resource: 'bulk_operation',
          action: operationType,
          outcome: isSuccess ? 'success' : 'failure',
          details: {
            operationType,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
          },
          metadata: {
            recordsAffected,
            duration: req.startTime ? Date.now() - req.startTime : 0,
          },
          traceId: req.context?.traceId,
        })
        .catch((error) => {
          logger.error('Failed to log bulk operation audit event', error as Error);
        });

      return originalJson.call(this, data);
    };

    next();
  };
};

// Middleware for data export operations
export const auditDataExport = (req: AuditableRequest, res: Response, next: NextFunction): void => {
  req.auditContext = {
    ...req.auditContext,
    resource: 'data_export',
    action: 'export',
    sensitiveData: true,
  };

  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any): Response {
    const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
    const dataSize = chunk ? Buffer.byteLength(chunk) : 0;

    auditService
      .logEvent({
        eventType: AuditEventType.REPORT_EXPORTED,
        severity: dataSize > 1024 * 1024 ? AuditSeverity.WARNING : AuditSeverity.INFO, // > 1MB
        userId: req.user?.id,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        sessionId: req.context?.sessionId,
        requestId: req.context?.requestId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        resource: 'data_export',
        resourceId: req.params?.id,
        action: 'export',
        outcome: isSuccess ? 'success' : 'failure',
        details: {
          exportFormat: req.query?.format || 'unknown',
          filters: req.query,
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
        },
        metadata: {
          dataSize,
          duration: req.startTime ? Date.now() - req.startTime : 0,
        },
        traceId: req.context?.traceId,
      })
      .catch((error) => {
        logger.error('Failed to log data export audit event', error as Error);
      });

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Middleware for security violations
export const auditSecurityViolation = (
  violationType: string,
  details?: Record<string, unknown>,
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    auditService
      .logEvent({
        eventType: AuditEventType.SECURITY_VIOLATION,
        severity: AuditSeverity.CRITICAL,
        userId: req.user?.id,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        sessionId: req.context?.sessionId,
        requestId: req.context?.requestId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        resource: req.route?.path || req.path,
        resourceId: req.params?.id,
        action: violationType,
        outcome: 'denied',
        details: {
          violationType,
          path: req.path,
          method: req.method,
          body: req.body,
          query: req.query,
          headers: req.headers,
          ...details,
        },
        traceId: req.context?.traceId,
      })
      .catch((error) => {
        logger.error('Failed to log security violation audit event', error as Error);
      });

    next();
  };
};

// Middleware for system errors
export const auditSystemError = (
  error: Error,
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  auditService
    .logEvent({
      eventType: AuditEventType.SYSTEM_ERROR,
      severity: AuditSeverity.ERROR,
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      sessionId: req.context?.sessionId,
      requestId: req.context?.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      resource: req.route?.path || req.path,
      resourceId: req.params?.id,
      action: req.method,
      outcome: 'failure',
      details: {
        path: req.path,
        method: req.method,
        body: req.body,
        query: req.query,
      },
      metadata: {
        errorCode: (error as any).code,
        errorMessage: error.message,
        stackTrace: error.stack,
      },
      traceId: req.context?.traceId,
    })
    .catch((auditError) => {
      logger.error('Failed to log system error audit event', auditError as Error, {
        originalError: error,
      });
    });

  next(error);
};

// Rate limiting audit
export const auditRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  const originalStatus = res.status;

  res.status = function (code: number) {
    if (code === 429) {
      // Too Many Requests
      auditService
        .logEvent({
          eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
          severity: AuditSeverity.WARNING,
          userId: req.user?.id,
          userEmail: req.user?.email,
          sessionId: req.context?.sessionId,
          requestId: req.context?.requestId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          resource: req.route?.path || req.path,
          action: req.method,
          outcome: 'denied',
          details: {
            path: req.path,
            method: req.method,
            rateLimitHeaders: {
              limit: res.get('X-RateLimit-Limit'),
              remaining: res.get('X-RateLimit-Remaining'),
              reset: res.get('X-RateLimit-Reset'),
            },
          },
          traceId: req.context?.traceId,
        })
        .catch((error) => {
          logger.error('Failed to log rate limit audit event', error as Error);
        });
    }

    return originalStatus.call(this, code);
  };

  next();
};
