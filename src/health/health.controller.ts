import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
} from '@nestjs/terminus';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { MinioHealthIndicator } from './indicators/minio.health';
import { OllamaHealthIndicator } from './indicators/ollama.health';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@SkipThrottle()
@ApiTags('System')
@Controller({ version: '1', path: 'health' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly minioHealth: MinioHealthIndicator,
    private readonly ollamaHealth: OllamaHealthIndicator,
  ) {}

  /**
   * GET /health
   *
   * Returns 200 with all dependency statuses when healthy.
   * Returns 503 when any dependency is down.
   */
  @ApiOperation({ summary: 'Health check for all dependencies' })
  @ApiResponse({ status: 200, description: 'All dependencies healthy' })
  @ApiResponse({
    status: 503,
    description: 'One or more dependencies are down',
  })
  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.redisHealth.isHealthy('redis'),
      () => this.minioHealth.isHealthy('minio'),
      () => this.ollamaHealth.isHealthy('ollama'),
    ]);
  }
}
