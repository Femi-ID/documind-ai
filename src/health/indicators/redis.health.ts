import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
  private readonly redis: Redis;

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly configService: ConfigService,
  ) {
    const useTls = this.configService.get<string>('REDIS_TLS') === 'true';

    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: parseInt(String(this.configService.get('REDIS_PORT', 6379)), 10),
      password: this.configService.get<string>('REDIS_PASSWORD'),
      tls: useTls ? { servername: host } : undefined,
      keepAlive: 10_000,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const result = await this.redis.ping();
      return indicator.up({ response: result });
    } catch (error) {
      return indicator.down({ message: error.message });
    }
  }
}
