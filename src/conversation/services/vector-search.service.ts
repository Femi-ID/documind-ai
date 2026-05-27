import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export interface RetrievedChunk {
  id: string;
  content: string;
  chunkIndex: number;
  pageNumber: number | null;
  similarity: number;
  documentId: string;
  originalFilename: string;
}

@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Finds the most semantically similar chunks to the query embedding,
   * scoped to documents in a specific collection owned by the user. pg-vector similarities query.
   */
  async findSimilarChunks(
    queryEmbedding: number[],
    collectionId: string,
    userId: string,
    topK: number = 5,
    similarityThreshold: number = 0.3,
  ): Promise<RetrievedChunk[]> {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    const results = await this.prismaService.$queryRawUnsafe<RetrievedChunk[]>(
      `
      SELECT 
        c."id",
        c."content",
        c."chunkIndex",
        c."pageNumber",
        c."documentId",
        d."original_filename" AS "originalFilename",
        1 - (c."embedding" <=> $1::vector) AS similarity
      FROM "Chunk" c
      JOIN "Document" d ON d."id" = c."documentId"
      WHERE d."collectionId" = $2
        AND d."userId" = $3
        AND c."embedding" IS NOT NULL
      ORDER BY c."embedding" <=> $1::vector
      LIMIT $4
      `,
      embeddingStr,
      collectionId,
      userId,
      topK,
    );

    // filter out the low similarity results
    const filtered = results.filter((r) => r.similarity >= similarityThreshold);
    this.logger.log(
      `Vector search result: ${results.length} results, ${filtered.length} result above threshold (${similarityThreshold})`,
    );

    return filtered;
  }
}
