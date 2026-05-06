import { Controller, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { UserRequest } from './types/request.interface';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { Public } from './decorators/public.decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: UserRequest) {
    return await this.authService.login(
      req.user.id,
      req.user.email,
      req.user.role,
    );
  }
}
