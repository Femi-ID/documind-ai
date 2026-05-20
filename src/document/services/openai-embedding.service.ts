import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly openai: OpenAI;
  private readonly model = 'text-embedding-3-small';
  private readonly batchSize = 100; // since openAI allows up to 2048 per request

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.getOrThrow('OPENAI_API_KEY'),
    });
  }

  /**
   * Takes an array of text strings and returns their embedding vectors.
   * Processes in batches to respect API limits and avoid timeouts.
   * Returns vectors in the SAME ORDER as the input texts.
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);

      const response = await this.openai.embeddings.create({
        model: this.model,
        input: batch,
      });

      // openAI returns the embeddings sorted by index, i'm just being explicit
      const sorted = response.data.sort((a, b) => a.index - b.index);
      allEmbeddings.push(...sorted.map((item) => item.embedding));

      this.logger.log(
        `Embedded batch ${Math.floor(i / this.batchSize) + 1}: ` +
          `${batch.length} chunks, (${response.usage.total_tokens} tokens)`,
      );
    }
    return allEmbeddings;
  }
}
