import { faker } from '@faker-js/faker';
import request from 'supertest';
import { Application } from 'express';
import { ReportStatus, ReportSeverity, CreateReportDto } from '../../src/types/report.types';
import { UserRole } from '../../src/database/entities/user.entity';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  token: string;
}

export interface TestReport {
  id?: string;
  title: string;
  description: string;
  severity: ReportSeverity;
  status?: ReportStatus;
  submittedBy: string;
  category: string;
  affectedAsset: string;
  reproductionSteps?: string[];
  impact?: string;
}

export class TestDataGenerator {
  static generateUser(overrides: Partial<TestUser> = {}): TestUser {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      role: faker.helpers.enumValue(UserRole),
      token: faker.string.alphanumeric(32),
      ...overrides,
    };
  }

  static generateReport(overrides: Partial<TestReport> = {}): TestReport {
    return {
      title: faker.hacker.phrase(),
      description: faker.lorem.paragraphs(2),
      severity: faker.helpers.enumValue(ReportSeverity),
      status: faker.helpers.enumValue(ReportStatus),
      submittedBy: faker.internet.email(),
      category: faker.helpers.arrayElement([
        'SQL Injection',
        'XSS',
        'CSRF',
        'Authentication Bypass',
        'Authorization Issue',
        'Information Disclosure',
        'Remote Code Execution',
        'Privilege Escalation',
      ]),
      affectedAsset: faker.internet.url(),
      reproductionSteps: faker.helpers.multiple(() => faker.lorem.sentence(), { count: { min: 2, max: 6 } }),
      impact: faker.lorem.paragraph(),
      ...overrides,
    };
  }

  static generateCreateReportDto(overrides: Partial<CreateReportDto> = {}): CreateReportDto {
    const report = this.generateReport(overrides);
    return {
      title: report.title,
      description: report.description,
      severity: report.severity,
      category: report.category,
      affectedAsset: report.affectedAsset,
      submittedBy: report.submittedBy,
      reproductionSteps: report.reproductionSteps,
      impact: report.impact,
    };
  }

  static generateReports(count: number, overrides: Partial<TestReport> = {}): TestReport[] {
    return faker.helpers.multiple(() => this.generateReport(overrides), { count });
  }

  // Property-based test generators
  static validReportTitle(): string {
    return faker.helpers.arrayElement([
      faker.hacker.phrase(),
      `${faker.hacker.noun()} ${faker.hacker.verb()}`,
      `${faker.company.name()} ${faker.hacker.abbreviation()} vulnerability`,
      faker.lorem.words({ min: 5, max: 20 }),
    ]);
  }

  static invalidReportTitle(): string {
    return faker.helpers.arrayElement([
      '', // empty
      'a', // too short
      faker.lorem.words(50), // too long
      faker.string.alphanumeric(1), // single character
      faker.string.alphanumeric(201), // exceeds max length
    ]);
  }

  static validDescription(): string {
    return faker.helpers.arrayElement([
      faker.lorem.paragraphs(faker.number.int({ min: 1, max: 5 })),
      faker.lorem.sentences(faker.number.int({ min: 5, max: 20 })),
      `Vulnerability found in ${faker.internet.url()}: ${faker.lorem.paragraph()}`,
    ]);
  }

  static invalidDescription(): string {
    return faker.helpers.arrayElement([
      '', // empty
      'short', // too short
      faker.lorem.words(1000), // too long
      faker.string.alphanumeric(5), // minimum but not descriptive
    ]);
  }

  static validEmail(): string {
    return faker.helpers.arrayElement([
      faker.internet.email(),
      faker.internet.email({ provider: 'security.com' }),
      faker.internet.email({ provider: 'bugbounty.org' }),
      `${faker.internet.userName()}+test@${faker.internet.domainName()}`,
    ]);
  }

  static invalidEmail(): string {
    return faker.helpers.arrayElement([
      'invalid-email',
      '@domain.com',
      'user@',
      'user..user@domain.com',
      'user@domain',
      '',
      faker.lorem.word(),
    ]);
  }

  static validUrl(): string {
    return faker.helpers.arrayElement([
      faker.internet.url(),
      `https://${faker.internet.domainName()}`,
      `http://${faker.internet.domainName()}:${faker.internet.port()}`,
      `https://${faker.internet.domainName()}/api/v1/endpoint`,
    ]);
  }

  static invalidUrl(): string {
    return faker.helpers.arrayElement([
      'not-a-url',
      'ftp://invalid',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      '',
      'www.example.com', // missing protocol
    ]);
  }

  // Generate edge cases for property-based testing
  static edgeCaseStrings(): string[] {
    return [
      '', // empty
      ' ', // whitespace only
      '\n\t\r', // control characters
      '🚀🔥💯', // emojis
      'a'.repeat(1000), // very long
      '\'"; DROP TABLE reports; --', // SQL injection attempt
      '<script>alert("xss")</script>', // XSS attempt
      '../../../etc/passwd', // path traversal
      '{{7*7}}', // template injection
      String.fromCharCode(0), // null byte
    ];
  }

  static edgeCaseNumbers(): number[] {
    return [
      0,
      -1,
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      NaN,
      Math.PI,
      1.23456789,
    ];
  }
}

export class ApiTestHelper {
  constructor(private app: Application) {}

  async createReport(
    reportData: Partial<CreateReportDto> = {},
    token: string = 'test-api-token-123'
  ): Promise<request.Response> {
    const report = TestDataGenerator.generateCreateReportDto(reportData);
    
    return request(this.app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${token}`)
      .send(report);
  }

  async getReports(
    query: Record<string, any> = {},
    token: string = 'test-api-token-123'
  ): Promise<request.Response> {
    return request(this.app)
      .get('/api/v1/reports')
      .query(query)
      .set('Authorization', `Bearer ${token}`);
  }

  async getReport(
    id: string,
    token: string = 'test-api-token-123'
  ): Promise<request.Response> {
    return request(this.app)
      .get(`/api/v1/reports/${id}`)
      .set('Authorization', `Bearer ${token}`);
  }

  async assignReport(
    id: string,
    assigneeId: string,
    token: string = 'test-api-token-123'
  ): Promise<request.Response> {
    return request(this.app)
      .put(`/api/v1/reports/${id}/assign`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assigneeId });
  }

  async updateReportStatus(
    id: string,
    status: ReportStatus,
    token: string = 'test-api-token-123'
  ): Promise<request.Response> {
    return request(this.app)
      .put(`/api/v1/reports/${id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status });
  }

  async getHealth(): Promise<request.Response> {
    return request(this.app).get('/health');
  }

  async getMonitoringHealth(token: string = 'test-api-token-123'): Promise<request.Response> {
    return request(this.app)
      .get('/api/v1/monitoring/health')
      .set('Authorization', `Bearer ${token}`);
  }

  async getMetrics(token: string = 'test-api-token-123'): Promise<request.Response> {
    return request(this.app)
      .get('/api/v1/monitoring/metrics')
      .set('Authorization', `Bearer ${token}`);
  }

  async getCacheStatus(token: string = 'test-api-token-123'): Promise<request.Response> {
    return request(this.app)
      .get('/api/v1/monitoring/cache')
      .set('Authorization', `Bearer ${token}`);
  }
}

export class DatabaseTestHelper {
  static async cleanDatabase(): Promise<void> {
    // This would connect to test database and clean it
    // Implementation depends on your test database setup
  }

  static async seedTestData(): Promise<{ users: TestUser[]; reports: TestReport[] }> {
    // This would seed test database with initial data
    const users = TestDataGenerator.generateUser();
    const reports = TestDataGenerator.generateReports(5);
    
    return { users: [users], reports };
  }
}

export class PropertyBasedTestRunner {
  static async runProperty<T>(
    description: string,
    generator: () => T,
    predicate: (input: T) => Promise<boolean>,
    iterations: number = 100
  ): Promise<void> {
    const failures: { input: T; error: Error }[] = [];
    
    for (let i = 0; i < iterations; i++) {
      try {
        const input = generator();
        const result = await predicate(input);
        
        if (!result) {
          failures.push({
            input,
            error: new Error(`Property violated for input: ${JSON.stringify(input)}`),
          });
        }
      } catch (error) {
        failures.push({
          input: generator(),
          error: error as Error,
        });
      }
    }
    
    if (failures.length > 0) {
      const errorMessage = `Property "${description}" failed ${failures.length}/${iterations} times:\n${
        failures.slice(0, 5).map(f => `  - ${f.error.message}`).join('\n')
      }${failures.length > 5 ? `\n  ... and ${failures.length - 5} more` : ''}`;
      
      throw new Error(errorMessage);
    }
  }
}

export const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

export const expectEventuallyTrue = async (
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await delay(interval);
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
};

// Assertion helpers
export const expectValidApiResponse = (response: request.Response): void => {
  expect(response.body).toHaveProperty('success');
  expect(response.body).toHaveProperty('data');
  
  if (response.body.success === false) {
    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('message');
  }
};

export const expectValidReport = (report: any): void => {
  expect(report).toHaveProperty('id');
  expect(report).toHaveProperty('title');
  expect(report).toHaveProperty('description');
  expect(report).toHaveProperty('severity');
  expect(report).toHaveProperty('status');
  expect(report).toHaveProperty('submittedBy');
  expect(report).toHaveProperty('createdAt');
  expect(report).toHaveProperty('updatedAt');
  
  expect(typeof report.id).toBe('string');
  expect(typeof report.title).toBe('string');
  expect(typeof report.description).toBe('string');
  expect(Object.values(ReportSeverity)).toContain(report.severity);
  expect(Object.values(ReportStatus)).toContain(report.status);
};

export const expectValidPaginatedResponse = (response: any): void => {
  expect(response).toHaveProperty('items');
  expect(response).toHaveProperty('total');
  expect(response).toHaveProperty('page');
  expect(response).toHaveProperty('limit');
  expect(response).toHaveProperty('totalPages');
  expect(response).toHaveProperty('hasNext');
  expect(response).toHaveProperty('hasPrev');
  
  expect(Array.isArray(response.items)).toBe(true);
  expect(typeof response.total).toBe('number');
  expect(typeof response.page).toBe('number');
  expect(typeof response.limit).toBe('number');
  expect(typeof response.totalPages).toBe('number');
  expect(typeof response.hasNext).toBe('boolean');
  expect(typeof response.hasPrev).toBe('boolean');
};