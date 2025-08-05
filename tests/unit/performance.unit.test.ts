import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { 
  timed, 
  timedQuery, 
  MemoryMonitor, 
  CircuitBreaker,
  requestTiming 
} from '../../src/utils/performance';
import { StructuredLogger } from '../../src/utils/structured-logger';
import { MetricsCollector } from '../../src/monitoring/metrics';

// Mock dependencies
jest.mock('../../src/utils/structured-logger');
jest.mock('../../src/monitoring/metrics');

describe('Performance Utilities', () => {
  let mockLogger: jest.Mocked<StructuredLogger>;
  let mockMetricsCollector: jest.Mocked<MetricsCollector>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = new StructuredLogger() as jest.Mocked<StructuredLogger>;
    mockMetricsCollector = MetricsCollector.getInstance() as jest.Mocked<MetricsCollector>;
  });

  describe('@timed decorator', () => {
    it('should measure method execution time', async () => {
      class TestClass {
        @timed({ threshold: 100 })
        async slowMethod(delay: number): Promise<string> {
          await new Promise(resolve => setTimeout(resolve, delay));
          return 'completed';
        }
      }

      const instance = new TestClass();
      const result = await instance.slowMethod(50);

      expect(result).toBe('completed');
      expect(mockMetricsCollector.recordMetric).toHaveBeenCalledWith(
        'method_duration',
        expect.any(Number),
        'milliseconds',
        expect.objectContaining({
          method: 'slowMethod',
          class: 'TestClass',
        })
      );
    });

    it('should log warnings for slow methods', async () => {
      class TestClass {
        @timed({ threshold: 50 })
        async slowMethod(): Promise<void> {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const instance = new TestClass();
      await instance.slowMethod();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Slow operation detected',
        expect.objectContaining({
          method: 'slowMethod',
          duration: expect.stringMatching(/\d+\.\d+ms/),
          threshold: '50ms',
        })
      );
    });

    it('should track memory usage when enabled', async () => {
      class TestClass {
        @timed({ threshold: 100, includeMemory: true })
        async memoryTestMethod(): Promise<void> {
          // Simulate some memory usage
          const largeArray = new Array(1000000).fill('test');
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      const instance = new TestClass();
      await instance.memoryTestMethod();

      expect(mockMetricsCollector.recordMetric).toHaveBeenCalled();
    });

    it('should handle method errors properly', async () => {
      class TestClass {
        @timed({ threshold: 100 })
        async errorMethod(): Promise<void> {
          throw new Error('Test error');
        }
      }

      const instance = new TestClass();
      
      await expect(instance.errorMethod()).rejects.toThrow('Test error');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Method execution failed',
        expect.objectContaining({
          method: 'errorMethod',
          error: expect.any(Error),
        })
      );
    });
  });

  describe('timedQuery function', () => {
    it('should measure database query execution time', async () => {
      const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
      
      const result = await timedQuery('SELECT', mockQuery);
      
      expect(result).toEqual({ rows: [] });
      expect(mockMetricsCollector.recordDatabaseQuery).toHaveBeenCalledWith(
        'SELECT',
        'unknown',
        expect.any(Number),
        true
      );
    });

    it('should log slow queries', async () => {
      const slowQuery = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
        return { rows: [] };
      });
      
      await timedQuery('SELECT', slowQuery, 500);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Slow database query detected',
        expect.objectContaining({
          operation: 'SELECT',
          duration: expect.stringMatching(/\d+\.\d+ms/),
          threshold: '500ms',
        })
      );
    });

    it('should handle query errors', async () => {
      const errorQuery = jest.fn().mockRejectedValue(new Error('Database error'));
      
      await expect(timedQuery('INSERT', errorQuery)).rejects.toThrow('Database error');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Database query failed',
        expect.objectContaining({
          operation: 'INSERT',
          error: expect.any(Error),
        })
      );
      
      expect(mockMetricsCollector.recordDatabaseQuery).toHaveBeenCalledWith(
        'INSERT',
        'unknown',
        expect.any(Number),
        false
      );
    });
  });

  describe('MemoryMonitor', () => {
    it('should check memory usage status', () => {
      // Mock process.memoryUsage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 50 * 1024 * 1024, // 50MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
        rss: 120 * 1024 * 1024,
      });

      const status = MemoryMonitor.checkMemoryUsage();
      
      expect(status.status).toBe('healthy'); // 50% usage
      expect(status.usagePercent).toBe(50);
      expect(status.usage.heapUsed).toBe(50 * 1024 * 1024);
      
      process.memoryUsage = originalMemoryUsage;
    });

    it('should detect warning level memory usage', () => {
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 85 * 1024 * 1024, // 85MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
        rss: 120 * 1024 * 1024,
      });

      const status = MemoryMonitor.checkMemoryUsage();
      
      expect(status.status).toBe('warning'); // 85% usage
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'High memory usage detected',
        expect.objectContaining({
          status: 'warning',
          usage_percent: 85,
        })
      );
      
      process.memoryUsage = originalMemoryUsage;
    });

    it('should detect critical memory usage', () => {
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 95 * 1024 * 1024, // 95MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
        rss: 120 * 1024 * 1024,
      });

      const status = MemoryMonitor.checkMemoryUsage();
      
      expect(status.status).toBe('critical'); // 95% usage
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'High memory usage detected',
        expect.objectContaining({
          status: 'critical',
          usage_percent: 95,
        })
      );
      
      process.memoryUsage = originalMemoryUsage;
    });

    it('should force garbage collection when available', () => {
      const originalGC = global.gc;
      const mockGC = jest.fn();
      global.gc = mockGC;

      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn()
        .mockReturnValueOnce({
          heapUsed: 100 * 1024 * 1024,
          heapTotal: 200 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
          rss: 250 * 1024 * 1024,
        })
        .mockReturnValueOnce({
          heapUsed: 80 * 1024 * 1024,
          heapTotal: 200 * 1024 * 1024,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024,
          rss: 230 * 1024 * 1024,
        });

      const result = MemoryMonitor.forceGarbageCollection();
      
      expect(result).toBe(true);
      expect(mockGC).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Garbage collection completed',
        expect.objectContaining({
          freed_bytes: 20 * 1024 * 1024,
          freed_mb: 20,
        })
      );
      
      global.gc = originalGC;
      process.memoryUsage = originalMemoryUsage;
    });

    it('should handle unavailable garbage collection', () => {
      const originalGC = global.gc;
      delete (global as any).gc;

      const result = MemoryMonitor.forceGarbageCollection();
      
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Garbage collection not available');
      
      global.gc = originalGC;
    });
  });

  describe('CircuitBreaker', () => {
    it('should execute operations normally when closed', async () => {
      const circuitBreaker = new CircuitBreaker(3, 1000);
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalled();
      expect(circuitBreaker.getState()).toBe('closed');
    });

    it('should open circuit after failure threshold', async () => {
      const circuitBreaker = new CircuitBreaker(2, 1000);
      const mockOperation = jest.fn().mockRejectedValue(new Error('Service error'));
      
      // First failure
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Service error');
      expect(circuitBreaker.getState()).toBe('closed');
      
      // Second failure - should open circuit
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Service error');
      expect(circuitBreaker.getState()).toBe('open');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Circuit breaker opened',
        expect.objectContaining({
          failure_count: 2,
          threshold: 2,
        })
      );
    });

    it('should reject requests when circuit is open', async () => {
      const circuitBreaker = new CircuitBreaker(1, 1000);
      const mockOperation = jest.fn().mockRejectedValue(new Error('Service error'));
      
      // Trigger circuit open
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Service error');
      expect(circuitBreaker.getState()).toBe('open');
      
      // Should reject without calling operation
      mockOperation.mockClear();
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Circuit breaker is open');
      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should attempt reset after timeout', async () => {
      const circuitBreaker = new CircuitBreaker(1, 100); // Short timeout for testing
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Service error'))
        .mockResolvedValueOnce('success');
      
      // Trigger circuit open
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Service error');
      expect(circuitBreaker.getState()).toBe('open');
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should attempt operation again (half-open state)
      const result = await circuitBreaker.execute(mockOperation);
      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe('closed');
    });

    it('should record metrics when circuit opens', async () => {
      const circuitBreaker = new CircuitBreaker(1, 1000);
      const mockOperation = jest.fn().mockRejectedValue(new Error('Service error'));
      
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Service error');
      
      expect(mockMetricsCollector.recordMetric).toHaveBeenCalledWith(
        'circuit_breaker_opened',
        1,
        'count'
      );
    });
  });

  describe('requestTiming middleware', () => {
    it('should measure request duration', () => {
      const req = { method: 'GET', path: '/test', ip: '127.0.0.1' } as any;
      const res = {
        on: jest.fn(),
        statusCode: 200,
      } as any;
      const next = jest.fn();
      
      const middleware = requestTiming({ threshold: 1000 });
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should log slow requests', (done) => {
      const req = { 
        method: 'GET', 
        path: '/test', 
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-agent'),
        user: { id: 'user-123' },
        context: { requestId: 'req-123' }
      } as any;
      
      const res = {
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            // Simulate slow request by setting start time in the past
            req.startTime = Date.now() - 2000; // 2 seconds ago
            callback();
            
            expect(mockLogger.warn).toHaveBeenCalledWith(
              'Slow request detected',
              expect.objectContaining({
                method: 'GET',
                path: '/test',
                threshold: '1000ms',
                duration: expect.stringMatching(/\d+\.\d+ms/),
              })
            );
            
            done();
          }
        }),
        statusCode: 200,
      } as any;
      
      const next = jest.fn();
      
      const middleware = requestTiming({ threshold: 1000 });
      middleware(req, res, next);
      
      // Manually trigger finish event for testing
      res.on.mock.calls.find(([event]) => event === 'finish')[1]();
    });

    it('should include memory delta when enabled', (done) => {
      const req = { 
        method: 'POST', 
        path: '/test', 
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-agent')
      } as any;
      
      const res = {
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            req.startTime = Date.now() - 1500; // Slow request
            callback();
            
            expect(mockLogger.warn).toHaveBeenCalledWith(
              'Slow request detected',
              expect.objectContaining({
                memory_delta: expect.objectContaining({
                  heap_used: expect.any(Number),
                  heap_total: expect.any(Number),
                  external: expect.any(Number),
                })
              })
            );
            
            done();
          }
        }),
        statusCode: 200,
      } as any;
      
      const next = jest.fn();
      
      const middleware = requestTiming({ 
        threshold: 1000, 
        includeMemory: true 
      });
      middleware(req, res, next);
      
      // Trigger finish event
      res.on.mock.calls.find(([event]) => event === 'finish')[1]();
    });
  });
});