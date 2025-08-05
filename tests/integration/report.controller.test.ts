import request from 'supertest';
import app from '../../src/app';
import { reportRepository } from '../../src/repositories/report.repository';
import { InMemoryReportRepository } from '../../src/repositories/report.repository';

describe('Report Controller Integration Tests', () => {
  const validToken = 'test-api-token-123';
  const authHeader = { Authorization: `Bearer ${validToken}` };

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the in-memory repository
    const inMemoryRepo = reportRepository as InMemoryReportRepository;
    (inMemoryRepo as any).reports.clear();
  });

  describe('POST /api/v1/reports', () => {
    const validReport = {
      title: 'SQL Injection in Login Form',
      description: 'SQL injection vulnerability discovered in the login form',
      severity: 'critical',
      category: 'SQL Injection',
      affectedAsset: 'https://example.com/login',
      submittedBy: 'security@example.com',
      reproductionSteps: ['Go to login page', 'Enter SQL payload', 'Observe error'],
      impact: 'Potential database compromise',
    };

    it('should create a new report with valid data', async () => {
      const response = await request(app)
        .post('/api/v1/reports')
        .set(authHeader)
        .send(validReport)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        title: validReport.title,
        severity: validReport.severity,
        status: 'pending',
      });
      expect(response.body.data.id).toBeDefined();
    });

    it('should reject invalid report data', async () => {
      const invalidReport = {
        title: 'XSS',
        severity: 'invalid-severity',
      };

      const response = await request(app)
        .post('/api/v1/reports')
        .set(authHeader)
        .send(invalidReport)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/reports')
        .send(validReport)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('GET /api/v1/reports', () => {
    beforeEach(async () => {
      const reports = [
        {
          title: 'Report 1',
          description: 'Description 1',
          severity: 'high' as const,
          category: 'XSS',
          affectedAsset: 'asset1',
          submittedBy: 'user1@example.com',
        },
        {
          title: 'Report 2',
          description: 'Description 2',
          severity: 'critical' as const,
          category: 'SQL',
          affectedAsset: 'asset2',
          submittedBy: 'user2@example.com',
        },
      ];

      for (const report of reports) {
        await reportRepository.create(report);
      }
    });

    it('should list all reports with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/reports')
        .set(authHeader)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.page).toBe(1);
    });

    it('should filter reports by status', async () => {
      const response = await request(app)
        .get('/api/v1/reports')
        .set(authHeader)
        .query({ status: 'pending' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items.every((r: any) => r.status === 'pending')).toBe(true);
    });
  });

  describe('PUT /api/v1/reports/:id/assign', () => {
    let reportId: string;

    beforeEach(async () => {
      const report = await reportRepository.create({
        title: 'Test Report',
        description: 'Test description',
        severity: 'high',
        category: 'Test',
        affectedAsset: 'test-asset',
        submittedBy: 'test@example.com',
      });
      reportId = report.id;
    });

    it('should assign a report to a user', async () => {
      const response = await request(app)
        .put(`/api/v1/reports/${reportId}/assign`)
        .set(authHeader)
        .send({ assigneeId: '550e8400-e29b-41d4-a716-446655440000' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assignedTo).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(response.body.data.status).toBe('triaged');
    });

    it('should validate assignee ID format', async () => {
      const response = await request(app)
        .put(`/api/v1/reports/${reportId}/assign`)
        .set(authHeader)
        .send({ assigneeId: 'invalid-uuid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });
});