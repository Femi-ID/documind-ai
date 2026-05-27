import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
// import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly genAI: GoogleGenAI;
  private readonly model = 'gemini-embedding-2';
  private readonly batchSize = 100;
  //   private readonly genAI: GoogleGenerativeAI;
  //   private readonly model = 'text-embedding-004';

  constructor(private readonly configService: ConfigService) {
    this.genAI = new GoogleGenAI({
      apiKey: this.configService.getOrThrow<string>('GOOGLE_API_KEY'),
    });
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const result = await this.genAI.models.embedContent({
        model: this.model,
        contents: batch,
        config: {
          taskType: 'RETRIEVAL_DOCUMENT',
          outputDimensionality: 256,
        },
      });

      //   allEmbeddings.push(...result.embeddings.map((e) => e.values));
      if (!result.embeddings) {
        throw new Error(
          'Google GenAI API returned an empty or undefined embeddings response.',
        );
      }

      const batchEmbeddings = result.embeddings.map((e, index) => {
        if (!e.values) {
          throw new Error(
            `Embedding values are undefined for item at batch index ${index}`,
          );
        }
        return e.values;
      });

      this.logger.log(
        `Embedded batch ${Math.floor(i / this.batchSize) + 1}: ${this.batchSize} chunks`,
      );

      allEmbeddings.push(...batchEmbeddings);

      //   adds an intentional 3 seconds pause between batches to the TPM window slide
      if (i + this.batchSize < texts.length) {
        this.logger.log(`Pausing to respect the embedding TPM limit...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
    return allEmbeddings;
  }

  async generateQueryEmbedding(text: string): Promise<number[]> {
    const result = await this.genAI.models.embedContent({
      model: this.model,
      contents: text,
      config: { taskType: 'RETRIEVAL_QUERY', outputDimensionality: 256 },
    });
    if (!result.embeddings?.[0]?.values) {
      throw new Error('Failed to generate query embedding.');
    }
    this.logger.log(`User's query embedding has been successfully generated.`);
    return result.embeddings[0].values;
  }
}
