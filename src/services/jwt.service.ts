import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { IUser } from '../types';
import { config } from '../config/config';
import { AppError } from '../middleware/error.middleware';
import { HTTP_STATUS } from '../constants';

export interface IJwtPayload {
  userId: string;
  email: string;
  role: IUser['role'];
  iat?: number;
  exp?: number;
}

export interface ITokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export class JwtService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;

  constructor() {
    this.accessTokenSecret = config.jwt.accessTokenSecret;
    this.refreshTokenSecret = config.jwt.refreshTokenSecret;
    this.accessTokenExpiry = config.jwt.accessTokenExpiry;
    this.refreshTokenExpiry = config.jwt.refreshTokenExpiry;
  }

  /**
   * Generate JWT token pair (access + refresh)
   */
  generateTokenPair(user: Pick<IUser, 'id' | 'email' | 'role'>): ITokenPair {
    const payload: IJwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'bug-bounty-api',
      audience: 'bug-bounty-client',
    } as jwt.SignOptions);

    const refreshToken = jwt.sign({ userId: user.id }, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiry,
      issuer: 'bug-bounty-api',
      audience: 'bug-bounty-client',
    } as jwt.SignOptions);

    // Calculate expiry date
    const decoded = jwt.decode(accessToken) as jwt.JwtPayload;
    const expiresAt = new Date(decoded.exp! * 1000);

    return {
      accessToken,
      refreshToken,
      expiresAt,
    };
  }

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token: string): IJwtPayload {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: 'bug-bounty-api',
        audience: 'bug-bounty-client',
      }) as IJwtPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Access token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Invalid access token');
      }
      throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Token verification failed');
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): { userId: string } {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'bug-bounty-api',
        audience: 'bug-bounty-client',
      }) as { userId: string };

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Refresh token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Invalid refresh token');
      }
      throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Refresh token verification failed');
    }
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }
}

export const jwtService = new JwtService();
