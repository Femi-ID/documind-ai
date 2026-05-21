import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { SendMessageDto } from './dto/create-conversation.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessageRole } from 'src/generated/prisma/enums';

@Injectable()
export class ConversationService {
  constructor(private readonly prismaService: PrismaService) {}

  async createFirstMessageAndConversation(
    userId: string,
    sendMessageDto: SendMessageDto,
  ) {
    // using a transaction so both queries fail or succeed together
    return this.prismaService.$transaction(async (tx) => {
      //  create the conversation
      const newConversation = await tx.conversation.create({
        data: {
          user: { connect: { id: userId } },
          collection: {
            connect: { id: sendMessageDto.collectionId },
          },
        },
        select: { id: true, userId: true, collectionId: true, messages: true },
      });

      // create the message
      const newMessage = await tx.message.create({
        data: {
          conversation: { connect: { id: newConversation.id } },
          role: MessageRole.USER,
          content: sendMessageDto.content,
        },
      });

      return { newConversation, newMessage };
    });
  }

  async createMessage(
    userId: string,
    sendMessageDto: SendMessageDto,
    conversationId: string,
  ) {
    const userOwnsConversation =
      await this.prismaService.conversation.findFirst({
        where: { userId: userId, id: conversationId, isActive: true },
      });

    if (userOwnsConversation) {
      // create the message
      const message = await this.prismaService.message.create({
        data: {
          conversation: { connect: { id: conversationId } },
          role: MessageRole.USER,
          content: sendMessageDto.content,
        },
      });
      return message;
    } else {
      throw new UnauthorizedException(
        `User with id- (${userId}) is not permitted to send messages to this conversation`,
      );
    }
  }

  async listConversations(userId: string, collectionId?: string) {
    // const conversations =
    //   (await this.prismaService.conversation.findMany({
    //     where: { userId: userId, collectionId: collectionId },
    //   })) ??
    //   (await this.prismaService.conversation.findMany({
    //     where: { userId: userId },
    //   }));

    // const conversations = collectionId
    //   ? await this.prismaService.conversation.findMany({
    //       where: { userId: userId, collectionId: collectionId, isActive: true },
    //       select: { id: true, title: true, isActive: true },
    //     })
    //   : await this.prismaService.conversation.findMany({
    //       where: { userId: userId, isActive: true },
    //       select: { id: true, title: true, isActive: true },
    //     });
    const where: any = { userId, isActive: true };
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
    // CAN A CRON JOB BE USED TO DELETE THIS CONVERSATION AFTER A WEEK
    // await this.prismaService.conversation.delete({
    //   where: { id: conversationId, userId: userId },
    // });

    return await this.prismaService.conversation.update({
      where: { id: conversationId, userId: userId },
      data: { isActive: false },
      select: { id: true, userId: true, isActive: true, updatedAt: true },
    });
  }
}

// Should there be a delete message option
