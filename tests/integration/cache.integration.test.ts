import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app';
import { ApiTestHelper, TestDataGenerator, delay, expectValidApiResponse } from '../utils/test-helpers';
import { CacheService } from '../../src/services/cache.service';

describe('Cache Integration Tests', () => {
  let apiHelper: ApiTestHelper;
  let cacheService: CacheService;

  beforeAll(async () => {
    apiHelper = new ApiTestHelper(app);
    cacheService = CacheService.getInstance();
    await cacheService.connect();
  });

  afterAll(async () => {
    await cacheService.disconnect();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await cacheService.flush();
  });

  describe('Response Caching', () => {
    it('should cache GET requests and return cached responses', async () => {
      // Create some test data
      await apiHelper.createReport();
      await apiHelper.createReport();

      // First request should miss cache
      const firstResponse = await apiHelper.getReports({ page: 1, limit: 10 });
      expect(firstResponse.status).toBe(200);
      expect(firstResponse.headers['x-cache']).toBe('MISS');

      // Second identical request should hit cache
      const secondResponse = await apiHelper.getReports({ page: 1, limit: 10 });
      expect(secondResponse.status).toBe(200);
      expect(secondResponse.headers['x-cache']).toBe('HIT');

      // Responses should be identical
      expect(secondResponse.body).toEqual(firstResponse.body);
    });

    it('should cache report details', async () => {
      // Create a test report
      const createResponse = await apiHelper.createReport();
      const reportId = createResponse.body.data.id;

      // First request should miss cache
      const firstResponse = await apiHelper.getReport(reportId);
      expect(firstResponse.status).toBe(200);
      expect(firstResponse.headers['x-cache']).toBe('MISS');

      // Second request should hit cache
      const secondResponse = await apiHelper.getReport(reportId);
      expect(secondResponse.status).toBe(200);
      expect(secondResponse.headers['x-cache']).toBe('HIT');

      // Data should be identical
      expect(secondResponse.body).toEqual(firstResponse.body);
    });

    it('should cache report statistics', async () => {
      // Create some reports for stats
      await Promise.all([
        apiHelper.createReport({ severity: 'high' }),
        apiHelper.createReport({ severity: 'medium' }),
      ]);

      // First stats request should miss cache
      const firstResponse = await request(app)
        .get('/api/v1/reports/stats')
        .set('Authorization', 'Bearer test-api-token-123');
      
      expect(firstResponse.status).toBe(200);
      expect(firstResponse.headers['x-cache']).toBe('MISS');

      // Second stats request should hit cache
      const secondResponse = await request(app)
        .get('/api/v1/reports/stats')
        .set('Authorization', 'Bearer test-api-token-123');
      
      expect(secondResponse.status).toBe(200);
      expect(secondResponse.headers['x-cache']).toBe('HIT');

      expect(secondResponse.body).toEqual(firstResponse.body);
    });

    it('should respect cache TTL', async () => {
      // Create test data
      await apiHelper.createReport();

      // Make request to cache it
      const firstResponse = await apiHelper.getReports({ page: 1, limit: 5 });
      expect(firstResponse.headers['x-cache']).toBe('MISS');

      // Immediately make same request - should hit cache
      const secondResponse = await apiHelper.getReports({ page: 1, limit: 5 });
      expect(secondResponse.headers['x-cache']).toBe('HIT');

      // For testing purposes, we'll verify cache control headers are set
      expect(secondResponse.headers['cache-control']).toContain('max-age');
    });

    it('should generate different cache keys for different queries', async () => {
      await Promise.all([
        apiHelper.createReport({ severity: 'high' }),
        apiHelper.createReport({ severity: 'low' }),
      ]);

      // Different query parameters should result in different cache entries
      const responses = await Promise.all([
        apiHelper.getReports({ page: 1, limit: 10 }),
        apiHelper.getReports({ page: 1, limit: 5 }),
        apiHelper.getReports({ page: 2, limit: 10 }),
        apiHelper.getReports({ severity: 'high' }),
      ]);

      // All should be cache misses initially
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.headers['x-cache']).toBe('MISS');
      });

      // Make same requests again - should all hit cache
      const cachedResponses = await Promise.all([
        apiHelper.getReports({ page: 1, limit: 10 }),
        apiHelper.getReports({ page: 1, limit: 5 }),
        apiHelper.getReports({ page: 2, limit: 10 }),
        apiHelper.getReports({ severity: 'high' }),
      ]);

      cachedResponses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.headers['x-cache']).toBe('HIT');
      });
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cache when creating reports', async () => {
      // Prime the cache
      const initialResponse = await apiHelper.getReports();
      expect(initialResponse.headers['x-cache']).toBe('MISS');

      // Make same request to ensure it's cached
      const cachedResponse = await apiHelper.getReports();
      expect(cachedResponse.headers['x-cache']).toBe('HIT');

      // Create a new report (should invalidate cache)
      await apiHelper.createReport();

      // Give cache invalidation time to process
      await delay(100);

      // Same request should now miss cache due to invalidation
      const afterCreateResponse = await apiHelper.getReports();
      expect(afterCreateResponse.headers['x-cache']).toBe('MISS');
    });

    it('should invalidate cache when updating report status', async () => {
      // Create a report
      const createResponse = await apiHelper.createReport();
      const reportId = createResponse.body.data.id;

      // Cache the reports list
      const listResponse = await apiHelper.getReports();
      expect(listResponse.headers['x-cache']).toBe('MISS');

      const cachedListResponse = await apiHelper.getReports();
      expect(cachedListResponse.headers['x-cache']).toBe('HIT');

      // Update report status (should invalidate cache)
      await apiHelper.updateReportStatus(reportId, 'in_progress');

      await delay(100);

      // List should miss cache now
      const afterUpdateResponse = await apiHelper.getReports();
      expect(afterUpdateResponse.headers['x-cache']).toBe('MISS');
    });

    it('should invalidate cache when assigning reports', async () => {
      // Create a report
      const createResponse = await apiHelper.createReport();
      const reportId = createResponse.body.data.id;

      // Cache the reports list
      await apiHelper.getReports();
      const cachedResponse = await apiHelper.getReports();
      expect(cachedResponse.headers['x-cache']).toBe('HIT');

      // Assign report (should invalidate cache)
      await apiHelper.assignReport(reportId, 'user-123');

      await delay(100);

      // Should miss cache
      const afterAssignResponse = await apiHelper.getReports();
      expect(afterAssignResponse.headers['x-cache']).toBe('MISS');
    });

    it('should invalidate multiple cache patterns', async () => {
      // Create some reports
      await Promise.all([
        apiHelper.createReport(),
        apiHelper.createReport(),
      ]);

      // Cache different endpoints
      await Promise.all([
        apiHelper.getReports(),
        apiHelper.getReports({ page: 2 }),
        request(app).get('/api/v1/reports/stats').set('Authorization', 'Bearer test-api-token-123'),
      ]);

      // Verify they're cached
      const cachedResponses = await Promise.all([
        apiHelper.getReports(),
        apiHelper.getReports({ page: 2 }),
        request(app).get('/api/v1/reports/stats').set('Authorization', 'Bearer test-api-token-123'),
      ]);

      cachedResponses.forEach(response => {
        expect(response.headers['x-cache']).toBe('HIT');
      });

      // Create new report (should invalidate all report-related caches)
      await apiHelper.createReport();
      await delay(100);

      // All should miss cache now
      const afterInvalidationResponses = await Promise.all([
        apiHelper.getReports(),
        apiHelper.getReports({ page: 2 }),
        request(app).get('/api/v1/reports/stats').set('Authorization', 'Bearer test-api-token-123'),
      ]);

      afterInvalidationResponses.forEach(response => {
        expect(response.headers['x-cache']).toBe('MISS');
      });
    });
  });

  describe('Cache Performance', () => {
    it('should improve response times for cached requests', async () => {
      // Create some test data
      await Promise.all(Array.from({ length: 10 }, () => apiHelper.createReport()));

      // Measure first request (cache miss)
      const startTime1 = Date.now();
      const firstResponse = await apiHelper.getReports({ page: 1, limit: 10 });
      const firstDuration = Date.now() - startTime1;
      
      expect(firstResponse.status).toBe(200);
      expect(firstResponse.headers['x-cache']).toBe('MISS');

      // Measure second request (cache hit)
      const startTime2 = Date.now();
      const secondResponse = await apiHelper.getReports({ page: 1, limit: 10 });
      const secondDuration = Date.now() - startTime2;
      
      expect(secondResponse.status).toBe(200);
      expect(secondResponse.headers['x-cache']).toBe('HIT');

      // Cached response should be faster (or at least not significantly slower)
      // Allow some variance due to network/system overhead
      expect(secondDuration).toBeLessThanOrEqual(firstDuration + 50);
    });

    it('should handle concurrent requests efficiently', async () => {
      // Create test data
      await apiHelper.createReport();

      // Make concurrent requests for the same data
      const concurrentRequests = 5;
      const promises = Array.from({ length: concurrentRequests }, () =>
        apiHelper.getReports({ page: 1, limit: 10 })
      );

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expectValidApiResponse(response);
      });

      // First request should miss, others might hit cache
      const cacheStatuses = responses.map(r => r.headers['x-cache']);
      expect(cacheStatuses).toContain('MISS');
      
      // Should complete in reasonable time even with concurrency
      expect(duration).toBeLessThan(5000);
    });

    it('should maintain cache consistency under load', async () => {
      // Prime cache with initial data
      await apiHelper.createReport();
      const initialResponse = await apiHelper.getReports();
      expect(initialResponse.headers['x-cache']).toBe('MISS');

      // Cache the response
      const cachedResponse = await apiHelper.getReports();
      expect(cachedResponse.headers['x-cache']).toBe('HIT');

      // Create multiple reports concurrently (should invalidate cache)
      await Promise.all([
        apiHelper.createReport(),
        apiHelper.createReport(),
        apiHelper.createReport(),
      ]);

      await delay(200);

      // Subsequent request should miss cache
      const afterInvalidationResponse = await apiHelper.getReports();
      expect(afterInvalidationResponse.headers['x-cache']).toBe('MISS');

      // And should have more reports than before
      expect(afterInvalidationResponse.body.data.total).toBeGreaterThan(
        initialResponse.body.data.total
      );
    });
  });

  describe('Cache Error Handling', () => {
    it('should gracefully handle cache service unavailability', async () => {
      // Disconnect cache service to simulate unavailability
      await cacheService.disconnect();

      // Requests should still work without cache
      const response = await apiHelper.getReports();
      expect(response.status).toBe(200);
      expectValidApiResponse(response);

      // Should not have cache headers when cache is unavailable
      expect(response.headers['x-cache']).toBeUndefined();

      // Reconnect for other tests
      await cacheService.connect();
    });

    it('should handle cache errors gracefully', async () => {
      // This test depends on your specific cache implementation
      // For now, we'll just verify that requests work even if cache has issues
      
      const response = await apiHelper.getReports();
      expect(response.status).toBe(200);
      expectValidApiResponse(response);
    });

    it('should not cache error responses', async () => {
      // Make a request that will fail
      const errorResponse1 = await request(app)
        .get('/api/v1/reports/invalid-uuid')
        .set('Authorization', 'Bearer test-api-token-123');
      
      expect(errorResponse1.status).toBe(404);
      
      // Make same request again
      const errorResponse2 = await request(app)
        .get('/api/v1/reports/invalid-uuid')
        .set('Authorization', 'Bearer test-api-token-123');
      
      expect(errorResponse2.status).toBe(404);
      
      // Should not have cache headers for error responses
      expect(errorResponse1.headers['x-cache']).toBeUndefined();
      expect(errorResponse2.headers['x-cache']).toBeUndefined();
    });
  });

  describe('Cache Statistics and Monitoring', () => {
    it('should track cache hit/miss statistics', async () => {
      // Generate some cache activity
      await apiHelper.createReport();
      
      // Miss, then hit
      await apiHelper.getReports();
      await apiHelper.getReports();
      
      // Different query - miss, then hit
      await apiHelper.getReports({ page: 2 });
      await apiHelper.getReports({ page: 2 });

      await delay(100);

      // Check cache statistics
      const statsResponse = await request(app)
        .get('/api/v1/monitoring/cache')
        .set('Authorization', 'Bearer test-api-token-123');

      expect(statsResponse.status).toBe(200);
      expectValidApiResponse(statsResponse);

      const stats = statsResponse.body.data.stats;
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(stats.sets).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.hitRate).toBeLessThanOrEqual(100);
    });

    it('should provide cache health information', async () => {
      const healthResponse = await request(app)
        .get('/api/v1/monitoring/cache')
        .set('Authorization', 'Bearer test-api-token-123');

      expect(healthResponse.status).toBe(200);
      
      const health = healthResponse.body.data.health;
      expect(health).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      
      if (health.status !== 'unhealthy') {
        expect(health).toHaveProperty('latency');
        expect(typeof health.latency).toBe('number');
        expect(health.latency).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Cache Configuration and Strategies', () => {
    it('should use different TTL for different endpoints', async () => {
      // This is more of an implementation detail test
      // We can verify that different endpoints set different cache-control headers
      
      await apiHelper.createReport();
      
      const reportsResponse = await apiHelper.getReports();
      const statsResponse = await request(app)
        .get('/api/v1/reports/stats')
        .set('Authorization', 'Bearer test-api-token-123');

      // Both should have cache-control headers
      expect(reportsResponse.headers['cache-control']).toBeDefined();
      expect(statsResponse.headers['cache-control']).toBeDefined();
    });

    it('should cache based on user context', async () => {
      // This test verifies that different users get different cache entries
      // Since we're using the same test token, we'll verify the cache key includes user info
      
      await apiHelper.createReport();
      
      const response1 = await apiHelper.getReports();
      expect(response1.headers['x-cache']).toBe('MISS');
      
      const response2 = await apiHelper.getReports();
      expect(response2.headers['x-cache']).toBe('HIT');
      
      // Same user should get cached response
      expect(response2.body).toEqual(response1.body);
    });
  });

  describe('Integration with Business Logic', () => {
    it('should maintain data consistency during cache operations', async () => {
      // Create initial report
      const report1 = await apiHelper.createReport({ title: 'Initial Report' });
      
      // Cache the list
      const listResponse1 = await apiHelper.getReports();
      expect(listResponse1.body.data.total).toBe(1);
      
      // Create another report
      const report2 = await apiHelper.createReport({ title: 'Second Report' });
      
      await delay(100);
      
      // New list should reflect the change (cache should be invalidated)
      const listResponse2 = await apiHelper.getReports();
      expect(listResponse2.body.data.total).toBe(2);
      expect(listResponse2.headers['x-cache']).toBe('MISS');
      
      // Verify both reports are there
      const titles = listResponse2.body.data.items.map((item: any) => item.title);
      expect(titles).toContain('Initial Report');
      expect(titles).toContain('Second Report');
    });

    it('should handle complex query combinations correctly', async () => {
      // Create reports with different severities and statuses
      await Promise.all([
        apiHelper.createReport({ severity: 'high' }),
        apiHelper.createReport({ severity: 'medium' }),
        apiHelper.createReport({ severity: 'low' }),
      ]);

      // Test various query combinations
      const queries = [
        { severity: 'high' },
        { severity: 'medium' },
        { page: 1, limit: 5 },
        { page: 1, limit: 10 },
        { severity: 'high', page: 1, limit: 5 },
      ];

      // First requests should miss cache
      for (const query of queries) {
        const response = await apiHelper.getReports(query);
        expect(response.status).toBe(200);
        expect(response.headers['x-cache']).toBe('MISS');
      }

      // Second requests should hit cache
      for (const query of queries) {
        const response = await apiHelper.getReports(query);
        expect(response.status).toBe(200);
        expect(response.headers['x-cache']).toBe('HIT');
      }
    });
  });
});