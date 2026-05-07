import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { UserRequest } from './types/request.interface';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { Public } from './decorators/public.decorators';
import { RefreshAuthGuard } from './guards/refresh-auth.guard';

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

  @Public()
  @UseGuards(RefreshAuthGuard)
  @Post('refresh')
  async refreshToken(@Request() req: UserRequest) {
    console.log(`Request.user: ${JSON.stringify(req.user)}`);
    return await this.authService.generateNewTokens({
      sub: req.user.id,
      email: req.user.email,
      role: req.user.role,
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.ACCEPTED)
  async logOut(@Request() req: UserRequest) {
    await this.authService.logout(req.user.id);
    return { statusCode: 200, message: 'Logged out successfully' };
  }
}
