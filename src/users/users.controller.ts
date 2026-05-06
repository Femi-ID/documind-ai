import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import type { UserRequest } from 'src/auth/types/request.interface';
import { Public } from 'src/auth/decorators/public.decorators';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Post('create')
  async createUser(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.createUser(createUserDto);
  }

  @Get('profile')
  async getProfile(@Request() req: UserRequest) {
    console.log(`user: ${JSON.stringify(req.user)}`);
    return await this.usersService.getUserProfile(req.user.id);
  }
}
