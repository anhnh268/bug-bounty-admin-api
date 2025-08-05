import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
export declare class AppError extends Error {
    statusCode: number;
    message: string;
    isOperational: boolean;
    constructor(statusCode: number, message: string, isOperational?: boolean, stack?: string);
}
export declare const notFound: (req: Request, res: Response) => void;
export declare const errorHandler: (err: Error | AppError | ZodError, req: Request, res: Response, _next: NextFunction) => void;
export declare const asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=error.middleware.d.ts.map