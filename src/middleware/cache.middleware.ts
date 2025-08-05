import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../services/cache.service';
import { StructuredLogger } from '../utils/structured-logger';

interface CacheMiddlewareOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request, res: Response) => boolean;
  vary?: string[];
  skipCache?: (req: Request) => boolean;
}

const cache = CacheService.getInstance();
const logger = new StructuredLogger();

export const cacheMiddleware = (options: CacheMiddlewareOptions = {}) => {
  const {
    ttl = 300,
    keyGenerator = defaultKeyGenerator,
    condition = defaultCondition,
    vary = [],
    skipCache = () => false,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip caching for non-GET requests or when skipCache returns true
    if (req.method !== 'GET' || skipCache(req)) {
      return next();
    }

    const cacheKey = keyGenerator(req);

    try {
      // Try to get cached response
      const cachedResponse = await cache.get<{
        data: any;
        headers: Record<string, string>;
        statusCode: number;
      }>(cacheKey, { prefix: 'response' });

      if (cachedResponse) {
        // Set cached headers
        Object.entries(cachedResponse.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        // Add cache headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', `max-age=${ttl}`);

        logger.debug('Cache hit', {
          key: cacheKey,
          method: req.method,
          path: req.path,
        });

        res.status(cachedResponse.statusCode).json(cachedResponse.data);
        return;
      }

      // Cache miss - proceed with request and cache response
      res.setHeader('X-Cache', 'MISS');

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function (data: any) {
        // Only cache successful responses
        if (condition(req, res) && res.statusCode >= 200 && res.statusCode < 300) {
          const responseToCache = {
            data,
            headers: extractCacheableHeaders(res, vary),
            statusCode: res.statusCode,
          };

          // Cache asynchronously to avoid blocking the response
          cache
            .set(cacheKey, responseToCache, {
              prefix: 'response',
              ttl,
            })
            .catch((error) => {
              logger.warn('Failed to cache response', {
                key: cacheKey,
                error,
              });
            });

          logger.debug('Response cached', {
            key: cacheKey,
            method: req.method,
            path: req.path,
            ttl,
          });
        }

        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error', error as Error, { key: cacheKey });
      // Continue without caching on error
      next();
    }
  };
};

function defaultKeyGenerator(req: Request): string {
  const userId = req.user?.id || 'anonymous';
  const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
  const baseKey = `${req.method}:${req.path}`;

  if (queryString) {
    return `${baseKey}:${queryString}:user:${userId}`;
  }

  return `${baseKey}:user:${userId}`;
}

function defaultCondition(_req: Request, res: Response): boolean {
  // Don't cache error responses or responses with no-cache headers
  return res.statusCode < 400 && !res.getHeader('Cache-Control')?.toString().includes('no-cache');
}

function extractCacheableHeaders(res: Response, vary: string[]): Record<string, string> {
  const headers: Record<string, string> = {};

  // Include specified headers in vary
  vary.forEach((headerName) => {
    const value = res.getHeader(headerName);
    if (value) {
      headers[headerName] = value.toString();
    }
  });

  // Always include content-type
  const contentType = res.getHeader('Content-Type');
  if (contentType) {
    headers['Content-Type'] = contentType.toString();
  }

  return headers;
}

// Specific middleware for different cache strategies
export const shortCache = cacheMiddleware({ ttl: 60 }); // 1 minute
export const mediumCache = cacheMiddleware({ ttl: 300 }); // 5 minutes
export const longCache = cacheMiddleware({ ttl: 3600 }); // 1 hour

// Cache for reports list with custom key generation
export const reportsListCache = cacheMiddleware({
  ttl: 300,
  keyGenerator: (req) => {
    const { status, severity, page, limit, sortBy, sortOrder } = req.query;
    const params = { status, severity, page, limit, sortBy, sortOrder };
    const queryHash = Buffer.from(JSON.stringify(params)).toString('base64');
    return `reports:list:${queryHash}`;
  },
  condition: (req, res) => {
    // Only cache successful responses with standard pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    return res.statusCode === 200 && page <= 10 && limit <= 100;
  },
});

// Cache for report stats
export const reportStatsCache = cacheMiddleware({
  ttl: 180, // 3 minutes
  keyGenerator: () => 'reports:stats',
});

// Cache for individual reports
export const reportDetailCache = cacheMiddleware({
  ttl: 600, // 10 minutes
  keyGenerator: (req) => `reports:detail:${req.params.id}`,
});

// Cache invalidation middleware
export const invalidateCache = (patterns: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Store original res.json
    const originalJson = res.json;

    res.json = function (data: any) {
      // Invalidate cache patterns after successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        patterns.forEach(async (pattern) => {
          try {
            const count = await cache.invalidatePattern(pattern);
            logger.debug('Cache invalidated', {
              pattern,
              count,
              method: req.method,
              path: req.path,
            });
          } catch (error) {
            logger.warn('Cache invalidation failed', {
              pattern,
              error: error as Error,
            });
          }
        });
      }

      return originalJson.call(this, data);
    };

    next();
  };
};

// Specific cache invalidation for reports
export const invalidateReportsCache = invalidateCache([
  'response:reports:*',
  'response:reports:stats',
]);

// Response compression middleware for cached responses
export const compressedCache = cacheMiddleware({
  ttl: 600,
  keyGenerator: (req) => {
    const acceptEncoding = req.get('Accept-Encoding') || '';
    const baseKey = defaultKeyGenerator(req);
    return `${baseKey}:encoding:${Buffer.from(acceptEncoding).toString('base64')}`;
  },
  vary: ['Accept-Encoding'],
});
