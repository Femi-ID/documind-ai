import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly ollamaUrl: string;
  private readonly model = 'nomic-embed-text';

  constructor(private readonly configService: ConfigService) {
    this.ollamaUrl = this.configService.get<string>(
      'OLLAMA_URL',
      'http://localhost:11434',
    );
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    // Ollama processes one text at a time
    for (let i = 0; i < texts.length; i++) {
      const response = await fetch(`${this.ollamaUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          input: texts[i],
        }),
      });
      if (!response.ok) {
        throw new Error(`Ollama embedding failed: ${response.statusText}`);
      }

      const data = await response.json();
      embeddings.push(data.embeddings[0]);

      // log for every 100th text
      if ((i + 1) % 100 === 0) {
        this.logger.log(`Embedded ${i + 1}/${texts.length} chunks`);
      }
    }

    this.logger.log(`Generated embeddings for ${texts.length} chunks`);
    this.logger.log(`to view the embedded chunk- ${embeddings[0][0]}`);
    return embeddings;
  }

  async generateQueryEmbeddings(text: string): Promise<number[]> {
    const response = await fetch(`${this.ollamaUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama QUERY embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.logger.log(`User's query embedding has been successfully generated.`);
    return data.embeddings[0];
  }
}
