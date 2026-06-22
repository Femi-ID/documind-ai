import { GoogleGenAI } from '@google/genai';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// calls Gemini for answer generation
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
export class GoogleLlmService {
  private readonly logger = new Logger(GoogleLlmService.name);
  private readonly genai: GoogleGenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.genai = new GoogleGenAI({
      apiKey: this.configService.getOrThrow<string>('GEMINI_API_KEY'),
    });
    this.model = this.configService.get<string>(
      'GEMINI_LLM_MODEL',
      'gemini-2.0-flash',
    );
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 4,
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await operation();
      } catch (error: any) {
        attempt++;
        if (error?.status === 429 && attempt < maxRetries) {
          // Calculate exponential backoff (e.g., 2s, 4s, 8s, 16s) + a little jitter
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          this.logger.warn(
            `Rate limited by Gemini. Retrying in ${Math.round(delay)}ms... (Attempt ${attempt}/${maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw error; // Throw if it's not a 429, or if we're out of retries
        }
      }
    }
    throw new HttpException(
      'AI Service Unavailable',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /** Sends user's and system's prompt to gemini AI to generate answers. */
  async generateAnswer(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<LlmResponse> {
    const startTime = Date.now();

    // try {
    const response = await this.withRetry(() =>
      this.genai.models.generateContent({
        model: this.model,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3, // Lower temperatures are good for prompts that require less creative response and more factual, grounded answers
          maxOutputTokens: 1024,
        },
      }),
    );

    const latencyMs = Date.now() - startTime;
    const content = response.text ?? 'No response generated.';
    const usage = response.usageMetadata;

    this.logger.log(
      `LLM response generated in ${latencyMs}ms` +
        `(${usage?.promptTokenCount ?? '?'} prompt, ${usage?.candidatesTokenCount ?? '?'} completion tokens)`,
    );

    return {
      content: content,
      model: this.model,
      tokenUsage: usage
        ? {
            promptTokens: usage?.promptTokenCount ?? 0,
            completionTokens: usage?.candidatesTokenCount ?? 0,
            totalTokens: usage?.totalTokenCount ?? 0,
          }
        : undefined,
      latencyMs: latencyMs,
    };
    // } catch (error) {
    //   this.logger.error(
    //     `Failed to generate AI answer for the user's query: ${error.message}`,
    //   );
    //   this.logger.log(
    //     `{status: ${error.status}\n details: ${error.details}`,
    //     error.stack,
    //   );
    // }
  }
}
