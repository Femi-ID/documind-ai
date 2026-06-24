import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { buildRedisOptions } from 'src/common/utils/redis-options';

@Injectable()
export class RedisHealthIndicator {
  private readonly redis: Redis;

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly configService: ConfigService,
  ) {
    this.redis = new Redis(buildRedisOptions(this.configService));
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
