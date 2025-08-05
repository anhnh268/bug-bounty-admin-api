import { Request, Response, NextFunction } from 'express';
import { config } from '../config/config';
import { IApiResponse, IUser } from '../types';
import { jwtService, IJwtPayload } from '../services/jwt.service';
import { AppError } from './error.middleware';
import { HTTP_STATUS, ERROR_MESSAGES } from '../constants';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

/**
 * JWT-based authentication middleware
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = jwtService.extractTokenFromHeader(authHeader);

    if (!token) {
      const response: IApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: ERROR_MESSAGES.NO_TOKEN,
      };
      res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
      return;
    }

    // For backward compatibility, also accept the legacy API token
    if (token === config.apiToken) {
      req.user = {
        id: 'legacy-admin-user-id',
        email: 'admin@bugbounty.com',
        role: 'admin',
      };
      next();
      return;
    }

    // Verify JWT token
    const payload: IJwtPayload = jwtService.verifyAccessToken(token);

    // Create user object from JWT payload
    req.user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    logger.debug('User authenticated via JWT', {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    });

    next();
  } catch (error) {
    if (error instanceof AppError) {
      const response: IApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: error.message,
      };
      res.status(error.statusCode).json(response);
      return;
    }

    logger.error('Authentication error', error as Error, {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    const response: IApiResponse = {
      success: false,
      error: 'Unauthorized',
      message: ERROR_MESSAGES.INVALID_TOKEN,
    };
    res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
  }
};

/**
 * Role-based authorization middleware
 */
export const authorize = (...allowedRoles: IUser['role'][]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const response: IApiResponse = {
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      };
      res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Insufficient permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
        method: req.method,
      });

      const response: IApiResponse = {
        success: false,
        error: 'Forbidden',
        message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
      };
      res.status(HTTP_STATUS.FORBIDDEN).json(response);
      return;
    }

    next();
  };
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuthenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = jwtService.extractTokenFromHeader(authHeader);

    if (token) {
      const payload: IJwtPayload = jwtService.verifyAccessToken(token);
      req.user = {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
      };
    }

    next();
  } catch (error) {
    // Continue without authentication for optional endpoints
    next();
  }
};
