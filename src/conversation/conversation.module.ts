import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { DocumentModule } from 'src/document/document.module';
import { VectorSearchService } from './services/vector-search.service';
import { ContextAssemblyService } from './services/context-assembly.service';
import { GoogleLlmService } from './services/google-llm.service';
import { OllamaLlmService } from './services/ollama-llm.service';
import { QueryCacheService } from 'src/query-cache/query-cache.service';
import { EMBEDDING_SERVICE, LLM_SERVICE } from './conversations.tokens';
import { ConfigService } from '@nestjs/config';
import { OllamaEmbeddingService } from 'src/document/services/ollama-embedding.service';
import { GoogleEmbeddingService } from 'src/document/services/google-embedding.service';

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
    ConversationService,
    VectorSearchService,
    ContextAssemblyService,
    GoogleLlmService,
    OllamaLlmService,
    QueryCacheService,
    ...factoryProviders,
  ],
  controllers: [ConversationController],
  imports: [DocumentModule],
})
export class ConversationModule {}
