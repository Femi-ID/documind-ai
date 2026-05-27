import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SendMessageDto } from './dto/create-conversation.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessageRole } from 'src/generated/prisma/enums';
// import { EmbeddingService } from 'src/document/services/google-embedding.service';
import { VectorSearchService } from './services/vector-search.service';
import { ContextAssemblyService } from './services/context-assembly.service';
import { OllamaLlmService } from './services/ollama-llm.service';
import { EmbeddingService } from 'src/document/services/ollama-embedding.service';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  constructor(
    private readonly prismaService: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorSearchService: VectorSearchService,
    private readonly contextAssemblyService: ContextAssemblyService,
    private readonly ollamaLLMService: OllamaLlmService,
  ) {}

  async createFirstMessageAndConversation(
    userId: string,
    collectionId: string,
    sendMessageDto: SendMessageDto,
  ) {
    //  Embed the question
    const queryEmbedding = await this.embeddingService.generateQueryEmbeddings(
      sendMessageDto.content,
    );

    // Vector similarity search
    const relevantChunks = await this.vectorSearchService.findSimilarChunks(
      queryEmbedding,
      collectionId,
      userId,
    );

    // Assemble the prompt
    const { systemPrompt, userPrompt } =
      this.contextAssemblyService.assemblePrompt(
        sendMessageDto.content,
        relevantChunks,
        [], // no conversationHistory for first message
      );

    //   Generate answer
    const llmResponse = await this.ollamaLLMService.generateAnswer(
      systemPrompt,
      userPrompt,
    );

    // store the conversation and messages using a transaction so ALL queries fail or succeed together
    // TODO: write the code block for a failed transaction.
    return this.prismaService.$transaction(async (tx) => {
      //  create the conversation
      const newConversation = await tx.conversation.create({
        data: {
          user: { connect: { id: userId } },
          collection: {
            connect: { id: sendMessageDto.collectionId },
          },
          title: sendMessageDto.content.slice(0, 100), //using the first question as title
        },
        select: {
          id: true,
          userId: true,
          collectionId: true,
          title: true,
          messages: true,
        },
      });

      // create the user's message
      await tx.message.create({
        data: {
          conversation: { connect: { id: newConversation.id } },
          role: MessageRole.USER,
          content: sendMessageDto.content,
        },
      });

      //   create the AI assistant's message with citations and metadata
      const assistantMessage = await tx.message.create({
        data: {
          conversation: { connect: { id: newConversation.id } },
          role: MessageRole.ASSISTANT,
          content: llmResponse.content,
          tokenUsage: llmResponse.tokenUsage,
          model: llmResponse.model,
          latencyMs: llmResponse.latencyMs,
          citations: relevantChunks.map((chunk) => ({
            chunkId: chunk.id,
            documentId: chunk.documentId,
            documentName: chunk.originalFilename,
            pageNumber: chunk.pageNumber,
            similarity: chunk.similarity,
          })),
        },
      });

      //   return { newConversation, userMessage, assistantMessage };
      this.logger.log(
        `CREATED first message in NEW conversation: ${newConversation.title}, AI response from (${assistantMessage.model}) 
        with duration of: ${llmResponse.latencyMs} and tokenUsage: ${JSON.stringify(assistantMessage.tokenUsage)}`,
      );
      return {
        conversationId: newConversation.id,
        answer: JSON.stringify(assistantMessage.content),
        citations: assistantMessage.citations,
        tokenUsage: assistantMessage.tokenUsage,
        model: llmResponse.model,
        latencyMs: llmResponse.latencyMs,
      };
    });
  }

  /**send a message to a conversation with history. */
  async createMessage(
    userId: string,
    sendMessageDto: SendMessageDto,
    conversationId: string,
  ) {
    // confirm user owns the conversation
    const conversation = await this.prismaService.conversation.findFirst({
      where: { userId, id: conversationId, isActive: true },
      select: {
        id: true,
        collectionId: true,
        messages: {
          orderBy: { createdAt: 'asc' }, // meaning the latest message first?
          select: { role: true, content: true },
          take: 10, // fetch last 10 messages for context
        },
      },
    });

    if (!conversation) {
      throw new UnauthorizedException(
        `User with id- (${userId}) is not permitted to send messages to this conversation`,
      );
    }

    //  Embed the user's question
    const queryEmbedding = await this.embeddingService.generateQueryEmbeddings(
      sendMessageDto.content,
    );

    // Vector similarity search scoped to the conversation's collection
    const relevantChunks = await this.vectorSearchService.findSimilarChunks(
      queryEmbedding,
      conversation.collectionId,
      userId,
    );

    // Assemble the user's and system's prompt with Conversation History
    const conversationHistory = conversation.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const { systemPrompt, userPrompt } =
      this.contextAssemblyService.assemblePrompt(
        sendMessageDto.content,
        relevantChunks,
        conversationHistory,
      );

    //   generate answer
    const llmResponse = await this.ollamaLLMService.generateAnswer(
      systemPrompt,
      userPrompt,
    );

    //  store both user and AI assistant messages
    return this.prismaService.$transaction(async (tx) => {
      await tx.message.create({
        data: {
          conversation: { connect: { id: conversationId } },
          role: MessageRole.USER,
          content: sendMessageDto.content,
        },
      });

      const assistantMessage = await tx.message.create({
        data: {
          conversation: { connect: { id: conversationId } },
          role: MessageRole.ASSISTANT,
          content: llmResponse.content,
          model: llmResponse.model,
          latencyMs: llmResponse.latencyMs,
          tokenUsage: llmResponse.tokenUsage ?? undefined,
          citations: relevantChunks.map((chunk) => ({
            chunkId: chunk.id,
            documentId: chunk.documentId,
            documentName: chunk.originalFilename,
            pageNumber: chunk.pageNumber,
            similarity: chunk.similarity,
          })),
        },
      });

      // update the conversation's updatedAt so it sorts to the top
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      return {
        conversationId,
        answer: assistantMessage.content,
        citations: assistantMessage.citations,
        model: llmResponse.model,
        latencyMs: llmResponse.latencyMs,
      };
    });
  }

  async listConversations(userId: string, collectionId?: string) {
    const where: { userId: string; isActive: boolean; collectionId?: string } =
      { userId, isActive: true };
    if (collectionId) {
      where.collectionId = collectionId;
    }
    const conversations = await this.prismaService.conversation.findMany({
      where,
      select: {
        id: true,
        title: true,
        isActive: true,
        collectionId: true,
        createdAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return conversations;
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prismaService.conversation.findUnique({
      where: { id: conversationId, userId: userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            citations: true,
            model: true,
            latencyMs: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new BadRequestException('Conversation not found.');
    }
    return conversation;
  }

  async deleteConversation(userId: string, conversationId: string) {
    // return await this.prismaService.conversation.update({
    //   where: { id: conversationId, userId: userId },
    //   data: { isActive: false },
    //   select: { id: true, userId: true, isActive: true, updatedAt: true },
    // });

    return await this.prismaService.conversation.delete({
      where: { id: conversationId, userId: userId },
    });
    // CAN A CRON JOB BE USED TO DELETE THIS CONVERSATION AFTER A WEEK version2 probably.
  }
}

// Should there be a delete message service
