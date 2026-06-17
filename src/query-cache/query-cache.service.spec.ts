// What i'm testing:
// - Cache hit returns the stored answer
// - Cache miss returns null
// - Kill switch (QUERY_CACHE_ENABLED=false) bypasses all operations
// - Cache key includes the current collection version
// - invalidateCollection increments the version counter
// - Question normalization makes "What is X?" === " what  is  x? "
// - Redis errors don't crash the service (graceful degradation)

// Updated to:
// 1. Properly intercept the ioredis Redis class so no real connection
//    is attempted (fixes the ECONNREFUSED log noise)
// 2. Silence the Logger during tests (cleaner output)
// 3. Skip onModuleInit's connection probe entirely
//
// The key insight: the previous mock used jest.fn() returning an object,
// but ioredis is imported as `import Redis from 'ioredis'` (default
// export, used with `new`). We need to mock the default export as a
// constructor function that returns our fake instance.

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { QueryCacheService } from 'src/query-cache/query-cache.service';
import { createMockConfigService } from 'test/test-utils/mocks';

// ── ioredis mock ──
// We create a single shared mock instance that all `new Redis(...)`
// calls in the service will receive. This way we can inspect calls
// and control return values per test.
const mockRedisInstance = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  incr: jest.fn(),
  ping: jest.fn(),
};

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    // The default export is a class — mock it as a constructor that
    // returns our shared mock instance
    default: jest.fn().mockImplementation(() => mockRedisInstance),
  };
});

describe('QueryCacheService', () => {
  let service: QueryCacheService;
  let mockRedis = mockRedisInstance;

  const buildService = async (configOverrides: Record<string, any> = {}) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryCacheService,
        {
          provide: ConfigService,
          useValue: createMockConfigService({
            REDIS_HOST: 'localhost',
            REDIS_PORT: 6379,
            QUERY_CACHE_TTL: 3600,
            QUERY_CACHE_ENABLED: 'true',
            ...configOverrides,
          }),
        },
      ],
    }).compile();

    const svc = module.get<QueryCacheService>(QueryCacheService);

    // Default behaviors — tests override as needed
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.ping.mockResolvedValue('PONG');

    return svc;
  };

  beforeAll(() => {
    // Silence the NestJS Logger across this entire suite —
    // we don't care about its output during unit tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('getCachedAnswer', () => {
    it('should return null when no entry exists for the key', async () => {
      service = await buildService();
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getCachedAnswer('coll-1', 'What is AI?');
      expect(result).toBeNull();
    });

    it('should return parsed answer on cache hit', async () => {
      service = await buildService();

      const cached = {
        answer: 'AI is artificial intelligence.',
        citations: [],
        model: 'llama3.2',
        tokenUsage: { totalTokens: 100 },
        latencyMs: 1500,
        cachedAt: '2026-01-01T00:00:00.000Z',
      };

      mockRedis.get
        .mockResolvedValueOnce(null) // version lookup
        .mockResolvedValueOnce(JSON.stringify(cached)); // cache lookup

      const result = await service.getCachedAnswer('coll-1', 'What is AI?');
      expect(result).toEqual(cached);
    });

    it('should return null when QUERY_CACHE_ENABLED is false (kill switch)', async () => {
      service = await buildService({ QUERY_CACHE_ENABLED: 'false' });

      const result = await service.getCachedAnswer('coll-1', 'Anything');

      expect(result).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should return null and not throw when Redis is down', async () => {
      service = await buildService();
      mockRedis.get.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.getCachedAnswer('coll-1', 'Q?');
      expect(result).toBeNull();
    });
  });

  describe('cacheAnswer', () => {
    it('should store the answer in Redis with the configured TTL', async () => {
      service = await buildService({ QUERY_CACHE_TTL: 3600 });

      await service.cacheAnswer('coll-1', 'What is AI?', {
        answer: 'AI is...',
        citations: [],
        model: 'llama3.2',
        tokenUsage: { totalTokens: 100 },
        latencyMs: 1500,
        cachedAt: '',
      });

      // Your service uses setex(key, ttl, value) — adjust if you
      // switched to set(key, value, 'EX', ttl)
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('qa_cache:coll-1:'),
        expect.any(String),
        'EX',
        3600,
      );
    });

    it('should add cachedAt timestamp to the stored value', async () => {
      service = await buildService();

      await service.cacheAnswer('coll-1', 'Q', {
        answer: 'A',
        citations: [],
        model: 'm',
        tokenUsage: {},
        latencyMs: 0,
        cachedAt: '',
      });

      const storedJson = mockRedis.set.mock.calls[0][1];
      const stored = JSON.parse(storedJson);
      expect(stored.cachedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it('should not write to Redis when kill switch is off', async () => {
      service = await buildService({ QUERY_CACHE_ENABLED: 'false' });

      await service.cacheAnswer('coll-1', 'Q', {
        answer: 'A',
        citations: [],
        model: 'm',
        tokenUsage: {},
        latencyMs: 0,
        cachedAt: '',
      });

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should not throw if Redis write fails', async () => {
      service = await buildService();
      mockRedis.set.mockRejectedValue(new Error('Redis OOM'));

      await expect(
        service.cacheAnswer('coll-1', 'Q', {
          answer: 'A',
          citations: [],
          model: 'm',
          tokenUsage: {},
          latencyMs: 0,
          cachedAt: '',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('invalidateCollection', () => {
    it('should increment the version counter for the collection', async () => {
      service = await buildService();
      mockRedis.incr.mockResolvedValue(2);

      await service.invalidateCollection('coll-1');

      expect(mockRedis.incr).toHaveBeenCalledWith(
        'collection_doc_version:coll-1',
      );
    });

    it('should not throw if Redis increment fails', async () => {
      service = await buildService();
      mockRedis.incr.mockRejectedValue(new Error('Connection lost'));

      await expect(
        service.invalidateCollection('coll-1'),
      ).resolves.not.toThrow();
    });
  });

  describe('cache key versioning', () => {
    it('should include the collection version in the cache key', async () => {
      service = await buildService();
      mockRedis.get.mockResolvedValueOnce('3'); // collection version = 3

      await service.getCachedAnswer('coll-1', 'Q');

      expect(mockRedis.get).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(':v3:'),
      );
    });

    it('should use v0 when no version exists yet for the collection', async () => {
      service = await buildService();
      mockRedis.get.mockResolvedValueOnce(null); // no version key

      await service.getCachedAnswer('coll-new', 'Q');

      expect(mockRedis.get).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(':v0:'),
      );
    });
  });

  describe('question normalization', () => {
    it('should produce the same cache key for differently-cased questions', async () => {
      service = await buildService();
      mockRedis.get.mockResolvedValue(null);

      await service.getCachedAnswer('coll-1', 'What is AI?');
      const firstKey = mockRedis.get.mock.calls[1][0];

      jest.clearAllMocks();
      mockRedis.get.mockResolvedValue(null);

      await service.getCachedAnswer('coll-1', 'WHAT IS AI?');
      const secondKey = mockRedis.get.mock.calls[1][0];

      expect(firstKey).toBe(secondKey);
    });

    it('should produce the same cache key regardless of whitespace variation', async () => {
      service = await buildService();
      mockRedis.get.mockResolvedValue(null);

      await service.getCachedAnswer('coll-1', 'What is AI?');
      const firstKey = mockRedis.get.mock.calls[1][0];

      jest.clearAllMocks();
      mockRedis.get.mockResolvedValue(null);

      await service.getCachedAnswer('coll-1', '  What   is   AI?  ');
      const secondKey = mockRedis.get.mock.calls[1][0];

      expect(firstKey).toBe(secondKey);
    });

    it('should produce DIFFERENT keys for genuinely different questions', async () => {
      service = await buildService();
      mockRedis.get.mockResolvedValue(null);

      await service.getCachedAnswer('coll-1', 'What is AI?');
      const firstKey = mockRedis.get.mock.calls[1][0];

      jest.clearAllMocks();
      mockRedis.get.mockResolvedValue(null);

      await service.getCachedAnswer('coll-1', 'What is ML?');
      const secondKey = mockRedis.get.mock.calls[1][0];

      expect(firstKey).not.toBe(secondKey);
    });
  });
});
