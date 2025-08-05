import { StructuredLogger } from '../utils/structured-logger';
import { MetricsCollector } from '../monitoring/metrics';
import { CacheService } from './cache.service';

export enum AuditEventType {
  // Authentication events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  TOKEN_REFRESH = 'token_refresh',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',

  // Data access events
  DATA_READ = 'data_read',
  DATA_CREATE = 'data_create',
  DATA_UPDATE = 'data_update',
  DATA_DELETE = 'data_delete',
  BULK_OPERATION = 'bulk_operation',

  // Administrative events
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  ROLE_CHANGED = 'role_changed',
  PERMISSION_GRANTED = 'permission_granted',
  PERMISSION_REVOKED = 'permission_revoked',

  // Security events
  SECURITY_VIOLATION = 'security_violation',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  DATA_BREACH_ATTEMPT = 'data_breach_attempt',
  MALICIOUS_PAYLOAD = 'malicious_payload',

  // System events
  SYSTEM_ERROR = 'system_error',
  CONFIGURATION_CHANGE = 'configuration_change',
  BACKUP_CREATED = 'backup_created',
  BACKUP_RESTORED = 'backup_restored',
  MAINTENANCE_MODE = 'maintenance_mode',

  // Report-specific events
  REPORT_SUBMITTED = 'report_submitted',
  REPORT_VIEWED = 'report_viewed',
  REPORT_ASSIGNED = 'report_assigned',
  REPORT_STATUS_CHANGED = 'report_status_changed',
  REPORT_EXPORTED = 'report_exported',
  SENSITIVE_DATA_ACCESS = 'sensitive_data_access',
}

export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface AuditEventData {
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  sessionId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  resourceId?: string;
  action?: string;
  outcome: 'success' | 'failure' | 'denied';
  details?: Record<string, unknown>;
  metadata?: {
    duration?: number;
    dataSize?: number;
    recordsAffected?: number;
    errorCode?: string;
    errorMessage?: string;
    stackTrace?: string;
  };
  timestamp: Date;
  traceId?: string;
}

export interface AuditQuery {
  eventType?: AuditEventType | AuditEventType[];
  severity?: AuditSeverity | AuditSeverity[];
  userId?: string;
  ipAddress?: string;
  resource?: string;
  outcome?: 'success' | 'failure' | 'denied';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsBySeverity: Record<AuditSeverity, number>;
  eventsByOutcome: Record<string, number>;
  topUsers: Array<{ userId: string; eventCount: number }>;
  topIpAddresses: Array<{ ipAddress: string; eventCount: number }>;
  securityIncidents: number;
  timeRange: {
    start: Date;
    end: Date;
  };
}

export class AuditService {
  private static instance: AuditService;
  private logger = new StructuredLogger();
  private metricsCollector = MetricsCollector.getInstance();
  private cacheService = CacheService.getInstance();
  private auditLog: AuditEventData[] = []; // In production, this would be a database
  private readonly maxLogSize = 10000; // Maximum events to keep in memory
  private readonly cachePrefix = 'audit';

  private constructor() {
    // Initialize with cleanup interval
    setInterval(() => {
      this.cleanupOldEvents();
    }, 3600000); // Cleanup every hour
  }

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  async logEvent(eventData: Omit<AuditEventData, 'timestamp'>): Promise<void> {
    const auditEvent: AuditEventData = {
      ...eventData,
      timestamp: new Date(),
    };

    try {
      // Store in memory log (in production, store in database)
      this.auditLog.push(auditEvent);

      // Trim log if it gets too large
      if (this.auditLog.length > this.maxLogSize) {
        this.auditLog = this.auditLog.slice(-Math.floor(this.maxLogSize * 0.8));
      }

      // Log with structured logger
      const logLevel = this.severityToLogLevel(auditEvent.severity);
      const logContext = {
        eventType: auditEvent.eventType,
        severity: auditEvent.severity,
        userId: auditEvent.userId,
        userEmail: auditEvent.userEmail,
        resource: auditEvent.resource,
        resourceId: auditEvent.resourceId,
        action: auditEvent.action,
        outcome: auditEvent.outcome,
        ipAddress: auditEvent.ipAddress,
        userAgent: auditEvent.userAgent,
        details: auditEvent.details,
        metadata: auditEvent.metadata,
        sessionId: auditEvent.sessionId,
        requestId: auditEvent.requestId,
        traceId: auditEvent.traceId,
      };

      if (logLevel === 'error') {
        this.logger.error(`Audit: ${auditEvent.eventType}`, new Error(`Audit: ${auditEvent.eventType}`), logContext);
      } else if (logLevel === 'warn') {
        this.logger.warn(`Audit: ${auditEvent.eventType}`, logContext);
      } else {
        this.logger.info(`Audit: ${auditEvent.eventType}`, logContext);
      }

      // Record metrics
      this.metricsCollector.recordMetric('audit_events_total', 1, 'count', {
        event_type: auditEvent.eventType,
        severity: auditEvent.severity,
        outcome: auditEvent.outcome,
      });

      // Cache recent events for quick access
      await this.cacheRecentEvent(auditEvent);

      // Handle security events specially
      if (this.isSecurityEvent(auditEvent)) {
        await this.handleSecurityEvent(auditEvent);
      }

      // Handle critical events
      if (auditEvent.severity === AuditSeverity.CRITICAL) {
        await this.handleCriticalEvent(auditEvent);
      }
    } catch (error) {
      this.logger.error('Failed to log audit event', error as Error, {
        eventType: auditEvent.eventType,
        userId: auditEvent.userId,
      });

      // Still record the metric for failed audit logging
      this.metricsCollector.recordMetric('audit_errors_total', 1, 'count', {
        error_type: 'audit_logging_failed',
      });
    }
  }

  async queryEvents(query: AuditQuery): Promise<{
    events: AuditEventData[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      // In production, this would query the database
      let filteredEvents = [...this.auditLog];

      // Apply filters
      if (query.eventType) {
        const eventTypes = Array.isArray(query.eventType) ? query.eventType : [query.eventType];
        filteredEvents = filteredEvents.filter((event) => eventTypes.includes(event.eventType));
      }

      if (query.severity) {
        const severities = Array.isArray(query.severity) ? query.severity : [query.severity];
        filteredEvents = filteredEvents.filter((event) => severities.includes(event.severity));
      }

      if (query.userId) {
        filteredEvents = filteredEvents.filter((event) => event.userId === query.userId);
      }

      if (query.ipAddress) {
        filteredEvents = filteredEvents.filter((event) => event.ipAddress === query.ipAddress);
      }

      if (query.resource) {
        filteredEvents = filteredEvents.filter((event) => event.resource === query.resource);
      }

      if (query.outcome) {
        filteredEvents = filteredEvents.filter((event) => event.outcome === query.outcome);
      }

      if (query.startDate) {
        filteredEvents = filteredEvents.filter((event) => event.timestamp >= query.startDate!);
      }

      if (query.endDate) {
        filteredEvents = filteredEvents.filter((event) => event.timestamp <= query.endDate!);
      }

      // Sort by timestamp (most recent first)
      filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const totalCount = filteredEvents.length;
      const offset = query.offset || 0;
      const limit = query.limit || 100;

      const events = filteredEvents.slice(offset, offset + limit);
      const hasMore = offset + limit < totalCount;

      return { events, totalCount, hasMore };
    } catch (error) {
      this.logger.error('Failed to query audit events', error as Error, {
        query,
      });

      return { events: [], totalCount: 0, hasMore: false };
    }
  }

  async getSummary(timeRange?: { start: Date; end: Date }): Promise<AuditSummary> {
    const cacheKey = `summary:${timeRange?.start?.getTime() || 'all'}:${timeRange?.end?.getTime() || 'all'}`;

    // Try to get from cache first
    const cached = await this.cacheService.get<AuditSummary>(cacheKey, {
      prefix: this.cachePrefix,
      ttl: 300, // 5 minutes cache
    });

    if (cached) {
      return cached;
    }

    try {
      let events = [...this.auditLog];

      // Apply time range filter
      if (timeRange) {
        events = events.filter(
          (event) => event.timestamp >= timeRange.start && event.timestamp <= timeRange.end,
        );
      }

      const summary: AuditSummary = {
        totalEvents: events.length,
        eventsByType: {} as Record<AuditEventType, number>,
        eventsBySeverity: {} as Record<AuditSeverity, number>,
        eventsByOutcome: {},
        topUsers: [],
        topIpAddresses: [],
        securityIncidents: 0,
        timeRange: {
          start:
            timeRange?.start || new Date(Math.min(...events.map((e) => e.timestamp.getTime()))),
          end: timeRange?.end || new Date(Math.max(...events.map((e) => e.timestamp.getTime()))),
        },
      };

      // Initialize counters
      Object.values(AuditEventType).forEach((type) => {
        summary.eventsByType[type] = 0;
      });

      Object.values(AuditSeverity).forEach((severity) => {
        summary.eventsBySeverity[severity] = 0;
      });

      const userCounts: Record<string, number> = {};
      const ipCounts: Record<string, number> = {};

      // Count events
      events.forEach((event) => {
        summary.eventsByType[event.eventType]++;
        summary.eventsBySeverity[event.severity]++;
        summary.eventsByOutcome[event.outcome] = (summary.eventsByOutcome[event.outcome] || 0) + 1;

        if (event.userId) {
          userCounts[event.userId] = (userCounts[event.userId] || 0) + 1;
        }

        if (event.ipAddress) {
          ipCounts[event.ipAddress] = (ipCounts[event.ipAddress] || 0) + 1;
        }

        if (this.isSecurityEvent(event)) {
          summary.securityIncidents++;
        }
      });

      // Get top users
      summary.topUsers = Object.entries(userCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([userId, eventCount]) => ({ userId, eventCount }));

      // Get top IP addresses
      summary.topIpAddresses = Object.entries(ipCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([ipAddress, eventCount]) => ({ ipAddress, eventCount }));

      // Cache the summary
      await this.cacheService.set(cacheKey, summary, {
        prefix: this.cachePrefix,
        ttl: 300,
      });

      return summary;
    } catch (error) {
      this.logger.error('Failed to generate audit summary', error as Error, {
        timeRange,
      });

      // Return empty summary on error
      return {
        totalEvents: 0,
        eventsByType: {} as Record<AuditEventType, number>,
        eventsBySeverity: {} as Record<AuditSeverity, number>,
        eventsByOutcome: {},
        topUsers: [],
        topIpAddresses: [],
        securityIncidents: 0,
        timeRange: {
          start: new Date(),
          end: new Date(),
        },
      };
    }
  }

  async getSecurityIncidents(timeRange?: { start: Date; end: Date }): Promise<AuditEventData[]> {
    const query: AuditQuery = {
      eventType: [
        AuditEventType.SECURITY_VIOLATION,
        AuditEventType.SUSPICIOUS_ACTIVITY,
        AuditEventType.DATA_BREACH_ATTEMPT,
        AuditEventType.MALICIOUS_PAYLOAD,
        AuditEventType.UNAUTHORIZED_ACCESS,
      ],
      startDate: timeRange?.start,
      endDate: timeRange?.end,
    };

    const result = await this.queryEvents(query);
    return result.events;
  }

  async getUserActivity(
    userId: string,
    timeRange?: { start: Date; end: Date },
  ): Promise<AuditEventData[]> {
    const query: AuditQuery = {
      userId,
      startDate: timeRange?.start,
      endDate: timeRange?.end,
      limit: 1000,
    };

    const result = await this.queryEvents(query);
    return result.events;
  }

  private severityToLogLevel(severity: AuditSeverity): 'info' | 'warn' | 'error' {
    switch (severity) {
      case AuditSeverity.INFO:
        return 'info';
      case AuditSeverity.WARNING:
        return 'warn';
      case AuditSeverity.ERROR:
      case AuditSeverity.CRITICAL:
        return 'error';
      default:
        return 'info';
    }
  }

  private isSecurityEvent(event: AuditEventData): boolean {
    const securityEvents = [
      AuditEventType.SECURITY_VIOLATION,
      AuditEventType.SUSPICIOUS_ACTIVITY,
      AuditEventType.DATA_BREACH_ATTEMPT,
      AuditEventType.MALICIOUS_PAYLOAD,
      AuditEventType.UNAUTHORIZED_ACCESS,
      AuditEventType.LOGIN_FAILURE,
      AuditEventType.RATE_LIMIT_EXCEEDED,
    ];

    return securityEvents.includes(event.eventType);
  }

  private async handleSecurityEvent(event: AuditEventData): Promise<void> {
    // Record security metrics
    this.metricsCollector.recordSecurityEvent(event.eventType, event.severity, {
      user_id: event.userId || 'anonymous',
      ip_address: event.ipAddress || 'unknown',
      resource: event.resource || 'unknown',
    });

    // Log security event with high visibility
    this.logger.securityEvent(
      `Security event: ${event.eventType}`,
      event.severity as 'low' | 'medium' | 'high' | 'critical',
      {
        eventType: event.eventType,
        userId: event.userId,
        ipAddress: event.ipAddress,
        resource: event.resource,
        outcome: event.outcome,
        details: event.details,
      },
    );

    // Cache security events for rapid response
    await this.cacheService.set(
      `security:${event.timestamp.getTime()}:${event.eventType}`,
      event,
      { prefix: this.cachePrefix, ttl: 86400 }, // 24 hours
    );
  }

  private async handleCriticalEvent(event: AuditEventData): Promise<void> {
    // Log critical event immediately
    this.logger.error(`Critical audit event: ${event.eventType}`, new Error(`Critical audit event: ${event.eventType}`), {
      eventType: event.eventType,
      userId: event.userId,
      ipAddress: event.ipAddress,
      resource: event.resource,
      details: event.details,
      metadata: event.metadata,
    });

    // Record critical event metric
    this.metricsCollector.recordMetric('audit_critical_events_total', 1, 'count', {
      event_type: event.eventType,
    });

    // In production, you might want to:
    // - Send alerts to security team
    // - Trigger automated response
    // - Store in high-priority queue
  }

  private async cacheRecentEvent(event: AuditEventData): Promise<void> {
    // Cache recent events for dashboard/quick access
    const recentKey = `recent:${event.eventType}:${Date.now()}`;
    await this.cacheService.set(recentKey, event, {
      prefix: this.cachePrefix,
      ttl: 3600, // 1 hour
    });
  }

  private cleanupOldEvents(): void {
    // Keep only recent events in memory (in production, this would be handled by database retention policies)
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    const initialLength = this.auditLog.length;

    this.auditLog = this.auditLog.filter((event) => event.timestamp >= cutoffTime);

    const cleanedCount = initialLength - this.auditLog.length;
    if (cleanedCount > 0) {
      this.logger.info(`Cleaned up ${cleanedCount} old audit events`, {
        remaining: this.auditLog.length,
        cutoffTime,
      });
    }
  }

  // Health check method
  getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    eventCount: number;
    oldestEvent?: Date;
    newestEvent?: Date;
  } {
    const eventCount = this.auditLog.length;

    if (eventCount === 0) {
      return {
        status: 'healthy',
        eventCount: 0,
      };
    }

    const timestamps = this.auditLog.map((e) => e.timestamp.getTime());
    const oldestEvent = new Date(Math.min(...timestamps));
    const newestEvent = new Date(Math.max(...timestamps));

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (eventCount > this.maxLogSize * 0.9) {
      status = 'degraded';
    }

    if (eventCount >= this.maxLogSize) {
      status = 'unhealthy';
    }

    return {
      status,
      eventCount,
      oldestEvent,
      newestEvent,
    };
  }
}
