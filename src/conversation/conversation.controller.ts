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

@Controller('conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @SkipThrottle({
    [CustomThrottlers.DEFAULT]: true, // this bypasses the global DEFAULT throttler
    [CustomThrottlers.STRICT]: false, // wakes up the STRICT throttler with the same setting set in app.module.ts
  })
  @UseGuards(PromptInjectionGuard)
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
