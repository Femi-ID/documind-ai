import { buildEmbedding } from './factories';

// Mock factory functions for external services. Each returns a
// jest mock object that matches the real service's interface.

/**
 * Mock the embedding service (Ollama or Google).
 *
 * Default behavior: returns a deterministic embedding based on
 * the input text. Same input → same embedding.
 */
export const createMockEmbeddingService = () => ({
  generateQueryEmbeddings: jest.fn(async (text: string) => {
    return buildEmbedding(text);
  }),
  generateEmbeddings: jest.fn(async (texts: string[]) => {
    return texts.map((text) => buildEmbedding(text));
  }),
});

/**
 * Mock the LLM service (Ollama).
 *
 * Default behavior: returns a canned answer with predictable
 * token usage. Override .mockImplementationOnce() in tests
 * that need specific responses.
 */
export const createMockLlmService = () => ({
  generateAnswer: jest.fn(async (systemPrompt: string, userPrompt: string) => ({
    content: 'This is a mocked LLM response based on the provided context.',
    model: 'mock-llm',
    tokenUsage: {
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120,
    },
    latencyMs: 50,
  })),
});

/**
 * Mock the MinIO service.
 *
 * Default behavior: returns fake S3 keys and empty buffers.
 * Override for tests that need specific file content.
 */
export const createMockMinioService = () => ({
  uploadFile: jest.fn(async (buffer: Buffer, objectName: string) => ({
    objectName,
    etag: 'mock-etag',
  })),
  getFileAsBuffer: jest.fn(async (objectName: string) => {
    return Buffer.from('mock file content');
  }),
  deleteFile: jest.fn(async (objectName: string) => undefined),
  getPresignedUrl: jest.fn(async (objectName: string) => {
    return `https://mock-minio.local/${objectName}?signature=mock`;
  }),
});

/**
 * Mock the Prisma service.
 *
 * For unit tests, i'm mocking the needed specific model methods:
 *   const prisma = createMockPrismaService();
 *   prisma.user.findUnique.mockResolvedValue(buildUser());
 *
 * For integration tests, use the real PrismaService against
 * the test container instead.
 */
export const createMockPrismaService = () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  document: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  chunk: {
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  collection: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  conversation: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  message: {
    findMany: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $queryRawUnsafe: jest.fn(),
  $executeRaw: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(async (callback: any) => {
    if (typeof callback === 'function') {
      // For interactive transactions, pass the mock prisma itself
      return callback(createMockPrismaService());
    }
    // For sequential transactions, just resolve the array
    return Promise.all(callback);
  }),
});

/**
 * Mock the ConfigService.
 *
 * Usage:
 *   const config = createMockConfigService({
 *     QUERY_CACHE_ENABLED: 'true',
 *     QUERY_CACHE_TTL: 3600,
 *   });
 */
export const createMockConfigService = (
  overrides: Record<string, any> = {},
) => {
  const defaults: Record<string, any> = {
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    QUERY_CACHE_TTL: 3600,
    QUERY_CACHE_ENABLED: 'true',
    OLLAMA_URL: 'http://localhost:11434',
    MINIO_BUCKET_NAME: 'test-bucket',
    JWT_ACCESS_SECRET: 'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    ...overrides,
  };

  return {
    get: jest.fn(<T>(key: string, defaultValue?: T): T => {
      return (defaults[key] !== undefined ? defaults[key] : defaultValue) as T;
    }),
    getOrThrow: jest.fn(<T>(key: string): T => {
      if (defaults[key] === undefined) {
        throw new Error(`Config key "${key}" not found in test mocks`);
      }
      return defaults[key] as T;
    }),
  };
};
