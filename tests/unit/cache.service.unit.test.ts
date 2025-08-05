import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CacheService } from '../../src/services/cache.service';
import { StructuredLogger } from '../../src/utils/structured-logger';
import { MetricsCollector } from '../../src/monitoring/metrics';

// Mock dependencies
jest.mock('ioredis');
jest.mock('../../src/utils/structured-logger');
jest.mock('../../src/monitoring/metrics');

// Mock Redis
const mockRedis = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  flushall: jest.fn(),
  keys: jest.fn(),
  mget: jest.fn(),
  pipeline: jest.fn(),
  ping: jest.fn(),
  on: jest.fn(),
};

// Mock the pipeline
const mockPipeline = {
  setex: jest.fn().mockReturnThis(),
  exec: jest.fn(),
};

mockRedis.pipeline.mockReturnValue(mockPipeline);

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockLogger: jest.Mocked<StructuredLogger>;
  let mockMetricsCollector: jest.Mocked<MetricsCollector>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton
    (CacheService as any).instance = undefined;
    
    mockLogger = new StructuredLogger() as jest.Mocked<StructuredLogger>;
    mockMetricsCollector = MetricsCollector.getInstance() as jest.Mocked<MetricsCollector>;
    
    cacheService = CacheService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = CacheService.getInstance();
      const instance2 = CacheService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Connection Management', () => {
    it('should connect to Redis successfully', async () => {
      mockRedis.connect.mockResolvedValue(undefined);
      
      await cacheService.connect();
      
      expect(mockRedis.connect).toHaveBeenCalled();
    });

    it('should handle connection errors gracefully', async () => {
      const error = new Error('Connection failed');
      mockRedis.connect.mockRejectedValue(error);
      
      await cacheService.connect();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to connect to Redis',
        { error }
      );
    });

    it('should disconnect from Redis', async () => {
      // Simulate connected state
      (cacheService as any).isConnected = true;
      mockRedis.disconnect.mockResolvedValue(undefined);
      
      await cacheService.disconnect();
      
      expect(mockRedis.disconnect).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Redis disconnected');
    });

    it('should not attempt disconnect when not connected', async () => {
      (cacheService as any).isConnected = false;
      
      await cacheService.disconnect();
      
      expect(mockRedis.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('Basic Cache Operations', () => {
    beforeEach(() => {
      (cacheService as any).isConnected = true;
    });

    describe('get', () => {
      it('should retrieve cached value successfully', async () => {
        const testData = { id: 1, name: 'test' };
        mockRedis.get.mockResolvedValue(JSON.stringify(testData));
        
        const result = await cacheService.get<typeof testData>('test-key');
        
        expect(result).toEqual(testData);
        expect(mockRedis.get).toHaveBeenCalledWith('test-key');
        expect(mockMetricsCollector.recordMetric).toHaveBeenCalledWith(
          'cache_operation_duration',
          expect.any(Number),
          'milliseconds',
          { operation: 'get', hit: 'true' }
        );
        expect(mockMetricsCollector.recordMetric).toHaveBeenCalledWith(
          'cache_hits_total',
          1,
          'count'
        );
      });

      it('should return null for cache miss', async () => {
        mockRedis.get.mockResolvedValue(null);
        
        const result = await cacheService.get('non-existent-key');
        
        expect(result).toBeNull();
        expect(mockMetricsCollector.recordMetric).toHaveBeenCalledWith(
          'cache_misses_total',
          1,
          'count'
        );
      });

      it('should handle JSON parsing errors', async () => {
        mockRedis.get.mockResolvedValue('invalid-json');
        
        const result = await cacheService.get<string>('test-key');
        
        expect(result).toBe('invalid-json');
      });

      it('should use prefix when provided', async () => {
        mockRedis.get.mockResolvedValue('"test-value"');
        
        await cacheService.get('key', { prefix: 'prefix' });
        
        expect(mockRedis.get).toHaveBeenCalledWith('prefix:key');
      });

      it('should fallback when not connected', async () => {
        (cacheService as any).isConnected = false;
        
        const result = await cacheService.get('test-key');
        
        expect(result).toBeNull();
        expect(mockRedis.get).not.toHaveBeenCalled();
      });

      it('should fallback on Redis error', async () => {
        mockRedis.get.mockRejectedValue(new Error('Redis error'));
        
        const result = await cacheService.get('test-key');
        
        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Cache operation failed, using fallback',
          { error: expect.any(Error) }
        );
      });
    });

    describe('set', () => {
      it('should set cache value successfully', async () => {
        const testData = { id: 1, name: 'test' };
        mockRedis.setex.mockResolvedValue('OK');
        
        const result = await cacheService.set('test-key', testData);
        
        expect(result).toBe(true);
        expect(mockRedis.setex).toHaveBeenCalledWith(
          'test-key',
          300, // default TTL
          JSON.stringify(testData)
        );
        expect(mockMetricsCollector.recordMetric).toHaveBeenCalledWith(
          'cache_sets_total',
          1,
          'count'
        );
      });

      it('should use custom TTL', async () => {
        mockRedis.setex.mockResolvedValue('OK');
        
        await cacheService.set('test-key', 'value', { ttl: 600 });
        
        expect(mockRedis.setex).toHaveBeenCalledWith(
          'test-key',
          600,
          '"value"'
        );
      });

      it('should handle string values without JSON serialization', async () => {
        mockRedis.setex.mockResolvedValue('OK');
        
        await cacheService.set('test-key', 'string-value');
        
        expect(mockRedis.setex).toHaveBeenCalledWith(
          'test-key',
          300,
          'string-value'
        );
      });

      it('should fallback when not connected', async () => {
        (cacheService as any).isConnected = false;
        
        const result = await cacheService.set('test-key', 'value');
        
        expect(result).toBe(false);
        expect(mockRedis.setex).not.toHaveBeenCalled();
      });
    });

    describe('delete', () => {
      it('should delete cache key successfully', async () => {
        mockRedis.del.mockResolvedValue(1);
        
        const result = await cacheService.delete('test-key');
        
        expect(result).toBe(true);
        expect(mockRedis.del).toHaveBeenCalledWith('test-key');
        expect(mockMetricsCollector.recordMetric).toHaveBeenCalledWith(
          'cache_deletes_total',
          1,
          'count'
        );
      });

      it('should return false when key does not exist', async () => {
        mockRedis.del.mockResolvedValue(0);
        
        const result = await cacheService.delete('non-existent-key');
        
        expect(result).toBe(false);
      });
    });

    describe('exists', () => {
      it('should check key existence successfully', async () => {
        mockRedis.exists.mockResolvedValue(1);
        
        const result = await cacheService.exists('test-key');
        
        expect(result).toBe(true);
        expect(mockRedis.exists).toHaveBeenCalledWith('test-key');
      });

      it('should return false for non-existent key', async () => {
        mockRedis.exists.mockResolvedValue(0);
        
        const result = await cacheService.exists('non-existent-key');
        
        expect(result).toBe(false);
      });
    });
  });

  describe('Batch Operations', () => {
    beforeEach(() => {
      (cacheService as any).isConnected = true;
    });

    describe('getMultiple', () => {
      it('should retrieve multiple values', async () => {
        const values = ['"value1"', '"value2"', null];
        mockRedis.mget.mockResolvedValue(values);
        
        const result = await cacheService.getMultiple<string>(['key1', 'key2', 'key3']);
        
        expect(result).toEqual(['value1', 'value2', null]);
        expect(mockRedis.mget).toHaveBeenCalledWith('key1', 'key2', 'key3');
      });

      it('should handle prefix for multiple keys', async () => {
        mockRedis.mget.mockResolvedValue(['"value1"', '"value2"']);
        
        await cacheService.getMultiple(['key1', 'key2'], { prefix: 'prefix' });
        
        expect(mockRedis.mget).toHaveBeenCalledWith('prefix:key1', 'prefix:key2');
      });
    });

    describe('setMultiple', () => {
      it('should set multiple values', async () => {
        mockPipeline.exec.mockResolvedValue([]);
        
        const entries = [
          { key: 'key1', value: 'value1' },
          { key: 'key2', value: 'value2', ttl: 600 },
        ];
        
        const result = await cacheService.setMultiple(entries);
        
        expect(result).toBe(true);
        expect(mockPipeline.setex).toHaveBeenCalledTimes(2);
        expect(mockPipeline.setex).toHaveBeenCalledWith('key1', 300, '"value1"');
        expect(mockPipeline.setex).toHaveBeenCalledWith('key2', 600, '"value2"');
        expect(mockPipeline.exec).toHaveBeenCalled();
      });
    });
  });

  describe('Advanced Operations', () => {
    beforeEach(() => {
      (cacheService as any).isConnected = true;
    });

    describe('flush', () => {
      it('should flush all cache', async () => {
        mockRedis.flushall.mockResolvedValue('OK');
        
        const result = await cacheService.flush();
        
        expect(result).toBe(true);
        expect(mockRedis.flushall).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith('Cache flushed', { pattern: undefined });
      });

      it('should flush by pattern', async () => {
        mockRedis.keys.mockResolvedValue(['key1', 'key2']);
        mockRedis.del.mockResolvedValue(2);
        
        const result = await cacheService.flush('pattern*');
        
        expect(result).toBe(true);
        expect(mockRedis.keys).toHaveBeenCalledWith('pattern*');
        expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2');
      });

      it('should handle empty pattern result', async () => {
        mockRedis.keys.mockResolvedValue([]);
        
        const result = await cacheService.flush('pattern*');
        
        expect(result).toBe(true);
        expect(mockRedis.del).not.toHaveBeenCalled();
      });
    });

    describe('invalidatePattern', () => {
      it('should invalidate keys by pattern', async () => {
        mockRedis.keys.mockResolvedValue(['key1', 'key2', 'key3']);
        mockRedis.del.mockResolvedValue(3);
        
        const result = await cacheService.invalidatePattern('test:*');
        
        expect(result).toBe(3);
        expect(mockRedis.keys).toHaveBeenCalledWith('test:*');
        expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Cache pattern invalidated',
          { pattern: 'test:*', count: 3 }
        );
      });

      it('should return 0 when no keys match', async () => {
        mockRedis.keys.mockResolvedValue([]);
        
        const result = await cacheService.invalidatePattern('nonexistent:*');
        
        expect(result).toBe(0);
        expect(mockRedis.del).not.toHaveBeenCalled();
      });
    });
  });

  describe('Statistics and Health', () => {
    it('should return cache statistics', () => {
      // Set some stats
      (cacheService as any).stats = {
        hits: 10,
        misses: 5,
        sets: 8,
        deletes: 2,
        errors: 1,
      };
      
      const stats = cacheService.getStats();
      
      expect(stats).toEqual({
        hits: 10,
        misses: 5,
        sets: 8,
        deletes: 2,
        errors: 1,
        hitRate: 66.67,
      });
    });

    it('should handle zero requests for hit rate', () => {
      (cacheService as any).stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        errors: 0,
      };
      
      const stats = cacheService.getStats();
      
      expect(stats.hitRate).toBe(0);
    });

    it('should reset statistics', () => {
      (cacheService as any).stats = {
        hits: 10,
        misses: 5,
        sets: 8,
        deletes: 2,
        errors: 1,
      };
      
      cacheService.resetStats();
      
      const stats = cacheService.getStats();
      expect(stats).toEqual({
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        errors: 0,
        hitRate: 0,
      });
    });

    describe('healthCheck', () => {
      it('should return healthy status for fast ping', async () => {
        mockRedis.ping.mockResolvedValue('PONG');
        
        const health = await cacheService.healthCheck();
        
        expect(health.status).toBe('healthy');
        expect(health.latency).toBeLessThan(100);
        expect(mockRedis.ping).toHaveBeenCalled();
      });

      it('should return degraded status for slow ping', async () => {
        // Mock a slow ping response
        mockRedis.ping.mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 150));
          return 'PONG';
        });
        
        const health = await cacheService.healthCheck();
        
        expect(health.status).toBe('degraded');
        expect(health.latency).toBeGreaterThanOrEqual(150);
      });

      it('should return unhealthy status on error', async () => {
        const error = new Error('Connection lost');
        mockRedis.ping.mockRejectedValue(error);
        
        const health = await cacheService.healthCheck();
        
        expect(health.status).toBe('unhealthy');
        expect(health.error).toBe('Connection lost');
      });
    });
  });

  describe('Event Handling', () => {
    it('should setup Redis event handlers', () => {
      expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
      expect(mockRedis.on).toHaveBeenCalledWith('ready', expect.any(Function));
    });

    it('should handle connect event', () => {
      const connectHandler = mockRedis.on.mock.calls.find(call => call[0] === 'connect')[1];
      
      connectHandler();
      
      expect((cacheService as any).isConnected).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Redis connected successfully');
    });

    it('should handle error event', () => {
      const errorHandler = mockRedis.on.mock.calls.find(call => call[0] === 'error')[1];
      const error = new Error('Redis error');
      
      errorHandler(error);
      
      expect((cacheService as any).isConnected).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Redis connection error', { error });
      expect(mockMetricsCollector.recordMetric).toHaveBeenCalledWith(
        'cache_errors_total',
        1,
        'count',
        { error_type: 'Error' }
      );
    });

    it('should handle reconnecting event', () => {
      const reconnectingHandler = mockRedis.on.mock.calls.find(call => call[0] === 'reconnecting')[1];
      
      reconnectingHandler();
      
      expect(mockLogger.warn).toHaveBeenCalledWith('Redis reconnecting...');
    });

    it('should handle ready event', () => {
      const readyHandler = mockRedis.on.mock.calls.find(call => call[0] === 'ready')[1];
      
      readyHandler();
      
      expect((cacheService as any).isConnected).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Redis ready for operations');
    });
  });

  describe('Cache Decorator', () => {
    it('should create cached method decorator', async () => {
      const decorator = cacheService.cached<string>('test-key', { ttl: 600 });
      
      expect(typeof decorator).toBe('function');
    });

    // Note: Testing the decorator functionality would require more complex setup
    // as it modifies method descriptors. This would be better tested in integration tests.
  });

  describe('Error Tracking', () => {
    beforeEach(() => {
      (cacheService as any).isConnected = true;
    });

    it('should track errors in statistics', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      
      await cacheService.get('test-key');
      
      const stats = cacheService.getStats();
      expect(stats.errors).toBe(1);
    });

    it('should continue to track errors across operations', async () => {
      mockRedis.get.mockRejectedValue(new Error('Error 1'));
      mockRedis.set.mockRejectedValue(new Error('Error 2'));
      
      await cacheService.get('key1');
      await cacheService.set('key2', 'value');
      
      const stats = cacheService.getStats();
      expect(stats.errors).toBe(2);
    });
  });
});