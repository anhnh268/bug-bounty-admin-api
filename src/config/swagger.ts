import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bug Bounty Admin API',
      version: '1.0.0',
      description: `
        A comprehensive backend API for managing bug bounty reports and vulnerability assessments.
        
        This API demonstrates enterprise-grade TypeScript development with clean architecture,
        proper authentication, validation, and error handling.
        
        ## Features
        - JWT-based authentication
        - Role-based authorization
        - Input validation with Zod
        - Structured error handling
        - Request logging and tracing
        - Comprehensive test coverage
      `,
      contact: {
        name: 'Bug Bounty Admin Team',
        email: 'admin@bugbounty.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
      {
        url: 'https://api.bugbounty.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your API token',
        },
      },
      schemas: {
        Report: {
          type: 'object',
          required: [
            'id',
            'title',
            'description',
            'severity',
            'status',
            'submittedBy',
            'submittedAt',
            'category',
            'affectedAsset',
          ],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique identifier for the report',
              example: '550e8400-e29b-41d4-a716-446655440000',
            },
            title: {
              type: 'string',
              minLength: 5,
              maxLength: 200,
              description: 'Brief title of the vulnerability',
              example: 'SQL Injection in User Login',
            },
            description: {
              type: 'string',
              minLength: 10,
              maxLength: 5000,
              description: 'Detailed description of the vulnerability',
              example: 'The login endpoint is vulnerable to SQL injection attacks...',
            },
            severity: {
              type: 'string',
              enum: ['critical', 'high', 'medium', 'low'],
              description: 'Severity level of the vulnerability',
              example: 'high',
            },
            status: {
              type: 'string',
              enum: ['pending', 'triaged', 'in_progress', 'resolved', 'rejected'],
              description: 'Current status of the report',
              example: 'pending',
            },
            submittedBy: {
              type: 'string',
              format: 'email',
              description: 'Email of the researcher who submitted the report',
              example: 'researcher@example.com',
            },
            submittedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when the report was submitted',
              example: '2024-01-15T10:30:00Z',
            },
            assignedTo: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the assigned triager',
              example: '550e8400-e29b-41d4-a716-446655440001',
              nullable: true,
            },
            assignedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when the report was assigned',
              example: '2024-01-15T11:00:00Z',
              nullable: true,
            },
            category: {
              type: 'string',
              description: 'Category of the vulnerability',
              example: 'SQL Injection',
            },
            affectedAsset: {
              type: 'string',
              description: 'The affected asset or URL',
              example: 'https://example.com/login',
            },
            reproductionSteps: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Step-by-step reproduction instructions',
              example: [
                '1. Navigate to login page',
                '2. Enter malicious payload',
                '3. Observe results',
              ],
            },
            impact: {
              type: 'string',
              maxLength: 1000,
              description: 'Description of the potential impact',
              example: 'Attacker could gain unauthorized access to user accounts',
            },
          },
        },
        CreateReportRequest: {
          type: 'object',
          required: [
            'title',
            'description',
            'severity',
            'category',
            'affectedAsset',
            'submittedBy',
          ],
          properties: {
            title: {
              type: 'string',
              minLength: 5,
              maxLength: 200,
              example: 'SQL Injection in User Login',
            },
            description: {
              type: 'string',
              minLength: 10,
              maxLength: 5000,
              example: 'The login endpoint is vulnerable to SQL injection attacks...',
            },
            severity: {
              type: 'string',
              enum: ['critical', 'high', 'medium', 'low'],
              example: 'high',
            },
            category: {
              type: 'string',
              example: 'SQL Injection',
            },
            affectedAsset: {
              type: 'string',
              example: 'https://example.com/login',
            },
            submittedBy: {
              type: 'string',
              format: 'email',
              example: 'researcher@example.com',
            },
            reproductionSteps: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: [
                '1. Navigate to login page',
                '2. Enter malicious payload',
                '3. Observe results',
              ],
            },
            impact: {
              type: 'string',
              maxLength: 1000,
              example: 'Attacker could gain unauthorized access to user accounts',
            },
          },
        },
        AssignReportRequest: {
          type: 'object',
          required: ['assigneeId'],
          properties: {
            assigneeId: {
              type: 'string',
              format: 'uuid',
              description: 'UUID of the user to assign the report to',
              example: '550e8400-e29b-41d4-a716-446655440001',
            },
          },
        },
        UpdateStatusRequest: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['pending', 'triaged', 'in_progress', 'resolved', 'rejected'],
              example: 'triaged',
            },
          },
        },
        PaginatedReports: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Report',
              },
            },
            total: {
              type: 'integer',
              description: 'Total number of reports',
              example: 100,
            },
            page: {
              type: 'integer',
              description: 'Current page number',
              example: 1,
            },
            limit: {
              type: 'integer',
              description: 'Number of reports per page',
              example: 20,
            },
            totalPages: {
              type: 'integer',
              description: 'Total number of pages',
              example: 5,
            },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Indicates if the request was successful',
            },
            data: {
              description: 'Response data (varies by endpoint)',
            },
            message: {
              type: 'string',
              description: 'Optional success message',
            },
            error: {
              type: 'string',
              description: 'Error type (only present on failure)',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Validation Error',
            },
            message: {
              type: 'string',
              example: 'title: String must contain at least 5 character(s)',
            },
          },
        },
        HealthCheck: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  example: 'healthy',
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-01-15T10:30:00Z',
                },
                environment: {
                  type: 'string',
                  example: 'development',
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: ['./src/controllers/*.ts', './src/app.ts'], // paths to files containing OpenAPI definitions
};

export const swaggerSpec = swaggerJsdoc(options);
