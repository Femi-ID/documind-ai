import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

export function buildRedisOptions(config: ConfigService): RedisOptions {
  const host = config.get<string>('REDIS_HOST', 'localhost');
  const port = parseInt(String(config.get('REDIS_PORT', 6379)), 10);
  const password = config.get<string>('REDIS_PASSWORD');
  const useTls = config.get<string>('REDIS_TLS') === 'true';

  return {
    host,
    port,
    password,
    tls: useTls ? { servername: host } : undefined,
    keepAlive: 10_000,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
  };
}
