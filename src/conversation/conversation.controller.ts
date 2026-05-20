import { Body, Controller, Post, Request } from '@nestjs/common';
import type { UserRequest } from 'src/auth/types/request.interface';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationService } from './conversation.service';

@Controller('conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post('create')
  async createConversation(
    @Request() req: UserRequest,
    @Body() createConversationDto: CreateConversationDto,
  ) {
    return await this.conversationService.createConversation(
      req.user.id,
      createConversationDto,
    );
  }
}
