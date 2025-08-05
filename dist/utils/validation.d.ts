import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
export declare const validateRequest: <T>(schema: ZodSchema<T>, source?: "body" | "query" | "params") => (req: Request, res: Response, next: NextFunction) => void;
export declare const sanitizeHtml: (input: string) => string;
//# sourceMappingURL=validation.d.ts.map