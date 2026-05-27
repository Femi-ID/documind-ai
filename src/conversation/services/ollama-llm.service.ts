import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LlmResponse {
  content: string;
  model: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

@Injectable()
export class OllamaLlmService {
  private readonly logger = new Logger(OllamaLlmService.name);
  private readonly ollamaUrl: string;
  private readonly model = 'llama3.2';

  constructor(private readonly configService: ConfigService) {
    this.ollamaUrl = this.configService.getOrThrow<string>('OLLAMA_URL');
  }

  async generateAnswer(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<LlmResponse> {
    const startTime = Date.now();

    const response = await fetch(`${this.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        options: {
          temperature: 0.3,
          nun_predict: 1024,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    this.logger.log(
      `LLM response generated in ${latencyMs}ms` +
        `(${data.prompt_eval_count ?? '?'} prompt, ${data.eval_count ?? '?'} completion tokens)`,
    );

    return {
      content: data.message.content,
      model: this.model,
      tokenUsage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
      latencyMs,
    };
  }
}
