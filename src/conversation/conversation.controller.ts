import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { UserRequest } from 'src/auth/types/request.interface';
import { SendMessageDto } from './dto/create-conversation.dto';
import { ConversationService } from './conversation.service';
import { SkipThrottle } from '@nestjs/throttler';
import { CustomThrottlers } from 'src/common/constants/custom-throttlers.constant';
import { PromptInjectionGuard } from 'src/common/guards/prompt-injection.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Conversations')
@ApiBearerAuth('access-token')
@Controller({ version: '1', path: 'conversation' })
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @SkipThrottle({
    [CustomThrottlers.DEFAULT]: true, // this bypasses the global DEFAULT throttler
    [CustomThrottlers.STRICT]: false, // wakes up the STRICT throttler with the same setting set in app.module.ts
  })
  @UseGuards(PromptInjectionGuard)
  @ApiOperation({
    summary: 'Start a new conversation with a question',
    description:
      'Creates a new conversation in the specified collection, runs the full ' +
      'RAG pipeline (embed → vector search → context assembly → LLM), and ' +
      'returns a cited answer. Cached answers return instantly.',
  })
  @ApiParam({
    name: 'collectionId',
    description: 'Collection to query against',
    format: 'uuid',
  })
  @ApiResponse({
    status: 201,
    description: 'Conversation created with AI response',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or prompt injection detected',
  })
  @Post(':collectionId')
  async createFirstMessageAndConversation(
    @Request() req: UserRequest,
    @Body() sendMessageDto: SendMessageDto,
    @Param('collectionId') collectionId: string,
  ) {
    sendMessageDto.collectionId = collectionId;
    return await this.conversationService.createFirstMessageAndConversation(
      req.user.id,
      collectionId,
      sendMessageDto,
    );
  }

  @SkipThrottle({
    [CustomThrottlers.DEFAULT]: true, // this bypasses the global DEFAULT throttler
    [CustomThrottlers.STRICT]: false, // wakes up the STRICT throttler with the same setting set in app.module.ts
  })
  @UseGuards(PromptInjectionGuard)
  @ApiOperation({
    summary: 'Send a follow-up message in an existing conversation',
    description:
      'Sends a follow-up message with the last 10 messages as context. ' +
      'Not cached — each follow-up question runs the full RAG pipeline.',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'Conversation ID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 201,
    description: 'Follow-up response with citations',
  })
  @Post(':conversationId/message')
  async sendMessage(
    @Request() req: UserRequest,
    @Body() sendMessageDto: SendMessageDto,
    @Param('conversationId') conversationId: string,
  ) {
    return await this.conversationService.createMessage(
      req.user.id,
      sendMessageDto,
      conversationId,
    );
  }

  @ApiOperation({
    summary: 'List all conversations for the authenticated user',
  })
  @ApiQuery({
    name: 'collectionId',
    required: false,
    description: 'Filter by collection',
  })
  @ApiResponse({ status: 200, description: 'Returns list of conversations' })
  @Get('all')
  async listConversations(
    @Request() req: UserRequest,
    @Query('collectionId') collectionId?: string,
  ) {
    return await this.conversationService.listConversations(
      req.user.id,
      collectionId,
    );
  }

  @ApiOperation({ summary: 'Get a conversation with all messages' })
  @ApiParam({ name: 'id', description: 'Conversation ID', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Returns conversation with messages',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @Get(':id')
  async getConversation(
    @Request() req: UserRequest,
    @Param('id') conversationId: string,
  ) {
    return await this.conversationService.getConversation(
      req.user.id,
      conversationId,
    );
  }

  @ApiOperation({ summary: 'Delete a conversation (soft delete)' })
  @ApiParam({ name: 'id', description: 'Conversation ID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Conversation deactivated' })
  @Delete(':id')
  async deleteConversation(
    @Request() req: UserRequest,
    @Param('id') conversationId: string,
  ) {
    return await this.conversationService.deleteConversation(
      req.user.id,
      conversationId,
    );
  }
}
