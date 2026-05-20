import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Injectable, Logger } from '@nestjs/common';
import { TextChunk } from '../interfaces/document.interface';

@Injectable()
export class ChunkingService {
  private readonly logger = new Logger(ChunkingService.name);

  private readonly splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512, // target tokens per chunk
    chunkOverlap: 50, // the overlap btwn consecutive chunks
    separators: ['\n\n', '\n', '. ', ' ', ''],
    // These separators define the hierarchy:
    // try double newlines (paragraphs) first, then single newlines,
    // then sentences, then words, then characters as the last resort
  });

  async chunkText(text: string): Promise<TextChunk[]> {
    // langChain will return the doc objects with pageContent and metadata
    const docs = await this.splitter.createDocuments([text]);

    const chunks: TextChunk[] = docs.map((doc, index) => {
      const startCharOffset = text.indexOf(doc.pageContent);
      return {
        content: doc.pageContent,
        chunkIndex: index,
        tokenCount: Math.ceil(doc.pageContent.length / 4),
        startCharOffset: startCharOffset !== -1 ? startCharOffset : 0,
        endCharOffset:
          startCharOffset !== -1
            ? startCharOffset + doc.pageContent.length
            : doc.pageContent.length,
      };
    });

    this.logger.log(
      `Text chunked into ${chunks.length} pieces, ` +
        `(avg ${Math.round(text.length / chunks.length)} chars each )`,
    );
    return chunks;
  }
}
