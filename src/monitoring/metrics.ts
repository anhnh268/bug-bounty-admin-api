import { Request, Response } from 'express';

export interface MetricData {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface PerformanceMetrics {
  requestCount: number;
  requestDuration: number[];
  errorCount: number;
  activeConnections: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: Map<string, MetricData[]> = new Map();
  private performanceMetrics: PerformanceMetrics;
  private readonly maxMetricsHistory = 1000;

  private constructor() {
    this.performanceMetrics = {
      requestCount: 0,
      requestDuration: [],
      errorCount: 0,
      activeConnections: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };

    // Update resource metrics every 30 seconds
    setInterval(() => {
      this.updateResourceMetrics();
    }, 30000);
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  private updateResourceMetrics(): void {
    this.performanceMetrics.memoryUsage = process.memoryUsage();
    this.performanceMetrics.cpuUsage = process.cpuUsage();

    this.recordMetric('memory_heap_used', this.performanceMetrics.memoryUsage.heapUsed, 'bytes');
    this.recordMetric('memory_heap_total', this.performanceMetrics.memoryUsage.heapTotal, 'bytes');
    this.recordMetric('memory_external', this.performanceMetrics.memoryUsage.external, 'bytes');
    this.recordMetric('cpu_user', this.performanceMetrics.cpuUsage.user, 'microseconds');
    this.recordMetric('cpu_system', this.performanceMetrics.cpuUsage.system, 'microseconds');
  }

  recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    const metric: MetricData = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricHistory = this.metrics.get(name)!;
    metricHistory.push(metric);

    // Keep only recent metrics to prevent memory leaks
    if (metricHistory.length > this.maxMetricsHistory) {
      metricHistory.shift();
    }
  }

  recordHttpRequest(req: Request, res: Response, duration: number): void {
    this.performanceMetrics.requestCount++;
    this.performanceMetrics.requestDuration.push(duration);

    // Keep only last 1000 durations
    if (this.performanceMetrics.requestDuration.length > this.maxMetricsHistory) {
      this.performanceMetrics.requestDuration.shift();
    }

    const tags = {
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode.toString(),
      status_class: `${Math.floor(res.statusCode / 100)}xx`,
    };

    this.recordMetric('http_requests_total', 1, 'count', tags);
    this.recordMetric('http_request_duration', duration, 'milliseconds', tags);

    if (res.statusCode >= 400) {
      this.performanceMetrics.errorCount++;
      this.recordMetric('http_errors_total', 1, 'count', tags);
    }
  }

  recordDatabaseQuery(operation: string, table: string, duration: number, success: boolean): void {
    const tags = {
      operation: operation.toLowerCase(),
      table,
      success: success.toString(),
    };

    this.recordMetric('database_queries_total', 1, 'count', tags);
    this.recordMetric('database_query_duration', duration, 'milliseconds', tags);

    if (!success) {
      this.recordMetric('database_errors_total', 1, 'count', tags);
    }
  }

  recordBusinessEvent(event: string, tags?: Record<string, string>): void {
    this.recordMetric('business_events_total', 1, 'count', { event, ...tags });
  }

  recordSecurityEvent(event: string, severity: string, tags?: Record<string, string>): void {
    this.recordMetric('security_events_total', 1, 'count', {
      event,
      severity,
      ...tags,
    });
  }

  getMetrics(name?: string): MetricData[] | Map<string, MetricData[]> {
    if (name) {
      return this.metrics.get(name) || [];
    }
    return this.metrics;
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  getMetricsSummary(): Record<string, any> {
    const summary: Record<string, any> = {};

    for (const [name, metrics] of this.metrics.entries()) {
      if (metrics.length === 0) continue;

      const values = metrics.map((m) => m.value);
      const latest = metrics[metrics.length - 1];

      summary[name] = {
        count: metrics.length,
        latest_value: latest.value,
        latest_timestamp: latest.timestamp,
        unit: latest.unit,
        sum: values.reduce((a, b) => a + b, 0),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
      };
    }

    // Add derived metrics
    if (this.performanceMetrics.requestDuration.length > 0) {
      const durations = this.performanceMetrics.requestDuration;
      summary.http_response_time = {
        count: durations.length,
        avg: durations.reduce((a, b) => a + b, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        p95: this.calculatePercentile(durations, 95),
        p99: this.calculatePercentile(durations, 99),
        unit: 'milliseconds',
      };
    }

    summary.error_rate = {
      value:
        this.performanceMetrics.requestCount > 0
          ? (this.performanceMetrics.errorCount / this.performanceMetrics.requestCount) * 100
          : 0,
      unit: 'percentage',
    };

    return summary;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  // Health check status
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    checks: Record<string, any>;
  } {
    const checks: Record<string, any> = {};
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Memory check
    const memUsage = this.performanceMetrics.memoryUsage;
    const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    checks.memory = {
      status: memUsagePercent > 90 ? 'critical' : memUsagePercent > 70 ? 'warning' : 'healthy',
      heap_used: memUsage.heapUsed,
      heap_total: memUsage.heapTotal,
      usage_percent: Math.round(memUsagePercent),
    };

    // Error rate check
    const errorRate =
      this.performanceMetrics.requestCount > 0
        ? (this.performanceMetrics.errorCount / this.performanceMetrics.requestCount) * 100
        : 0;
    checks.error_rate = {
      status: errorRate > 10 ? 'critical' : errorRate > 5 ? 'warning' : 'healthy',
      value: Math.round(errorRate * 100) / 100,
      unit: 'percentage',
    };

    // Response time check
    if (this.performanceMetrics.requestDuration.length > 0) {
      const avgResponseTime =
        this.performanceMetrics.requestDuration.reduce((a, b) => a + b, 0) /
        this.performanceMetrics.requestDuration.length;
      checks.response_time = {
        status:
          avgResponseTime > 5000 ? 'critical' : avgResponseTime > 2000 ? 'warning' : 'healthy',
        avg: Math.round(avgResponseTime),
        unit: 'milliseconds',
      };
    }

    // Determine overall status
    const statuses = Object.values(checks).map((check) => check.status);
    if (statuses.includes('critical')) {
      status = 'critical';
    } else if (statuses.includes('warning')) {
      status = 'warning';
    }

    return { status, checks };
  }

  reset(): void {
    this.metrics.clear();
    this.performanceMetrics = {
      requestCount: 0,
      requestDuration: [],
      errorCount: 0,
      activeConnections: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };
  }
}
