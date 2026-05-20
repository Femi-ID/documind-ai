import { Injectable } from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ConversationService {
  constructor(private readonly prismaService: PrismaService) {}

  async createConversation(
    userId: string,
    createConversation: CreateConversationDto,
  ) {
    await this.prismaService.conversation.create({
        data: {}
    })
  }
}
