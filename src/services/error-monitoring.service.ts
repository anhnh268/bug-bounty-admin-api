import { StructuredLogger } from '../utils/structured-logger';
import { MetricsCollector } from '../monitoring/metrics';
import { CacheService } from './cache.service';
import { AuditService, AuditEventType, AuditSeverity } from './audit.service';

export enum ErrorCategory {
  // Input/Validation Errors
  VALIDATION_ERROR = 'validation_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  AUTHORIZATION_ERROR = 'authorization_error',

  // Business Logic Errors
  BUSINESS_LOGIC_ERROR = 'business_logic_error',
  RESOURCE_NOT_FOUND = 'resource_not_found',
  CONFLICT_ERROR = 'conflict_error',

  // System Errors
  DATABASE_ERROR = 'database_error',
  EXTERNAL_SERVICE_ERROR = 'external_service_error',
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',

  // Security Errors
  RATE_LIMIT_ERROR = 'rate_limit_error',
  SECURITY_VIOLATION = 'security_violation',

  // Infrastructure Errors
  MEMORY_ERROR = 'memory_error',
  DISK_ERROR = 'disk_error',
  CPU_ERROR = 'cpu_error',

  // Unknown/Uncategorized
  UNKNOWN_ERROR = 'unknown_error',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorPattern {
  pattern: RegExp;
  category: ErrorCategory;
  severity: ErrorSeverity;
  tags: string[];
  description: string;
}

export interface CategorizedError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  context: {
    userId?: string;
    requestId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    path?: string;
    method?: string;
    statusCode?: number;
  };
  tags: string[];
  metadata: Record<string, unknown>;
  timestamp: Date;
  occurenceCount: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  resolved: boolean;
  fingerprint: string; // Hash for grouping similar errors
}

export interface ErrorSummary {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recentErrors: CategorizedError[];
  topErrors: Array<{
    fingerprint: string;
    category: ErrorCategory;
    message: string;
    count: number;
    lastOccurrence: Date;
  }>;
  criticalErrors: CategorizedError[];
  trendData: {
    hourly: number[];
    daily: number[];
  };
}

export interface ErrorAlert {
  id: string;
  errorFingerprint: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  threshold: number;
  currentCount: number;
  timeWindow: number; // minutes
  alertSent: boolean;
  createdAt: Date;
}

export class ErrorMonitoringService {
  private static instance: ErrorMonitoringService;
  private logger = new StructuredLogger();
  private metricsCollector = MetricsCollector.getInstance();
  private cacheService = CacheService.getInstance();
  private auditService = AuditService.getInstance();

  private errorStore: Map<string, CategorizedError> = new Map();
  // private alertRules: Map<string, ErrorAlert> = new Map(); // Reserved for future alert functionality
  private readonly maxStoredErrors = 5000;
  private readonly cachePrefix = 'error_monitoring';

  // Error classification patterns
  private readonly errorPatterns: ErrorPattern[] = [
    // Validation Errors
    {
      pattern: /validation|invalid|required|missing|malformed|format/i,
      category: ErrorCategory.VALIDATION_ERROR,
      severity: ErrorSeverity.LOW,
      tags: ['validation', 'user_input'],
      description: 'Input validation failure',
    },

    // Authentication Errors
    {
      pattern: /unauthorized|authentication|token|login|credential/i,
      category: ErrorCategory.AUTHENTICATION_ERROR,
      severity: ErrorSeverity.MEDIUM,
      tags: ['auth', 'security'],
      description: 'Authentication failure',
    },

    // Authorization Errors
    {
      pattern: /forbidden|permission|access denied|role/i,
      category: ErrorCategory.AUTHORIZATION_ERROR,
      severity: ErrorSeverity.MEDIUM,
      tags: ['auth', 'security'],
      description: 'Authorization failure',
    },

    // Database Errors
    {
      pattern: /database|sql|connection|query|deadlock|constraint/i,
      category: ErrorCategory.DATABASE_ERROR,
      severity: ErrorSeverity.HIGH,
      tags: ['database', 'infrastructure'],
      description: 'Database operation failure',
    },

    // Network/External Service Errors
    {
      pattern: /network|connection refused|timeout|unreachable|dns/i,
      category: ErrorCategory.NETWORK_ERROR,
      severity: ErrorSeverity.HIGH,
      tags: ['network', 'external'],
      description: 'Network connectivity issue',
    },

    // Memory Errors
    {
      pattern: /memory|heap|out of memory|allocation/i,
      category: ErrorCategory.MEMORY_ERROR,
      severity: ErrorSeverity.CRITICAL,
      tags: ['memory', 'performance'],
      description: 'Memory allocation failure',
    },

    // Rate Limiting
    {
      pattern: /rate limit|too many requests|throttle/i,
      category: ErrorCategory.RATE_LIMIT_ERROR,
      severity: ErrorSeverity.MEDIUM,
      tags: ['rate_limit', 'security'],
      description: 'Rate limit exceeded',
    },

    // Security Violations
    {
      pattern: /security|attack|malicious|injection|xss|csrf/i,
      category: ErrorCategory.SECURITY_VIOLATION,
      severity: ErrorSeverity.CRITICAL,
      tags: ['security', 'attack'],
      description: 'Security violation detected',
    },
  ];

  private constructor() {
    // Set up cleanup interval
    setInterval(() => {
      this.cleanupOldErrors();
    }, 3600000); // Every hour

    // Set up alert checking
    setInterval(() => {
      this.checkAlertRules();
    }, 60000); // Every minute
  }

  static getInstance(): ErrorMonitoringService {
    if (!ErrorMonitoringService.instance) {
      ErrorMonitoringService.instance = new ErrorMonitoringService();
    }
    return ErrorMonitoringService.instance;
  }

  async captureError(
    error: Error,
    context: CategorizedError['context'] = {},
    metadata: Record<string, unknown> = {},
  ): Promise<string> {
    try {
      const fingerprint = this.generateFingerprint(error);
      const category = this.categorizeError(error);
      const severity = this.determineSeverity(error, category);
      const tags = this.extractTags(error, category);

      let existingError = this.errorStore.get(fingerprint);

      if (existingError) {
        // Update existing error
        existingError.occurenceCount++;
        existingError.lastOccurrence = new Date();
        existingError.context = { ...existingError.context, ...context };
        existingError.metadata = { ...existingError.metadata, ...metadata };
      } else {
        // Create new error entry
        const categorizedError: CategorizedError = {
          id: this.generateErrorId(),
          category,
          severity,
          message: error.message,
          stack: error.stack,
          context,
          tags,
          metadata,
          timestamp: new Date(),
          occurenceCount: 1,
          firstOccurrence: new Date(),
          lastOccurrence: new Date(),
          resolved: false,
          fingerprint,
        };

        this.errorStore.set(fingerprint, categorizedError);
        existingError = categorizedError;
      }

      // Log the error
      const logLevel = this.severityToLogLevel(severity);
      if (logLevel === 'error') {
        this.logger.error(`Error captured: ${category}`, error, {
          errorId: existingError.id,
          fingerprint,
          category,
          severity,
          context,
          metadata,
          occurenceCount: existingError.occurenceCount,
        });
      } else if (logLevel === 'warn') {
        this.logger.warn(`Error captured: ${category}`, {
          errorId: existingError.id,
          fingerprint,
          category,
          severity,
          message: error.message,
          stack: error.stack,
          context,
          metadata,
          occurenceCount: existingError.occurenceCount,
        });
      } else {
        this.logger.info(`Error captured: ${category}`, {
          errorId: existingError.id,
          fingerprint,
          category,
          severity,
          message: error.message,
          stack: error.stack,
          context,
          metadata,
          occurenceCount: existingError.occurenceCount,
        });
      }

      // Record metrics
      this.metricsCollector.recordMetric('errors_total', 1, 'count', {
        category,
        severity,
        fingerprint,
      });

      // Cache for quick access
      await this.cacheRecentError(existingError);

      // Log audit event for critical errors
      if (severity === ErrorSeverity.CRITICAL) {
        await this.auditService.logEvent({
          eventType: AuditEventType.SYSTEM_ERROR,
          severity: AuditSeverity.CRITICAL,
          userId: context.userId,
          sessionId: context.sessionId,
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          resource: context.path,
          action: context.method || 'unknown',
          outcome: 'failure',
          details: {
            errorCategory: category,
            errorMessage: error.message,
            fingerprint,
            occurenceCount: existingError.occurenceCount,
          },
          metadata: {
            stackTrace: error.stack,
          },
        });
      }

      // Trim error store if needed
      if (this.errorStore.size > this.maxStoredErrors) {
        this.trimErrorStore();
      }

      return existingError.id;
    } catch (captureError) {
      this.logger.error('Failed to capture error', captureError as Error, {
        originalError: error.message,
      });

      return 'error-capture-failed';
    }
  }

  async getErrorSummary(timeRange?: { start: Date; end: Date }): Promise<ErrorSummary> {
    const cacheKey = `summary:${timeRange?.start?.getTime() || 'all'}:${timeRange?.end?.getTime() || 'all'}`;

    // Try to get from cache
    const cached = await this.cacheService.get<ErrorSummary>(cacheKey, {
      prefix: this.cachePrefix,
      ttl: 300, // 5 minutes
    });

    if (cached) {
      return cached;
    }

    try {
      let errors = Array.from(this.errorStore.values());

      // Apply time range filter
      if (timeRange) {
        errors = errors.filter(
          (error) => error.timestamp >= timeRange.start && error.timestamp <= timeRange.end,
        );
      }

      const summary: ErrorSummary = {
        totalErrors: errors.reduce((sum, error) => sum + error.occurenceCount, 0),
        errorsByCategory: {} as Record<ErrorCategory, number>,
        errorsBySeverity: {} as Record<ErrorSeverity, number>,
        recentErrors: [],
        topErrors: [],
        criticalErrors: [],
        trendData: {
          hourly: new Array(24).fill(0),
          daily: new Array(7).fill(0),
        },
      };

      // Initialize counters
      Object.values(ErrorCategory).forEach((category) => {
        summary.errorsByCategory[category] = 0;
      });

      Object.values(ErrorSeverity).forEach((severity) => {
        summary.errorsBySeverity[severity] = 0;
      });

      // Count errors
      const errorCounts: Map<string, number> = new Map();

      errors.forEach((error) => {
        summary.errorsByCategory[error.category] += error.occurenceCount;
        summary.errorsBySeverity[error.severity] += error.occurenceCount;

        errorCounts.set(error.fingerprint, error.occurenceCount);

        if (error.severity === ErrorSeverity.CRITICAL) {
          summary.criticalErrors.push(error);
        }
      });

      // Get recent errors (last 100)
      summary.recentErrors = errors
        .sort((a, b) => b.lastOccurrence.getTime() - a.lastOccurrence.getTime())
        .slice(0, 100);

      // Get top errors by occurrence count
      summary.topErrors = Array.from(errorCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20)
        .map(([fingerprint, count]) => {
          const error = this.errorStore.get(fingerprint)!;
          return {
            fingerprint,
            category: error.category,
            message: error.message,
            count,
            lastOccurrence: error.lastOccurrence,
          };
        });

      // Generate trend data (simplified)
      this.generateTrendData(errors, summary.trendData);

      // Cache the summary
      await this.cacheService.set(cacheKey, summary, {
        prefix: this.cachePrefix,
        ttl: 300,
      });

      return summary;
    } catch (error) {
      this.logger.error('Failed to generate error summary', error as Error, {
        timeRange,
      });

      // Return empty summary on error
      return {
        totalErrors: 0,
        errorsByCategory: {} as Record<ErrorCategory, number>,
        errorsBySeverity: {} as Record<ErrorSeverity, number>,
        recentErrors: [],
        topErrors: [],
        criticalErrors: [],
        trendData: { hourly: new Array(24).fill(0), daily: new Array(7).fill(0) },
      };
    }
  }

  async resolveError(fingerprint: string, userId?: string): Promise<boolean> {
    const error = this.errorStore.get(fingerprint);

    if (!error) {
      return false;
    }

    error.resolved = true;

    // Log resolution
    this.logger.info('Error resolved', {
      fingerprint,
      errorId: error.id,
      category: error.category,
      resolvedBy: userId,
    });

    // Record metric
    this.metricsCollector.recordMetric('errors_resolved_total', 1, 'count', {
      category: error.category,
      severity: error.severity,
    });

    return true;
  }

  getErrorById(errorId: string): CategorizedError | undefined {
    return Array.from(this.errorStore.values()).find((error) => error.id === errorId);
  }

  getErrorByFingerprint(fingerprint: string): CategorizedError | undefined {
    return this.errorStore.get(fingerprint);
  }

  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';
    const fullText = `${message} ${stack}`;

    for (const pattern of this.errorPatterns) {
      if (pattern.pattern.test(fullText)) {
        return pattern.category;
      }
    }

    return ErrorCategory.UNKNOWN_ERROR;
  }

  private determineSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
    // Check for specific error patterns that indicate severity
    const message = error.message.toLowerCase();

    if (message.includes('critical') || message.includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    }

    // Category-based severity
    switch (category) {
      case ErrorCategory.MEMORY_ERROR:
      case ErrorCategory.SECURITY_VIOLATION:
        return ErrorSeverity.CRITICAL;

      case ErrorCategory.DATABASE_ERROR:
      case ErrorCategory.NETWORK_ERROR:
        return ErrorSeverity.HIGH;

      case ErrorCategory.AUTHENTICATION_ERROR:
      case ErrorCategory.AUTHORIZATION_ERROR:
      case ErrorCategory.RATE_LIMIT_ERROR:
        return ErrorSeverity.MEDIUM;

      case ErrorCategory.VALIDATION_ERROR:
        return ErrorSeverity.LOW;

      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  private extractTags(error: Error, category: ErrorCategory): string[] {
    const tags: string[] = [];
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // Find matching pattern to get tags
    for (const pattern of this.errorPatterns) {
      if (pattern.category === category) {
        tags.push(...pattern.tags);
        break;
      }
    }

    // Add additional contextual tags
    if (message.includes('timeout')) tags.push('timeout');
    if (message.includes('connection')) tags.push('connection');
    if (stack.includes('async')) tags.push('async');
    if (stack.includes('promise')) tags.push('promise');

    return Array.from(new Set(tags)); // Remove duplicates
  }

  private generateFingerprint(error: Error): string {
    // Create a hash based on error message and stack trace location
    const message = error.message;
    const stack = error.stack || '';

    // Extract the first few lines of stack trace for fingerprinting
    const stackLines = stack.split('\n').slice(0, 3).join('\n');
    const fingerprint = `${message}:${stackLines}`;

    // Simple hash function (in production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private severityToLogLevel(severity: ErrorSeverity): 'info' | 'warn' | 'error' {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'info';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return 'error';
      default:
        return 'error';
    }
  }

  private async cacheRecentError(error: CategorizedError): Promise<void> {
    const recentKey = `recent:${error.category}:${Date.now()}`;
    await this.cacheService.set(recentKey, error, {
      prefix: this.cachePrefix,
      ttl: 3600, // 1 hour
    });
  }

  private trimErrorStore(): void {
    // Remove oldest errors when store gets too large
    const errors = Array.from(this.errorStore.entries()).sort(
      ([, a], [, b]) => b.lastOccurrence.getTime() - a.lastOccurrence.getTime(),
    );

    // Keep most recent 80% of max size
    const keepCount = Math.floor(this.maxStoredErrors * 0.8);
    const toKeep = errors.slice(0, keepCount);

    this.errorStore.clear();
    toKeep.forEach(([fingerprint, error]) => {
      this.errorStore.set(fingerprint, error);
    });

    this.logger.info('Trimmed error store', {
      originalSize: errors.length,
      newSize: this.errorStore.size,
    });
  }

  private cleanupOldErrors(): void {
    // Remove resolved errors older than 7 days
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [fingerprint, error] of Array.from(this.errorStore.entries())) {
      if (error.resolved && error.lastOccurrence < cutoffTime) {
        this.errorStore.delete(fingerprint);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info(`Cleaned up ${cleanedCount} old resolved errors`);
    }
  }

  private checkAlertRules(): void {
    // Check if any error patterns exceed alert thresholds
    // This is a simplified implementation - in production you'd have more sophisticated alerting
    for (const [fingerprint, error] of Array.from(this.errorStore.entries())) {
      if (error.severity === ErrorSeverity.CRITICAL && error.occurenceCount >= 5) {
        this.logger.error('Critical error threshold exceeded', new Error('Critical error threshold exceeded'), {
          fingerprint,
          errorId: error.id,
          category: error.category,
          count: error.occurenceCount,
        });
      }
    }
  }

  private generateTrendData(
    errors: CategorizedError[],
    trendData: { hourly: number[]; daily: number[] },
  ): void {
    const now = new Date();

    // Generate hourly trend (last 24 hours)
    for (let i = 0; i < 24; i++) {
      const hourStart = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000);
      const hourEnd = new Date(now.getTime() - i * 60 * 60 * 1000);

      const hourlyCount = errors
        .filter((error) => error.timestamp >= hourStart && error.timestamp < hourEnd)
        .reduce((sum, error) => sum + error.occurenceCount, 0);

      trendData.hourly[23 - i] = hourlyCount;
    }

    // Generate daily trend (last 7 days)
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);

      const dailyCount = errors
        .filter((error) => error.timestamp >= dayStart && error.timestamp < dayEnd)
        .reduce((sum, error) => sum + error.occurenceCount, 0);

      trendData.daily[6 - i] = dailyCount;
    }
  }

  // Health check
  getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    errorCount: number;
    criticalErrorCount: number;
    recentErrorRate: number;
  } {
    const errorCount = this.errorStore.size;
    const criticalErrors = Array.from(this.errorStore.values()).filter(
      (error) => error.severity === ErrorSeverity.CRITICAL && !error.resolved,
    );

    // Calculate recent error rate (errors in last hour)
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentErrors = Array.from(this.errorStore.values())
      .filter((error) => error.lastOccurrence >= hourAgo)
      .reduce((sum, error) => sum + error.occurenceCount, 0);

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (criticalErrors.length > 0 || recentErrors > 100) {
      status = 'degraded';
    }

    if (criticalErrors.length > 5 || recentErrors > 500) {
      status = 'unhealthy';
    }

    return {
      status,
      errorCount,
      criticalErrorCount: criticalErrors.length,
      recentErrorRate: recentErrors,
    };
  }
}
