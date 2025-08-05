import { Request, Response } from 'express';
export declare class ReportController {
    createReport: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getReports: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getReportById: (req: Request, res: Response, next: import("express").NextFunction) => void;
    assignReport: (req: Request, res: Response, next: import("express").NextFunction) => void;
    updateReportStatus: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getReportStats: (req: Request, res: Response, next: import("express").NextFunction) => void;
}
export declare const reportController: ReportController;
//# sourceMappingURL=report.controller.d.ts.map