// this is a consumer for the extract-text job.
// A consumer is a class defining methods that either process jobs added into the queue,
// or listen for events on the queue, or both.

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DocumentFileType, DocumentStatus } from 'src/generated/prisma/enums';
import { MinioService } from 'src/minio/minio.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { DocumentProcessingJobData } from '../interfaces/document.interface';
import { TextExtractionService } from '../services/text-extraction.service';
import { ChunkingService } from '../services/chunking.service';
import { QUEUE } from '../constants';
import { DocumentService } from '../document.service';
import { OllamaEmbeddingService } from '../services/ollama-embedding.service';
import { QueryCacheService } from 'src/query-cache/query-cache.service';
import { EMBEDDING_SERVICE } from 'src/conversation/conversations.tokens';

@Processor(QUEUE.DOCUMENT_PROCESSING) // name of the queue the class picks jobs from
export class DocumentProcessingConsumer extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessingConsumer.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly minioService: MinioService,
    private readonly textExtractionService: TextExtractionService,
    private readonly chunkingService: ChunkingService,
    @Inject(EMBEDDING_SERVICE)
    private readonly embeddingService: OllamaEmbeddingService,
    private readonly documentService: DocumentService,
    private readonly queryCacheService: QueryCacheService,
  ) {
    super();
  }

  async process(job: Job<DocumentProcessingJobData>): Promise<void> {
    this.logger.log(
      `Processing document ${JSON.stringify(job.data.documentId)}`,
    );
    const { documentId, s3key, userId } = job.data;

    try {
      // Mark as PROCESSING so the frontend can show a spinner
      await this.prismaService.document.update({
        where: { id: documentId },
        data: { status: DocumentStatus.PROCESSING },
      });

      // Download file buffer from MinIO using the document's s3_key
      const buffer = await this.minioService.getFileAsBuffer(s3key);
      this.logger.log(`Downloaded ${buffer.length} bytes from ${s3key}`);
      await job.updateProgress(10);

      // Look for the document in the document table
      const document = await this.prismaService.document.findUniqueOrThrow({
        where: { id: documentId },
        select: { file_type: true, collectionId: true },
      });

      // Step 2: Extract text (pdf-parse for PDFs, mammoth for DOCX, raw for TXT)
      const { text, pageCount } = await this.textExtractionService.extract(
        buffer,
        document.file_type as DocumentFileType,
      );
      await job.updateProgress(30);
      this.logger.log(
        `Extracted ${text.length} chars from document- ${documentId}`,
      );
      if (!text.trim()) {
        throw new Error('No text could be extracted from the document');
      }

      // Step 3: Chunk the text (recursive text splitter, 512 tokens, 50 overlap)
      const chunks = await this.chunkingService.chunkText(text);
      await job.updateProgress(50);

      // Step 4: Generate embeddings through OpenAI text-embedding-3-small
      const chunkTexts = chunks.map((c) => c.content);
      const embeddings =
        await this.embeddingService.generateEmbeddings(chunkTexts);
      await job.updateProgress(70);

      // Step 5: Store chunks and vectors in the chunks table
      const chunksWithEmbeddings = chunks.map((chunk, i) => ({
        ...chunk,
        embedding: embeddings[i],
      }));
      const insertedCount = await this.prismaService.storeChunksWithVectors(
        documentId,
        chunksWithEmbeddings,
      );
      await job.updateProgress(90);

      // Step 6: Update document status to 'completed' + set total_chunks
      await this.prismaService.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.COMPLETED,
          totalChunks: insertedCount,
          pageCount: pageCount ?? null,
        },
      });
      await job.updateProgress(100);
      this.logger.log(
        `Document ${documentId} SUCCESSFULLY processed: ${insertedCount} chunks stored`,
      );

      await this.queryCacheService.invalidateCollection(document.collectionId);
      this.logger.log(
        `Invalidated quey cache for collection: ${document.collectionId}`,
      );
    } catch (error) {
      // The first TWO attempts set status to FAILED and re-throw for BullMQ to retry.
      // Attempt 3 (the final one) cleans up the document entirely so the user can re-upload.
      this.logger.error(
        `Failed to process document ${documentId}: ${error.message}`,
        error.stack,
      );

      // update document status to failed
      await this.prismaService.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.FAILED,
          statusMessage: error.message.slice(0, 255),
        },
      });

      // On the final attempt, delete the document from the both database and minIO
      const maxAttempts = job.opts.attempts ?? 3;
      if (job.attemptsMade >= maxAttempts) {
        this.logger.warn(
          `All ${maxAttempts} exhausted for document ${documentId}. DELETING from both database and bucket.`,
        );
      }
      try {
        await this.minioService.deleteFile(s3key);
        await this.prismaService.document.delete({ where: { id: documentId } });
        this.logger.log(
          `DELETED failed document ${documentId} from DB and MinIO bucket.`,
        );
      } catch (cleanupErr) {
        this.logger.log(
          `Cleaned failed for document ${documentId}: ${cleanupErr.message}`,
        );
      }
      throw error;
    }
  }
}
