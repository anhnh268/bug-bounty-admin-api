import Redis from 'ioredis';
import { StructuredLogger } from '../utils/structured-logger';
import { MetricsCollector } from '../monitoring/metrics';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  compress?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

export class CacheService {
  private static instance: CacheService;
  private redis: Redis;
  private logger = new StructuredLogger();
  private metricsCollector = MetricsCollector.getInstance();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };
  private isConnected = false;
  private readonly defaultTTL = 300; // 5 minutes
  private readonly keyPrefix = 'bug-bounty:';

  private constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      lazyConnect: true,
      keyPrefix: this.keyPrefix,
    });

    this.setupEventHandlers();
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      this.isConnected = true;
      this.logger.info('Redis connected successfully');
    });

    this.redis.on('error', (error: Error) => {
      this.isConnected = false;
      this.stats.errors++;
      this.logger.error('Redis connection error', error);
      this.metricsCollector.recordMetric('cache_errors_total', 1, 'count', {
        error_type: error.name,
      });
    });

    this.redis.on('reconnecting', () => {
      this.logger.warn('Redis reconnecting...');
    });

    this.redis.on('ready', () => {
      this.isConnected = true;
      this.logger.info('Redis ready for operations');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.redis.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error as Error);
      // Continue without cache if Redis is unavailable
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.redis.disconnect();
      this.isConnected = false;
      this.logger.info('Redis disconnected');
    }
  }

  private buildKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  private async executeWithFallback<T>(operation: () => Promise<T>, fallback: () => T): Promise<T> {
    if (!this.isConnected) {
      return fallback();
    }

    try {
      return await operation();
    } catch (error) {
      this.stats.errors++;
      this.logger.warn('Cache operation failed, using fallback', { error: error as Error });
      return fallback();
    }
  }

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    return this.executeWithFallback(
      async () => {
        const fullKey = this.buildKey(key, options.prefix);
        const startTime = Date.now();

        const result = await this.redis.get(fullKey);
        const duration = Date.now() - startTime;

        this.metricsCollector.recordMetric('cache_operation_duration', duration, 'milliseconds', {
          operation: 'get',
          hit: result !== null ? 'true' : 'false',
        });

        if (result !== null) {
          this.stats.hits++;
          this.metricsCollector.recordMetric('cache_hits_total', 1, 'count');

          try {
            return JSON.parse(result) as T;
          } catch {
            // If parsing fails, return the raw string
            return result as unknown as T;
          }
        } else {
          this.stats.misses++;
          this.metricsCollector.recordMetric('cache_misses_total', 1, 'count');
          return null;
        }
      },
      () => {
        this.stats.misses++;
        return null;
      },
    );
  }

  async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    return this.executeWithFallback(
      async () => {
        const fullKey = this.buildKey(key, options.prefix);
        const ttl = options.ttl || this.defaultTTL;
        const startTime = Date.now();

        let serializedValue: string;
        if (typeof value === 'string') {
          serializedValue = value;
        } else {
          serializedValue = JSON.stringify(value);
        }

        await this.redis.setex(fullKey, ttl, serializedValue);

        const duration = Date.now() - startTime;
        this.stats.sets++;

        this.metricsCollector.recordMetric('cache_operation_duration', duration, 'milliseconds', {
          operation: 'set',
        });
        this.metricsCollector.recordMetric('cache_sets_total', 1, 'count');

        return true;
      },
      () => false,
    );
  }

  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    return this.executeWithFallback(
      async () => {
        const fullKey = this.buildKey(key, options.prefix);
        const startTime = Date.now();

        const result = await this.redis.del(fullKey);

        const duration = Date.now() - startTime;
        this.stats.deletes++;

        this.metricsCollector.recordMetric('cache_operation_duration', duration, 'milliseconds', {
          operation: 'delete',
        });
        this.metricsCollector.recordMetric('cache_deletes_total', 1, 'count');

        return result > 0;
      },
      () => false,
    );
  }

  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    return this.executeWithFallback(
      async () => {
        const fullKey = this.buildKey(key, options.prefix);
        const result = await this.redis.exists(fullKey);
        return result === 1;
      },
      () => false,
    );
  }

  async flush(pattern?: string): Promise<boolean> {
    return this.executeWithFallback(
      async () => {
        if (pattern) {
          const keys = await this.redis.keys(pattern);
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } else {
          await this.redis.flushall();
        }

        this.logger.info('Cache flushed', { pattern });
        return true;
      },
      () => false,
    );
  }

  async getMultiple<T>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    return this.executeWithFallback(
      async () => {
        const fullKeys = keys.map((key) => this.buildKey(key, options.prefix));
        const results = await this.redis.mget(...fullKeys);

        return results.map((result) => {
          if (result !== null) {
            this.stats.hits++;
            try {
              return JSON.parse(result) as T;
            } catch {
              return result as unknown as T;
            }
          } else {
            this.stats.misses++;
            return null;
          }
        });
      },
      () =>
        keys.map(() => {
          this.stats.misses++;
          return null;
        }),
    );
  }

  async setMultiple(
    entries: Array<{ key: string; value: any; ttl?: number }>,
    options: CacheOptions = {},
  ): Promise<boolean> {
    return this.executeWithFallback(
      async () => {
        const pipeline = this.redis.pipeline();

        for (const entry of entries) {
          const fullKey = this.buildKey(entry.key, options.prefix);
          const ttl = entry.ttl || options.ttl || this.defaultTTL;
          const serializedValue =
            typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);

          pipeline.setex(fullKey, ttl, serializedValue);
        }

        await pipeline.exec();
        this.stats.sets += entries.length;

        this.metricsCollector.recordMetric('cache_sets_total', entries.length, 'count');
        return true;
      },
      () => false,
    );
  }

  // Cache decorator for methods
  cached<T>(key: string | ((args: any[]) => string), options: CacheOptions = {}) {
    return (_target: any, _propertyName: string, descriptor: PropertyDescriptor) => {
      const method = descriptor.value;

      descriptor.value = async function (...args: any[]): Promise<T> {
        const cacheKey = typeof key === 'function' ? key(args) : key;
        const cache = CacheService.getInstance();

        // Try to get from cache
        const cached = await cache.get<T>(cacheKey, options);
        if (cached !== null) {
          return cached;
        }

        // Execute original method
        const result = await method.apply(this, args);

        // Cache the result
        await cache.set(cacheKey, result, options);

        return result;
      };
    };
  }

  // Invalidate cache by pattern
  async invalidatePattern(pattern: string): Promise<number> {
    return this.executeWithFallback(
      async () => {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          this.logger.info('Cache pattern invalidated', { pattern, count: keys.length });
          return keys.length;
        }
        return 0;
      },
      () => 0,
    );
  }

  // Get cache statistics
  getStats(): CacheStats & { hitRate: number } {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      await this.redis.ping();
      const latency = Date.now() - startTime;

      return {
        status: latency < 100 ? 'healthy' : 'degraded',
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: (error as Error).message,
      };
    }
  }

  // Reset statistics
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
  }
}
