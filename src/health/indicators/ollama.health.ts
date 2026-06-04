import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';

@Injectable()
export class OllamaHealthIndicator {
  private readonly ollamaUrl: string;

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly configService: ConfigService,
  ) {
    this.ollamaUrl = this.configService.getOrThrow<string>('OLLAMA_URL');
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const response = await fetch(this.ollamaUrl, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return indicator.down({ status: response.status });
      }

      return indicator.up({ url: this.ollamaUrl });
    } catch (error) {
      return indicator.down({ message: error.message });
    }
  }
}
