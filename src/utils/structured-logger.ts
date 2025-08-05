import { ILogger, ILogContext } from '../interfaces/logger.interface';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  traceId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: string;
  error?: Error;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
  service: string;
  version: string;
  environment: string;
}

export class StructuredLogger implements ILogger {
  private readonly service: string;
  private readonly version: string;
  private readonly environment: string;
  private readonly logLevel: LogLevel;

  constructor(
    service: string = 'bug-bounty-api',
    version: string = '1.0.0',
    environment: string = process.env.NODE_ENV || 'development',
  ) {
    this.service = service;
    this.version = version;
    this.environment = environment;
    this.logLevel = this.parseLogLevel(process.env.LOG_LEVEL || 'info');
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'error':
        return LogLevel.ERROR;
      case 'warn':
        return LogLevel.WARN;
      case 'info':
        return LogLevel.INFO;
      case 'debug':
        return LogLevel.DEBUG;
      default:
        return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private createLogEntry(level: string, message: string, context?: LogContext): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.sanitizeContext(context),
      service: this.service,
      version: this.version,
      environment: this.environment,
    };
  }

  private sanitizeContext(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;

    const sanitized = { ...context };

    // Remove sensitive information
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    Object.keys(sanitized).forEach((key) => {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    // Serialize error objects
    if (sanitized.error instanceof Error) {
      sanitized.error = {
        name: sanitized.error.name,
        message: sanitized.error.message,
        stack: sanitized.error.stack,
      } as any;
    }

    return sanitized;
  }

  private write(logEntry: LogEntry): void {
    const output = JSON.stringify(logEntry);

    if (this.environment === 'development') {
      // Pretty print for development
      console.log(`[${logEntry.timestamp}] ${logEntry.level.toUpperCase()}: ${logEntry.message}`);
      if (logEntry.context) {
        console.log('Context:', JSON.stringify(logEntry.context, null, 2));
      }
    } else {
      // Structured JSON for production
      console.log(output);
    }
  }

  error(message: string, error?: Error, context?: ILogContext): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const logContext = error ? { error: error.message, stack: error.stack, ...context } : context;
    const logEntry = this.createLogEntry('error', message, logContext);
    this.write(logEntry);
  }

  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const logEntry = this.createLogEntry('warn', message, context);
    this.write(logEntry);
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const logEntry = this.createLogEntry('info', message, context);
    this.write(logEntry);
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const logEntry = this.createLogEntry('debug', message, context);
    this.write(logEntry);
  }

  // Convenience methods for common logging scenarios
  httpRequest(req: any, res: any, duration: number): void {
    this.info('HTTP Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id,
      requestId: req.context?.requestId,
    });
  }

  httpError(req: any, error: Error, statusCode: number): void {
    this.error('HTTP Error', error, {
      method: req.method,
      path: req.path,
      statusCode,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id,
      requestId: req.context?.requestId,
    });
  }

  databaseQuery(operation: string, table: string, duration: number, context?: LogContext): void {
    this.debug('Database Query', {
      operation,
      table,
      duration: `${duration}ms`,
      ...context,
    });
  }

  businessEvent(event: string, context?: LogContext): void {
    this.info('Business Event', {
      event,
      ...context,
    });
  }

  securityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context?: LogContext,
  ): void {
    this.warn('Security Event', {
      event,
      severity,
      ...context,
    });
  }

  performanceMetric(metric: string, value: number, unit: string, context?: LogContext): void {
    this.info('Performance Metric', {
      metric,
      value,
      unit,
      ...context,
    });
  }
}
