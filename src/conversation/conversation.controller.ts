import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import type { UserRequest } from 'src/auth/types/request.interface';
import { SendMessageDto } from './dto/create-conversation.dto';
import { ConversationService } from './conversation.service';

@Controller('conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post(':collectionId')
  async createFirstMessageAndConversation(
    @Request() req: UserRequest,
    @Body() sendMessageDto: SendMessageDto,
    @Param('collectionId') collectionId: string,
  ) {
    sendMessageDto.collectionId = collectionId;
    return await this.conversationService.createFirstMessageAndConversation(
      req.user.id,
      sendMessageDto,
    );
  }

  @Post(':conversationId/messages')
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
