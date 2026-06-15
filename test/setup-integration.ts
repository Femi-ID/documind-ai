// Same env vars as unit setup. Integration tests will override
// DATABASE_URL and REDIS_HOST/PORT with container-provided
// values when containers spin up.

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';

// Throttler limits — high enough that tests don't trip rate limits
process.env.THROTTLE_TTL = '60000';
process.env.DEFAULT_THROTTLE_LIMIT = '10000';
process.env.STRICT_THROTTLE_LIMIT = '10000';
process.env.MODERATE_THROTTLE_LIMIT = '10000';

process.env.QUERY_CACHE_TTL = '3600';
process.env.QUERY_CACHE_ENABLED = 'true';
