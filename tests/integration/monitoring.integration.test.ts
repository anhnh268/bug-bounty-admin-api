import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app';
import { ApiTestHelper, expectValidApiResponse, delay, expectEventuallyTrue } from '../utils/test-helpers';
import { CacheService } from '../../src/services/cache.service';
import { MetricsCollector } from '../../src/monitoring/metrics';

describe('Monitoring Integration Tests', () => {
  let apiHelper: ApiTestHelper;
  let cacheService: CacheService;
  let metricsCollector: MetricsCollector;

  beforeAll(async () => {
    apiHelper = new ApiTestHelper(app);
    cacheService = CacheService.getInstance();
    metricsCollector = MetricsCollector.getInstance();
    await cacheService.connect();
  });

  afterAll(async () => {
    await cacheService.disconnect();
  });

  beforeEach(async () => {
    // Clear cache and reset metrics before each test
    await cacheService.flush();
    metricsCollector.reset();
  });

  describe('Health Monitoring', () => {
    it('should provide basic health check', async () => {
      const response = await apiHelper.getHealth();

      expect(response.status).toBe(200);
      expectValidApiResponse(response);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'healthy');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('environment');
    });

    it('should provide detailed health status with authentication', async () => {
      const response = await apiHelper.getMonitoringHealth();

      expect(response.status).toBe(200);
      expectValidApiResponse(response);
      expect(response.body.success).toBe(true);
      
      const data = response.body.data;
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('checks');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
      expect(data).toHaveProperty('environment');
      expect(data).toHaveProperty('version');

      // Validate health checks
      expect(data.checks).toHaveProperty('memory');
      expect(data.checks).toHaveProperty('error_rate');
      
      // Memory check structure
      expect(data.checks.memory).toHaveProperty('status');
      expect(data.checks.memory).toHaveProperty('heap_used');
      expect(data.checks.memory).toHaveProperty('heap_total');
      expect(data.checks.memory).toHaveProperty('usage_percent');

      // Error rate check structure
      expect(data.checks.error_rate).toHaveProperty('status');
      expect(data.checks.error_rate).toHaveProperty('value');
      expect(data.checks.error_rate).toHaveProperty('unit', 'percentage');
    });

    it('should require authentication for detailed health', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/health')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expectValidApiResponse(response);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Metrics Collection', () => {
    it('should collect and return basic metrics', async () => {
      // Generate some traffic to create metrics
      await Promise.all([
        apiHelper.createReport(),
        apiHelper.createReport(),
        apiHelper.getReports(),
      ]);

      // Wait a bit for metrics to be collected
      await delay(100);

      const response = await apiHelper.getMetrics();

      expect(response.status).toBe(200);
      expectValidApiResponse(response);
      expect(response.body.success).toBe(true);

      const data = response.body.data;
      expect(data).toHaveProperty('metrics');
      expect(data).toHaveProperty('collected_at');
      expect(data).toHaveProperty('performance');

      // Should have HTTP request metrics
      const metrics = data.metrics;
      expect(metrics).toHaveProperty('http_requests_total');
      expect(metrics).toHaveProperty('http_request_duration');
    });

    it('should provide metrics summary', async () => {
      // Generate some traffic
      await Promise.all([
        apiHelper.createReport(),
        apiHelper.getReports(),
        apiHelper.getReports(), // Second call should hit cache
      ]);

      await delay(100);

      const response = await request(app)
        .get('/api/v1/monitoring/metrics')
        .query({ summary: 'true' })
        .set('Authorization', 'Bearer test-api-token-123');

      expect(response.status).toBe(200);
      expectValidApiResponse(response);

      const summary = response.body.data.metrics;
      
      // Check summary structure for HTTP metrics
      if (summary.http_requests_total) {
        expect(summary.http_requests_total).toHaveProperty('count');
        expect(summary.http_requests_total).toHaveProperty('latest_value');
        expect(summary.http_requests_total).toHaveProperty('sum');
        expect(summary.http_requests_total).toHaveProperty('avg');
      }

      // Check error rate
      expect(summary).toHaveProperty('error_rate');
      expect(summary.error_rate).toHaveProperty('value');
      expect(summary.error_rate).toHaveProperty('unit', 'percentage');
    });

    it('should track business events', async () => {
      // Create reports to trigger business events
      await Promise.all([
        apiHelper.createReport({ severity: 'critical' }),
        apiHelper.createReport({ severity: 'high' }),
      ]);

      await delay(100);

      const response = await apiHelper.getMetrics();
      expect(response.status).toBe(200);

      const metrics = response.body.data.metrics;
      expect(metrics).toHaveProperty('business_events_total');
    });

    it('should require admin role for metrics access', async () => {
      const response = await request(app)
        .get('/api/v1/monitoring/metrics')
        .set('Authorization', 'Bearer test-api-token-123'); // Regular token

      expect(response.status).toBe(403);
      expectValidApiResponse(response);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics', async () => {
      // Generate some load
      const startTime = Date.now();
      await Promise.all(Array.from({ length: 5 }, () => apiHelper.createReport()));
      const endTime = Date.now();

      await delay(100);

      const response = await request(app)
        .get('/api/v1/monitoring/performance')
        .set('Authorization', 'Bearer test-api-token-123');

      expect(response.status).toBe(200);
      expectValidApiResponse(response);

      const data = response.body.data;
      expect(data).toHaveProperty('request_count');
      expect(data).toHaveProperty('error_count');
      expect(data).toHaveProperty('active_connections');
      expect(data).toHaveProperty('memory_usage');
      expect(data).toHaveProperty('cpu_usage');
      expect(data).toHaveProperty('average_response_time');
      expect(data).toHaveProperty('uptime');

      // Validate numeric values
      expect(typeof data.request_count).toBe('number');
      expect(typeof data.error_count).toBe('number');
      expect(typeof data.active_connections).toBe('number');
      expect(typeof data.average_response_time).toBe('number');
      expect(typeof data.uptime).toBe('number');

      // Memory usage structure
      expect(data.memory_usage).toHaveProperty('heapUsed');
      expect(data.memory_usage).toHaveProperty('heapTotal');
      expect(data.memory_usage).toHaveProperty('external');

      // Should have recorded some requests
      expect(data.request_count).toBeGreaterThan(0);
    });

    it('should detect slow requests', async () => {
      // Create a request that might be slower due to database operations
      await apiHelper.createReport();
      
      // Get performance metrics
      const response = await request(app)
        .get('/api/v1/monitoring/performance')
        .set('Authorization', 'Bearer test-api-token-123');

      expect(response.status).toBe(200);
      const data = response.body.data;
      
      // Should have reasonable response times (under 1 second for tests)
      expect(data.average_response_time).toBeLessThan(1000);
    });
  });

  describe('Cache Monitoring', () => {
    it('should monitor cache performance', async () => {
      // Prime the cache with some requests
      await apiHelper.getReports();
      await apiHelper.getReports(); // Should hit cache
      await apiHelper.getReports(); // Should hit cache again

      await delay(100);

      const response = await apiHelper.getCacheStatus();

      expect(response.status).toBe(200);
      expectValidApiResponse(response);

      const data = response.body.data;
      expect(data).toHaveProperty('stats');
      expect(data).toHaveProperty('health');
      expect(data).toHaveProperty('timestamp');

      // Cache stats structure
      const stats = data.stats;
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('sets');
      expect(stats).toHaveProperty('deletes');
      expect(stats).toHaveProperty('errors');
      expect(stats).toHaveProperty('hitRate');

      // Should have some cache activity
      expect(stats.hits + stats.misses).toBeGreaterThan(0);
      expect(typeof stats.hitRate).toBe('number');
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeLessThanOrEqual(100);

      // Cache health structure
      const health = data.health;
      expect(health).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    });

    it('should show cache hits and misses', async () => {
      // Clear cache first
      await cacheService.flush();
      await delay(50);

      // Make request that should miss cache
      await apiHelper.getReports({ page: 1, limit: 10 });
      
      // Make same request that should hit cache
      await apiHelper.getReports({ page: 1, limit: 10 });
      
      await delay(100);

      const response = await apiHelper.getCacheStatus();
      expect(response.status).toBe(200);

      const stats = response.body.data.stats;
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThan(0);
    });
  });

  describe('Custom Logging', () => {
    it('should allow creating custom log entries', async () => {
      const logData = {
        level: 'info',
        message: 'Test log entry from integration test',
        context: {
          testCase: 'monitoring.integration.test',
          timestamp: new Date().toISOString(),
        },
      };

      const response = await request(app)
        .post('/api/v1/monitoring/logs')
        .set('Authorization', 'Bearer test-api-token-123')
        .send(logData);

      expect(response.status).toBe(201);
      expectValidApiResponse(response);
      expect(response.body.success).toBe(true);

      const data = response.body.data;
      expect(data).toHaveProperty('logged_at');
      expect(data).toHaveProperty('level', logData.level);
      expect(data).toHaveProperty('message', logData.message);
      expect(data).toHaveProperty('context');
      expect(data.context).toMatchObject(logData.context);
    });

    it('should validate log entry data', async () => {
      const invalidLogData = {
        level: 'invalid-level',
        message: '',
      };

      const response = await request(app)
        .post('/api/v1/monitoring/logs')
        .set('Authorization', 'Bearer test-api-token-123')
        .send(invalidLogData);

      expect(response.status).toBe(400);
      expectValidApiResponse(response);
      expect(response.body.success).toBe(false);
    });

    it('should support different log levels', async () => {
      const levels = ['debug', 'info', 'warn', 'error'];
      
      for (const level of levels) {
        const response = await request(app)
          .post('/api/v1/monitoring/logs')
          .set('Authorization', 'Bearer test-api-token-123')
          .send({
            level,
            message: `Test ${level} message`,
          });

        expect(response.status).toBe(201);
        expect(response.body.data.level).toBe(level);
      }
    });
  });

  describe('Error Tracking', () => {
    it('should track error metrics when requests fail', async () => {
      // Generate some errors
      await Promise.all([
        request(app).get('/api/v1/reports/invalid-id').set('Authorization', 'Bearer test-api-token-123'),
        request(app).post('/api/v1/reports').set('Authorization', 'Bearer test-api-token-123').send({}),
        request(app).get('/api/v1/nonexistent'),
      ]);

      await delay(100);

      const response = await apiHelper.getMetrics();
      expect(response.status).toBe(200);

      const metrics = response.body.data.metrics;
      expect(metrics).toHaveProperty('http_errors_total');
    });

    it('should maintain health status during errors', async () => {
      // Generate some errors
      await Promise.all([
        request(app).get('/api/v1/reports/invalid-id').set('Authorization', 'Bearer test-api-token-123'),
        request(app).post('/api/v1/reports').set('Authorization', 'Bearer test-api-token-123').send({}),
      ]);

      await delay(100);

      const response = await apiHelper.getMonitoringHealth();
      expect(response.status).toBe(200);

      const data = response.body.data;
      // Should still be healthy with a few errors
      expect(['healthy', 'warning']).toContain(data.status);
    });
  });

  describe('Real-time Monitoring', () => {
    it('should update metrics in real-time', async () => {
      // Get initial metrics
      const initialResponse = await apiHelper.getMetrics();
      const initialCount = initialResponse.body.data.performance.requestCount;

      // Make some requests
      await Promise.all([
        apiHelper.createReport(),
        apiHelper.getReports(),
      ]);

      await delay(100);

      // Get updated metrics
      const updatedResponse = await apiHelper.getMetrics();
      const updatedCount = updatedResponse.body.data.performance.requestCount;

      // Should have increased
      expect(updatedCount).toBeGreaterThan(initialCount);
    });

    it('should track concurrent request handling', async () => {
      const concurrentRequests = 5;
      
      // Make concurrent requests
      const promises = Array.from({ length: concurrentRequests }, () =>
        apiHelper.createReport()
      );

      await Promise.all(promises);

      await delay(100);

      const response = await request(app)
        .get('/api/v1/monitoring/performance')
        .set('Authorization', 'Bearer test-api-token-123');

      expect(response.status).toBe(200);
      const data = response.body.data;

      // Should have handled all requests
      expect(data.request_count).toBeGreaterThanOrEqual(concurrentRequests);
      
      // Active connections should be 0 after requests complete
      expect(data.active_connections).toBe(0);
    });
  });

  describe('Integration with Business Logic', () => {
    it('should track cache invalidation on data changes', async () => {
      // Prime cache
      await apiHelper.getReports();
      
      // Check cache stats
      let cacheResponse = await apiHelper.getCacheStatus();
      const initialStats = cacheResponse.body.data.stats;

      // Create a new report (should invalidate cache)
      await apiHelper.createReport();

      await delay(100);

      // Make same request (should miss cache due to invalidation)
      await apiHelper.getReports();

      // Check cache stats again
      cacheResponse = await apiHelper.getCacheStatus();
      const updatedStats = cacheResponse.body.data.stats;

      // Should have more cache operations
      expect(updatedStats.sets + updatedStats.deletes).toBeGreaterThan(
        initialStats.sets + initialStats.deletes
      );
    });

    it('should maintain monitoring during high load', async () => {
      const highLoadRequests = 20;
      
      // Generate high load
      const promises = Array.from({ length: highLoadRequests }, (_, i) =>
        i % 2 === 0 ? apiHelper.createReport() : apiHelper.getReports()
      );

      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      await delay(200);

      // Check that monitoring is still working
      const healthResponse = await apiHelper.getMonitoringHealth();
      expect(healthResponse.status).toBe(200);

      const metricsResponse = await apiHelper.getMetrics();
      expect(metricsResponse.status).toBe(200);

      const cacheResponse = await apiHelper.getCacheStatus();
      expect(cacheResponse.status).toBe(200);

      // Should have handled all requests reasonably quickly (under 10 seconds)
      expect(duration).toBeLessThan(10000);

      // Metrics should reflect the load
      const performanceData = metricsResponse.body.data.performance;
      expect(performanceData.requestCount).toBeGreaterThanOrEqual(highLoadRequests);
    });
  });
});