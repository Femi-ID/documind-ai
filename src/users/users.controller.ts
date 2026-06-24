import { Body, Controller, Get, Logger, Post, Request } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';
import type { UserRequest } from 'src/auth/types/request.interface';
import { Public } from 'src/auth/decorators/public.decorators';
import { SkipThrottle } from '@nestjs/throttler';
import { CustomThrottlers } from 'src/common/constants/custom-throttlers.constant';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Users')
// @ApiBearerAuth('access-token')
@Controller({ version: '1', path: 'users' })
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  // @Throttle({ default: { ttl: seconds(60), limit: 10 } })
  @SkipThrottle({
    [CustomThrottlers.DEFAULT]: true, // this turns off the DEFAULT throttler
    [CustomThrottlers.STRICT]: false, // wakes up the STRICT throttler with the same setting set in app.module.ts
  })
  @Public()
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @Post('create')
  async createUser(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.createUs       er(createUserDto);
  }

  @ApiOperation({ summary: 'Get the currently logged in user profile' })
  @ApiResponse({ status: 200, description: 'Returns user profile' })
  @ApiBearerAuth('access-token')
  @Get('profile')
  async getProfile(@Request() req: UserRequest) {
    this.logger.log(`From req.user: ${JSON.stringify(req.user)}`);
    return await this.usersService.getUserProfile(req.user.id);
  }
}
