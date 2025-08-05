import { describe, it, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app';
import { 
  TestDataGenerator, 
  ApiTestHelper, 
  PropertyBasedTestRunner,
  expectValidApiResponse,
  expectValidReport 
} from '../utils/test-helpers';
import { ReportSeverity, ReportStatus } from '../../src/types/report.types';
import { CacheService } from '../../src/services/cache.service';

describe('Report API - Property-Based Tests', () => {
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
    // Clear cache before each test to ensure clean state
    await cacheService.flush();
  });

  describe('Property: Valid report creation always succeeds', () => {
    it('should always create valid reports successfully', async () => {
      await PropertyBasedTestRunner.runProperty(
        'Valid reports are always created successfully',
        () => TestDataGenerator.generateCreateReportDto(),
        async (reportData) => {
          const response = await apiHelper.createReport(reportData);
          
          if (response.status !== 201) {
            console.log('Failed report data:', reportData);
            console.log('Response:', response.body);
            return false;
          }
          
          expectValidApiResponse(response);
          expect(response.body.success).toBe(true);
          expectValidReport(response.body.data);
          
          return true;
        },
        50
      );
    });

    it('should reject reports with invalid titles', async () => {
      await PropertyBasedTestRunner.runProperty(
        'Invalid titles are always rejected',
        () => ({
          ...TestDataGenerator.generateCreateReportDto(),
          title: TestDataGenerator.invalidReportTitle(),
        }),
        async (reportData) => {
          const response = await apiHelper.createReport(reportData);
          
          // Should be rejected with 400 status
          if (response.status === 201) {
            console.log('Unexpectedly accepted invalid title:', reportData.title);
            return false;
          }
          
          expect(response.status).toBe(400);
          expectValidApiResponse(response);
          expect(response.body.success).toBe(false);
          
          return true;
        },
        20
      );
    });

    it('should reject reports with invalid descriptions', async () => {
      await PropertyBasedTestRunner.runProperty(
        'Invalid descriptions are always rejected',
        () => ({
          ...TestDataGenerator.generateCreateReportDto(),
          description: TestDataGenerator.invalidDescription(),
        }),
        async (reportData) => {
          const response = await apiHelper.createReport(reportData);
          
          if (response.status === 201) {
            console.log('Unexpectedly accepted invalid description:', reportData.description);
            return false;
          }
          
          expect(response.status).toBe(400);
          expectValidApiResponse(response);
          expect(response.body.success).toBe(false);
          
          return true;
        },
        20
      );
    });

    it('should reject reports with invalid emails', async () => {
      await PropertyBasedTestRunner.runProperty(
        'Invalid emails are always rejected',
        () => ({
          ...TestDataGenerator.generateCreateReportDto(),
          submittedBy: TestDataGenerator.invalidEmail(),
        }),
        async (reportData) => {
          const response = await apiHelper.createReport(reportData);
          
          if (response.status === 201) {
            console.log('Unexpectedly accepted invalid email:', reportData.submittedBy);
            return false;
          }
          
          expect(response.status).toBe(400);
          expectValidApiResponse(response);
          expect(response.body.success).toBe(false);
          
          return true;
        },
        20
      );
    });
  });

  describe('Property: Report retrieval is consistent', () => {
    it('should always return the same report for the same ID', async () => {
      // First create a report
      const createResponse = await apiHelper.createReport();
      expect(createResponse.status).toBe(201);
      const reportId = createResponse.body.data.id;

      await PropertyBasedTestRunner.runProperty(
        'Report retrieval is idempotent',
        () => reportId,
        async (id) => {
          const response1 = await apiHelper.getReport(id);
          const response2 = await apiHelper.getReport(id);
          
          if (response1.status !== 200 || response2.status !== 200) {
            return false;
          }
          
          // Both responses should be identical
          expect(response1.body).toEqual(response2.body);
          expectValidReport(response1.body.data);
          expectValidReport(response2.body.data);
          
          return true;
        },
        10
      );
    });

    it('should handle invalid UUIDs gracefully', async () => {
      await PropertyBasedTestRunner.runProperty(
        'Invalid UUIDs are handled gracefully',
        () => TestDataGenerator.edgeCaseStrings()[Math.floor(Math.random() * TestDataGenerator.edgeCaseStrings().length)],
        async (invalidId) => {
          const response = await apiHelper.getReport(invalidId);
          
          // Should either be 400 (bad request) or 404 (not found)
          expect([400, 404]).toContain(response.status);
          expectValidApiResponse(response);
          expect(response.body.success).toBe(false);
          
          return true;
        },
        15
      );
    });
  });

  describe('Property: Report listing is consistent', () => {
    it('should always return valid paginated responses', async () => {
      // Create some test reports first
      await Promise.all([
        apiHelper.createReport(),
        apiHelper.createReport(),
        apiHelper.createReport(),
      ]);

      await PropertyBasedTestRunner.runProperty(
        'Report listing returns valid pagination',
        () => ({
          page: Math.floor(Math.random() * 3) + 1,
          limit: Math.floor(Math.random() * 20) + 1,
          status: Math.random() > 0.5 ? Object.values(ReportStatus)[Math.floor(Math.random() * Object.values(ReportStatus).length)] : undefined,
          severity: Math.random() > 0.5 ? Object.values(ReportSeverity)[Math.floor(Math.random() * Object.values(ReportSeverity).length)] : undefined,
        }),
        async (query) => {
          const response = await apiHelper.getReports(query);
          
          if (response.status !== 200) {
            console.log('Query failed:', query);
            console.log('Response:', response.body);
            return false;
          }
          
          expectValidApiResponse(response);
          expect(response.body.success).toBe(true);
          
          const data = response.body.data;
          expect(data).toHaveProperty('items');
          expect(data).toHaveProperty('total');
          expect(data).toHaveProperty('page');
          expect(data).toHaveProperty('limit');
          
          // Validate pagination math
          expect(data.page).toBe(query.page);
          expect(data.limit).toBe(query.limit);
          expect(data.items.length).toBeLessThanOrEqual(data.limit);
          
          // Validate each report
          data.items.forEach((report: any) => {
            expectValidReport(report);
            
            // Check filtering
            if (query.status) {
              expect(report.status).toBe(query.status);
            }
            if (query.severity) {
              expect(report.severity).toBe(query.severity);
            }
          });
          
          return true;
        },
        30
      );
    });

    it('should handle invalid query parameters gracefully', async () => {
      await PropertyBasedTestRunner.runProperty(
        'Invalid query parameters are handled gracefully',
        () => ({
          page: TestDataGenerator.edgeCaseNumbers()[Math.floor(Math.random() * TestDataGenerator.edgeCaseNumbers().length)],
          limit: TestDataGenerator.edgeCaseNumbers()[Math.floor(Math.random() * TestDataGenerator.edgeCaseNumbers().length)],
          status: TestDataGenerator.edgeCaseStrings()[Math.floor(Math.random() * TestDataGenerator.edgeCaseStrings().length)],
          severity: TestDataGenerator.edgeCaseStrings()[Math.floor(Math.random() * TestDataGenerator.edgeCaseStrings().length)],
        }),
        async (query) => {
          const response = await apiHelper.getReports(query);
          
          // Should either succeed with defaults or fail with 400
          if (response.status === 200) {
            expectValidApiResponse(response);
            expect(response.body.success).toBe(true);
            return true;
          } else if (response.status === 400) {
            expectValidApiResponse(response);
            expect(response.body.success).toBe(false);
            return true;
          }
          
          console.log('Unexpected status:', response.status, 'for query:', query);
          return false;
        },
        25
      );
    });
  });

  describe('Property: Report state transitions are valid', () => {
    it('should maintain valid state transitions', async () => {
      // Create a report first
      const createResponse = await apiHelper.createReport();
      expect(createResponse.status).toBe(201);
      const reportId = createResponse.body.data.id;

      await PropertyBasedTestRunner.runProperty(
        'Status transitions are valid',
        () => Object.values(ReportStatus)[Math.floor(Math.random() * Object.values(ReportStatus).length)],
        async (newStatus) => {
          const response = await apiHelper.updateReportStatus(reportId, newStatus);
          
          if (response.status !== 200) {
            // Some transitions might be invalid, which is acceptable
            expect([400, 403, 404]).toContain(response.status);
            expectValidApiResponse(response);
            expect(response.body.success).toBe(false);
            return true;
          }
          
          expectValidApiResponse(response);
          expect(response.body.success).toBe(true);
          expectValidReport(response.body.data);
          expect(response.body.data.status).toBe(newStatus);
          
          return true;
        },
        Object.values(ReportStatus).length
      );
    });
  });

  describe('Property: Authentication is consistently enforced', () => {
    it('should always require authentication for protected endpoints', async () => {
      await PropertyBasedTestRunner.runProperty(
        'Protected endpoints require authentication',
        () => TestDataGenerator.edgeCaseStrings()[Math.floor(Math.random() * TestDataGenerator.edgeCaseStrings().length)],
        async (invalidToken) => {
          const responses = await Promise.all([
            request(app).post('/api/v1/reports').set('Authorization', `Bearer ${invalidToken}`).send(TestDataGenerator.generateCreateReportDto()),
            request(app).get('/api/v1/reports').set('Authorization', `Bearer ${invalidToken}`),
            request(app).get('/api/v1/monitoring/metrics').set('Authorization', `Bearer ${invalidToken}`),
          ]);
          
          // All should be unauthorized
          for (const response of responses) {
            if (response.status !== 401) {
              console.log('Unexpected access granted with token:', invalidToken);
              return false;
            }
            expectValidApiResponse(response);
            expect(response.body.success).toBe(false);
          }
          
          return true;
        },
        15
      );
    });
  });

  describe('Property: Cache behavior is consistent', () => {
    it('should provide consistent cache behavior for repeated requests', async () => {
      // Create some reports to cache
      await Promise.all([
        apiHelper.createReport(),
        apiHelper.createReport(),
      ]);

      await PropertyBasedTestRunner.runProperty(
        'Cache provides consistent responses',
        () => ({
          page: Math.floor(Math.random() * 2) + 1,
          limit: Math.floor(Math.random() * 10) + 1,
        }),
        async (query) => {
          // Make the same request multiple times
          const responses = await Promise.all([
            apiHelper.getReports(query),
            apiHelper.getReports(query),
            apiHelper.getReports(query),
          ]);
          
          // All responses should be identical
          const firstResponse = responses[0];
          
          if (firstResponse.status !== 200) {
            return false;
          }
          
          for (let i = 1; i < responses.length; i++) {
            expect(responses[i].status).toBe(firstResponse.status);
            expect(responses[i].body).toEqual(firstResponse.body);
          }
          
          // Check for cache headers
          const cacheHeaders = responses.map(r => r.headers['x-cache']);
          expect(cacheHeaders[0]).toBe('MISS'); // First request should be a miss
          expect(cacheHeaders.slice(1).every(h => h === 'HIT')).toBe(true); // Subsequent should be hits
          
          return true;
        },
        10
      );
    });
  });

  describe('Property: Performance characteristics are maintained', () => {
    it('should respond within acceptable time limits', async () => {
      await PropertyBasedTestRunner.runProperty(
        'API responses are within performance limits',
        () => TestDataGenerator.generateCreateReportDto(),
        async (reportData) => {
          const startTime = Date.now();
          const response = await apiHelper.createReport(reportData);
          const duration = Date.now() - startTime;
          
          // Should respond within 5 seconds (generous for testing)
          if (duration > 5000) {
            console.log(`Slow response: ${duration}ms`);
            return false;
          }
          
          expect(response.status).toBe(201);
          return true;
        },
        20
      );
    });

    it('should handle concurrent requests properly', async () => {
      await PropertyBasedTestRunner.runProperty(
        'Concurrent requests are handled properly',
        () => Math.floor(Math.random() * 5) + 2, // 2-6 concurrent requests
        async (concurrentCount) => {
          const requests = Array.from({ length: concurrentCount }, () =>
            apiHelper.createReport(TestDataGenerator.generateCreateReportDto())
          );
          
          const responses = await Promise.all(requests);
          
          // All should succeed
          for (const response of responses) {
            if (response.status !== 201) {
              console.log('Concurrent request failed:', response.status);
              return false;
            }
            expectValidApiResponse(response);
            expectValidReport(response.body.data);
          }
          
          // All IDs should be unique
          const ids = responses.map(r => r.body.data.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);
          
          return true;
        },
        10
      );
    });
  });
});