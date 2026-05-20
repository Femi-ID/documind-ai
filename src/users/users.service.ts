import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(private readonly prismaService: PrismaService) {}

  async getUserById(id: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: id },
    });
    if (!user) throw new NotFoundException('User not found..');
    return user;
  }

  async getUserByEmail(email: string) {
    const user = await this.prismaService.user.findUnique({
      where: { email: email },
    });
    // if (!user) throw new NotFoundException('User not found..');
    return user;
  }

  async createUser(
    createUserDto: Prisma.UserCreateWithoutCollectionsInput,
    // createUserDto: CreateUserDto,
  ) {
    try {
      const { hashed_password, ...remainingUserDto } = createUserDto;
      const userExists = await this.getUserByEmail(createUserDto.email);
      if (userExists)
        throw new BadRequestException(
          'An account with this email already exists..',
        );

      const argon2hashedPassword = await this.hashPassword(hashed_password);
      console.log(`argon2hashed: ${argon2hashedPassword}`);
      return await this.prismaService.user.create({
        data: {
          ...remainingUserDto,
          hashed_password: argon2hashedPassword,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientValidationError) {
        throw new BadRequestException('Invalid user data provided');
      }

      console.error(error);
      throw new InternalServerErrorException('Unable to create user account');
    }
  }

  async hashPassword(password: string) {
    try {
      return await argon2.hash(password);
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to hash password');
    }
  }

  async getUserProfile(id: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: id },
      include: {
        collections: { select: { name: true } },
        documents: {
          select: { id: true, original_filename: true, totalChunks: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found..');
    return user;
  }

  async hashAndStoreRefreshToken(userId: string, refreshToken: string) {
    try {
      if (refreshToken == '') {
        await this.updateUserRefreshToken(userId, refreshToken);
      } else {
        const hashedRefreshToken = await argon2.hash(refreshToken);
        await this.updateUserRefreshToken(userId, hashedRefreshToken);
      }
    } catch (err) {
      console.error(err);
      throw new Error('Failed to update user refresh token');
    }
  }

  async updateUserRefreshToken(userId: string, hashedRefreshToken: string) {
    await this.prismaService.user.update({
      where: { id: userId },
      data: { hashed_refresh_token: hashedRefreshToken },
    });
  }

  async UserDocumentCount(userId: string): Promise<number> {
    const user = await this.getUserById(userId);
    return user.document_count; // search how to retrieve a particular field from a model instead of everything
  }
}
