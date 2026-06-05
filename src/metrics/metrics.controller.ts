import { Controller, Get } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricService: MetricsService) {}

  /**
   * GET /metrics
   *
   * Returns operational metrics for the platform.
   * This endpoint is designed for:
   * - Grafana dashboards (poll every 30s)
   * - Internal monitoring scripts
   * - README screenshots showing the system under load
   *
   * All metrics are computed live — no background aggregation needed
   * at this scale. For production at scale, I'd pre-aggregate with
   * Redis counters or a time-series DB, but for a portfolio project
   * live queries are simpler and sufficient.
   */
  @Get()
  async getMetrics() {
    return this.metricService.collectMetrics();
  }
}
