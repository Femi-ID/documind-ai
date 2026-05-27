import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { DocumentModule } from 'src/document/document.module';
import { VectorSearchService } from './services/vector-search.service';
import { ContextAssemblyService } from './services/context-assembly.service';
import { GoogleLlmService } from './services/google-llm.service';
import { OllamaLlmService } from './services/ollama-llm.service';

@Module({
  providers: [
    ConversationService,
    VectorSearchService,
    ContextAssemblyService,
    GoogleLlmService,
    OllamaLlmService,
  ],
  controllers: [ConversationController],
  imports: [DocumentModule],
})
export class ConversationModule {}
