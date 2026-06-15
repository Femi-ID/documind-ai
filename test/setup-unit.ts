// Runs once before all unit tests. Use it to set environment
// variables that DTOs or services might read at import time.

process.env.NODE_ENV = 'test';

// Suppress NestJS logger noise during unit tests.
// You'll still see test failures clearly, but you won't see
// "[Nest] Starting application..." spam in test output.
process.env.LOG_LEVEL = 'error';

// Mock secrets to avoid using real values in tests
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';

// Default disabled for unit tests — each test enables/disables
// as needed via the ConfigService mock
process.env.QUERY_CACHE_ENABLED = 'false';
