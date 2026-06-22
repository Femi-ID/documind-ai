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
import { OllamaEmbeddingService } from './services/ollama-embedding.service';
import { QueryCacheService } from 'src/query-cache/query-cache.service';
import { GoogleEmbeddingService } from './services/google-embedding.service';
import { ConfigService } from '@nestjs/config';
import {
  EMBEDDING_SERVICE,
  LLM_SERVICE,
} from 'src/conversation/conversations.tokens';
import { OllamaLlmService } from 'src/conversation/services/ollama-llm.service';
import { GoogleLlmService } from 'src/conversation/services/google-llm.service';

const factoryProviders = [
  {
    provide: EMBEDDING_SERVICE,
    useFactory: (
      configService: ConfigService,
      ollama: OllamaEmbeddingService,
      google: GoogleEmbeddingService,
    ) => {
      const provider = configService.get<string>(
        'EMBEDDING_PROVIDER',
        'ollama',
      );
      console.log(`[EmbeddingService] Using provider: ${provider}`);
      return provider === 'gemini' ? google : ollama;
    },
    inject: [ConfigService, OllamaEmbeddingService, GoogleEmbeddingService],
  },
  {
    provide: LLM_SERVICE,
    useFactory: (
      configService: ConfigService,
      ollama: OllamaLlmService,
      google: GoogleLlmService,
    ) => {
      const provider = configService.get<string>('LLM_PROVIDER', 'ollama');
      console.log(`[LlmService] Using provider: ${provider}`);
      return provider === 'gemini' ? google : ollama;
    },
    inject: [ConfigService, OllamaLlmService, GoogleLlmService],
  },
  OllamaEmbeddingService,
  GoogleEmbeddingService,
  OllamaLlmService,
  GoogleLlmService,
];

@Module({
  providers: [
    DocumentService,
    DocumentProcessingConsumer,
    TextExtractionService,
    ChunkingService,
    OllamaEmbeddingService,
    QueryCacheService,
    GoogleEmbeddingService,
    ...factoryProviders,
  ],
  controllers: [DocumentController],
  imports: [
    MinioModule,
    QueueModule,
    BullModule.registerQueue({ name: QUEUE.DOCUMENT_PROCESSING }),
  ],
  exports: [DocumentService, OllamaEmbeddingService],
})
export class DocumentModule {}
