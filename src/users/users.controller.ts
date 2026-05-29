import { Body, Controller, Get, Logger, Post, Request } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';
import type { UserRequest } from 'src/auth/types/request.interface';
import { Public } from 'src/auth/decorators/public.decorators';
import { SkipThrottle } from '@nestjs/throttler';
import { CustomThrottlers } from 'src/common/constants/custom-throttlers.constant';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  // @Throttle({ default: { ttl: seconds(60), limit: 10 } })
  @SkipThrottle({
    [CustomThrottlers.DEFAULT]: true, // this turns off the DEFAULT throttler
    [CustomThrottlers.STRICT]: false, // wakes up the STRICT throttler with the same setting set in app.module.ts
  })
  @Public()
  @Post('create')
  async createUser(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.createUser(createUserDto);
  }

  @Get('profile')
  async getProfile(@Request() req: UserRequest) {
    this.logger.log(`From req.user: ${JSON.stringify(req.user)}`);
    return await this.usersService.getUserProfile(req.user.id);
  }
}
