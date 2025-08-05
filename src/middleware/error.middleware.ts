import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { isDevelopment } from '../config/config';
import { IApiResponse } from '../types';
import { logger } from '../utils/logger';
import { ERROR_MESSAGES, HTTP_STATUS } from '../constants';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true,
    stack = '',
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export const notFound = (req: Request, res: Response): void => {
  logger.warn('404 - Not Found', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  const response: IApiResponse = {
    success: false,
    error: 'Not Found',
    message: 'The requested resource was not found',
  };
  res.status(HTTP_STATUS.NOT_FOUND).json(response);
};

export const errorHandler = (
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let message: string = ERROR_MESSAGES.INTERNAL_ERROR;
  let error = 'Server Error';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    error = err.name;
  } else if (err instanceof ZodError) {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    error = 'Validation Error';
    message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  } else if (err instanceof Error) {
    message = isDevelopment ? err.message : 'Something went wrong';
  }

  logger.error('Request error', err, {
    method: req.method,
    path: req.path,
    statusCode,
    userId: req.context?.user?.id,
    requestId: req.context?.requestId,
  });

  const response: IApiResponse = {
    success: false,
    error,
    message,
  };

  if (isDevelopment && err instanceof Error) {
    (response as any).stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
