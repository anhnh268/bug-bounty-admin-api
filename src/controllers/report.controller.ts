import { Request, Response } from 'express';
import { reportService } from '../services/service.factory';
import { IApiResponse, IReport } from '../types';
import { asyncHandler } from '../middleware/error.middleware';
import { CreateReportDto, ListReportsQueryDto, AssignReportDto } from '../dtos/report.dto';
import { HTTP_STATUS } from '../constants';

/**
 * @swagger
 * tags:
 *   - name: Reports
 *     description: Bug report management operations
 */
export class ReportController {
  /**
   * @swagger
   * /api/v1/reports:
   *   post:
   *     summary: Submit a new vulnerability report
   *     description: Creates a new bug report with vulnerability details
   *     tags: [Reports]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateReportRequest'
   *           example:
   *             title: "SQL Injection in User Login"
   *             description: "The login endpoint allows SQL injection through the username parameter"
   *             severity: "high"
   *             category: "SQL Injection"
   *             affectedAsset: "https://example.com/api/auth/login"
   *             submittedBy: "researcher@example.com"
   *             reproductionSteps:
   *               - "Navigate to /api/auth/login"
   *               - "Submit username: admin' OR '1'='1"
   *               - "Observe successful login bypass"
   *             impact: "Attackers can bypass authentication and access user accounts"
   *     responses:
   *       201:
   *         description: Report created successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/Report'
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       403:
   *         description: Forbidden - Insufficient permissions
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  createReport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data = req.body as CreateReportDto;
    const report = await reportService.createReport(data, req.context);

    const response: IApiResponse = {
      success: true,
      data: report,
      message: 'Report created successfully',
    };

    res.status(HTTP_STATUS.CREATED).json(response);
  });

  /**
   * @swagger
   * /api/v1/reports:
   *   get:
   *     summary: List vulnerability reports
   *     description: Retrieve a paginated list of vulnerability reports with optional filtering
   *     tags: [Reports]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, triaged, in_progress, resolved, rejected]
   *         description: Filter by report status
   *         example: pending
   *       - in: query
   *         name: severity
   *         schema:
   *           type: string
   *           enum: [critical, high, medium, low]
   *         description: Filter by severity level
   *         example: high
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number for pagination
   *         example: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Number of reports per page
   *         example: 20
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [submittedAt, severity, status]
   *           default: submittedAt
   *         description: Field to sort by
   *         example: submittedAt
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: desc
   *         description: Sort order
   *         example: desc
   *     responses:
   *       200:
   *         description: Reports retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/PaginatedReports'
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  getReports = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ListReportsQueryDto;
    const result = await reportService.listReports(query, req.context);

    const response: IApiResponse = {
      success: true,
      data: result,
    };

    res.status(HTTP_STATUS.OK).json(response);
  });

  /**
   * @swagger
   * /api/v1/reports/{id}:
   *   get:
   *     summary: Get a specific report
   *     description: Retrieve detailed information about a specific vulnerability report
   *     tags: [Reports]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Report UUID
   *         example: 550e8400-e29b-41d4-a716-446655440000
   *     responses:
   *       200:
   *         description: Report retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/Report'
   *       404:
   *         description: Report not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  getReportById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const report = await reportService.getReportById(id, req.context);

    const response: IApiResponse = {
      success: true,
      data: report,
    };

    res.status(HTTP_STATUS.OK).json(response);
  });

  /**
   * @swagger
   * /api/v1/reports/{id}/assign:
   *   put:
   *     summary: Assign a report to a triager
   *     description: Assign a vulnerability report to a specific user for triage
   *     tags: [Reports]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Report UUID
   *         example: 550e8400-e29b-41d4-a716-446655440000
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AssignReportRequest'
   *           example:
   *             assigneeId: "550e8400-e29b-41d4-a716-446655440001"
   *     responses:
   *       200:
   *         description: Report assigned successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/Report'
   *       400:
   *         description: Cannot assign resolved/rejected reports
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: Report not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       403:
   *         description: Forbidden - Insufficient permissions
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  assignReport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { assigneeId } = req.body as AssignReportDto;

    const report = await reportService.assignReport(id, assigneeId, req.context);

    const response: IApiResponse = {
      success: true,
      data: report,
      message: 'Report assigned successfully',
    };

    res.status(HTTP_STATUS.OK).json(response);
  });

  /**
   * @swagger
   * /api/v1/reports/{id}/status:
   *   put:
   *     summary: Update report status
   *     description: Update the status of a vulnerability report
   *     tags: [Reports]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Report UUID
   *         example: 550e8400-e29b-41d4-a716-446655440000
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateStatusRequest'
   *           example:
   *             status: "triaged"
   *     responses:
   *       200:
   *         description: Report status updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/ApiResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/Report'
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: Report not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       403:
   *         description: Forbidden - Insufficient permissions
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  updateReportStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { status } = req.body as { status: IReport['status'] };

    const report = await reportService.updateReportStatus(id, status, req.context);

    const response: IApiResponse = {
      success: true,
      data: report,
      message: 'Report status updated successfully',
    };

    res.status(HTTP_STATUS.OK).json(response);
  });

  /**
   * @swagger
   * /api/v1/reports/stats:
   *   get:
   *     summary: Get report statistics
   *     description: Retrieve statistics showing the count of reports by status
   *     tags: [Reports]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Statistics retrieved successfully
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
   *                         pending:
   *                           type: integer
   *                           example: 15
   *                         triaged:
   *                           type: integer
   *                           example: 8
   *                         in_progress:
   *                           type: integer
   *                           example: 12
   *                         resolved:
   *                           type: integer
   *                           example: 45
   *                         rejected:
   *                           type: integer
   *                           example: 3
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  getReportStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await reportService.getReportStats(req.context);

    const response: IApiResponse = {
      success: true,
      data: stats,
    };

    res.status(HTTP_STATUS.OK).json(response);
  });
}

export const reportController = new ReportController();
