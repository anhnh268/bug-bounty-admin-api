import { Request, Response } from 'express';
import { AuditService, AuditQuery, AuditEventType, AuditSeverity } from '../services/audit.service';
import { asyncHandler } from '../middleware/error.middleware';
import { HTTP_STATUS } from '../constants';

export class AuditController {
  private auditService = AuditService.getInstance();

  /**
   * @swagger
   * /api/v1/audit/events:
   *   get:
   *     summary: Query audit events
   *     description: Retrieve audit events with optional filtering and pagination
   *     tags: [Audit]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: eventType
   *         schema:
   *           type: string
   *           enum: [login_success, login_failure, data_read, data_create, data_update, security_violation]
   *         description: Filter by event type
   *       - in: query
   *         name: severity
   *         schema:
   *           type: string
   *           enum: [info, warning, error, critical]
   *         description: Filter by severity level
   *       - in: query
   *         name: userId
   *         schema:
   *           type: string
   *         description: Filter by user ID
   *       - in: query
   *         name: ipAddress
   *         schema:
   *           type: string
   *         description: Filter by IP address
   *       - in: query
   *         name: resource
   *         schema:
   *           type: string
   *         description: Filter by resource
   *       - in: query
   *         name: outcome
   *         schema:
   *           type: string
   *           enum: [success, failure, denied]
   *         description: Filter by outcome
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Start date for time range filter
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: End date for time range filter
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 1000
   *           default: 100
   *         description: Maximum number of events to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *         description: Number of events to skip
   *     responses:
   *       200:
   *         description: Audit events retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       type: object
   *                       properties:
   *                         events:
   *                           type: array
   *                           items:
   *                             type: object
   *                             properties:
   *                               eventType:
   *                                 type: string
   *                               severity:
   *                                 type: string
   *                               userId:
   *                                 type: string
   *                               userEmail:
   *                                 type: string
   *                               ipAddress:
   *                                 type: string
   *                               resource:
   *                                 type: string
   *                               action:
   *                                 type: string
   *                               outcome:
   *                                 type: string
   *                               timestamp:
   *                                 type: string
   *                                 format: date-time
   *                               details:
   *                                 type: object
   *                         totalCount:
   *                           type: integer
   *                         hasMore:
   *                           type: boolean
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       403:
   *         description: Forbidden - Admin access required
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  getAuditEvents = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query: AuditQuery = {
      eventType: req.query.eventType as AuditEventType,
      severity: req.query.severity as AuditSeverity,
      userId: req.query.userId as string,
      ipAddress: req.query.ipAddress as string,
      resource: req.query.resource as string,
      outcome: req.query.outcome as 'success' | 'failure' | 'denied',
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    // Validate date ranges
    if (query.startDate && isNaN(query.startDate.getTime())) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Invalid startDate format',
        message: 'startDate must be a valid ISO date string',
      });
      return;
    }

    if (query.endDate && isNaN(query.endDate.getTime())) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Invalid endDate format',
        message: 'endDate must be a valid ISO date string',
      });
      return;
    }

    // Validate limit
    if (query.limit && (query.limit < 1 || query.limit > 1000)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Invalid limit',
        message: 'limit must be between 1 and 1000',
      });
      return;
    }

    const result = await this.auditService.queryEvents(query);

    const response = {
      success: true,
      data: result,
    };

    res.status(HTTP_STATUS.OK).json(response);
  });

  /**
   * @swagger
   * /api/v1/audit/summary:
   *   get:
   *     summary: Get audit summary
   *     description: Retrieve aggregated audit statistics and summary
   *     tags: [Audit]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Start date for summary period
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: End date for summary period
   *     responses:
   *       200:
   *         description: Audit summary retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       type: object
   *                       properties:
   *                         totalEvents:
   *                           type: integer
   *                         eventsByType:
   *                           type: object
   *                           additionalProperties:
   *                             type: integer
   *                         eventsBySeverity:
   *                           type: object
   *                           additionalProperties:
   *                             type: integer
   *                         securityIncidents:
   *                           type: integer
   *                         topUsers:
   *                           type: array
   *                           items:
   *                             type: object
   *                             properties:
   *                               userId:
   *                                 type: string
   *                               eventCount:
   *                                 type: integer
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin access required
   */
  getAuditSummary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    let timeRange: { start: Date; end: Date } | undefined;

    if (req.query.startDate || req.query.endDate) {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      if (startDate && isNaN(startDate.getTime())) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'Invalid startDate format',
          message: 'startDate must be a valid ISO date string',
        });
        return;
      }

      if (endDate && isNaN(endDate.getTime())) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'Invalid endDate format',
          message: 'endDate must be a valid ISO date string',
        });
        return;
      }

      if (startDate && endDate) {
        timeRange = { start: startDate, end: endDate };
      }
    }

    const summary = await this.auditService.getSummary(timeRange);

    const response = {
      success: true,
      data: summary,
    };

    res.status(HTTP_STATUS.OK).json(response);
  });

  /**
   * @swagger
   * /api/v1/audit/security-incidents:
   *   get:
   *     summary: Get security incidents
   *     description: Retrieve security-related audit events
   *     tags: [Audit]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Start date for incident search
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: End date for incident search
   *     responses:
   *       200:
   *         description: Security incidents retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           eventType:
   *                             type: string
   *                           severity:
   *                             type: string
   *                           userId:
   *                             type: string
   *                           ipAddress:
   *                             type: string
   *                           timestamp:
   *                             type: string
   *                             format: date-time
   *                           details:
   *                             type: object
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin access required
   */
  getSecurityIncidents = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    let timeRange: { start: Date; end: Date } | undefined;

    if (req.query.startDate || req.query.endDate) {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      if (startDate && endDate) {
        timeRange = { start: startDate, end: endDate };
      }
    }

    const incidents = await this.auditService.getSecurityIncidents(timeRange);

    const response = {
      success: true,
      data: incidents,
    };

    res.status(HTTP_STATUS.OK).json(response);
  });

  /**
   * @swagger
   * /api/v1/audit/users/{userId}/activity:
   *   get:
   *     summary: Get user activity
   *     description: Retrieve audit events for a specific user
   *     tags: [Audit]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID to query activity for
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Start date for activity search
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: End date for activity search
   *     responses:
   *       200:
   *         description: User activity retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           eventType:
   *                             type: string
   *                           resource:
   *                             type: string
   *                           action:
   *                             type: string
   *                           outcome:
   *                             type: string
   *                           timestamp:
   *                             type: string
   *                             format: date-time
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin access required
   */
  getUserActivity = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;

    if (!userId) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Missing userId parameter',
        message: 'userId is required',
      });
      return;
    }

    let timeRange: { start: Date; end: Date } | undefined;

    if (req.query.startDate || req.query.endDate) {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      if (startDate && endDate) {
        timeRange = { start: startDate, end: endDate };
      }
    }

    const activity = await this.auditService.getUserActivity(userId, timeRange);

    const response = {
      success: true,
      data: activity,
    };

    res.status(HTTP_STATUS.OK).json(response);
  });

  /**
   * @swagger
   * /api/v1/audit/health:
   *   get:
   *     summary: Get audit service health
   *     description: Check the health status of the audit logging system
   *     tags: [Audit]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Audit service health retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       type: object
   *                       properties:
   *                         status:
   *                           type: string
   *                           enum: [healthy, degraded, unhealthy]
   *                         eventCount:
   *                           type: integer
   *                         oldestEvent:
   *                           type: string
   *                           format: date-time
   *                         newestEvent:
   *                           type: string
   *                           format: date-time
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin access required
   */
  getAuditHealth = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const health = this.auditService.getHealth();

    const response = {
      success: true,
      data: health,
    };

    res.status(HTTP_STATUS.OK).json(response);
  });

  /**
   * @swagger
   * /api/v1/audit/export:
   *   post:
   *     summary: Export audit events
   *     description: Export audit events in various formats (CSV, JSON)
   *     tags: [Audit]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               format:
   *                 type: string
   *                 enum: [csv, json]
   *                 default: csv
   *               filters:
   *                 type: object
   *                 properties:
   *                   eventType:
   *                     type: string
   *                   severity:
   *                     type: string
   *                   startDate:
   *                     type: string
   *                     format: date-time
   *                   endDate:
   *                     type: string
   *                     format: date-time
   *                   userId:
   *                     type: string
   *     responses:
   *       200:
   *         description: Audit events exported successfully
   *         content:
   *           application/octet-stream:
   *             schema:
   *               type: string
   *               format: binary
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin access required
   */
  exportAuditEvents = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { format = 'csv', filters = {} } = req.body;

    if (!['csv', 'json'].includes(format)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Invalid format',
        message: 'format must be either csv or json',
      });
      return;
    }

    const query: AuditQuery = {
      eventType: filters.eventType,
      severity: filters.severity,
      userId: filters.userId,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      limit: 10000, // Max export limit
    };

    const result = await this.auditService.queryEvents(query);
    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit-events-${timestamp}.json"`);
      res.status(HTTP_STATUS.OK).json(result.events);
    } else {
      // CSV format
      const csvHeaders = [
        'Timestamp',
        'Event Type',
        'Severity',
        'User ID',
        'User Email',
        'IP Address',
        'Resource',
        'Action',
        'Outcome',
        'Details',
      ];

      const csvRows = result.events.map((event) => [
        event.timestamp.toISOString(),
        event.eventType,
        event.severity,
        event.userId || '',
        event.userEmail || '',
        event.ipAddress || '',
        event.resource || '',
        event.action || '',
        event.outcome,
        JSON.stringify(event.details || {}),
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map((row) => row.map((field) => `"${field}"`).join(',')),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-events-${timestamp}.csv"`);
      res.status(HTTP_STATUS.OK).send(csvContent);
    }
  });
}

export const auditController = new AuditController();
