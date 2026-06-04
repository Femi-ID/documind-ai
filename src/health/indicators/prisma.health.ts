import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  /**
   * Runs a raw SELECT 1 query to verify the database connection.
   * This is the lightest possible check — no table access needed.
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: error.message });
    }
  }
}
