import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';

@Injectable()
export class OllamaHealthIndicator {
  private readonly ollamaUrl: string;
  private readonly llmProvider: string;

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly configService: ConfigService,
  ) {
    this.ollamaUrl = this.configService.get<string>(
      'OLLAMA_URL',
      'http://localhost:11434',
    );
    this.llmProvider = this.configService.get<string>('LLM_PROVIDER', 'ollama');
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    // Skip the check entirely if we're not using Ollama in this environment
    if (this.llmProvider !== 'ollama') {
      return indicator.up({
        skipped: true,
        reason: `LLM_PROVIDER is "${this.llmProvider}", not ollama`,
      });
    }

    try {
      const response = await fetch(this.ollamaUrl, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        // return indicator.down({ status: response.status });
        return indicator.down();
      }

      return indicator.up({ url: this.ollamaUrl });
    } catch (error) {
      return indicator.down({ message: error.message });
    }
  }
}
