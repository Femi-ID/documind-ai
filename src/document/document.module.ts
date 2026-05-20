import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { MinioModule } from 'src/minio/minio.module';
import { QueueModule } from 'src/queue/queue.module';
import { BullModule } from '@nestjs/bullmq';
import { DocumentProcessingConsumer } from 'src/document/consumers/document-processing.consumer';
import { QUEUE } from './constants';
import { TextExtractionService } from './services/text-extraction.service';
import { ChunkingService } from './services/chunking.service';
import { EmbeddingService } from './services/google-embedding.service';

@Module({
  providers: [
    DocumentService,
    DocumentProcessingConsumer,
    TextExtractionService,
    ChunkingService,
    EmbeddingService,
  ],
  controllers: [DocumentController],
  imports: [
    MinioModule,
    QueueModule,
    BullModule.registerQueue({ name: QUEUE.DOCUMENT_PROCESSING }),
  ],
})
export class DocumentModule {}
