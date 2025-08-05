import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { IApiResponse } from '../types';

export const validateRequest = <T>(
  schema: ZodSchema<T>,
  source: 'body' | 'query' | 'params' = 'body',
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = schema.parse(req[source]);
      req[source] = data;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const response: IApiResponse = {
          success: false,
          error: 'Validation failed',
          message: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        };
        res.status(400).json(response);
        return;
      }
      next(error);
    }
  };
};

export const sanitizeHtml = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};
