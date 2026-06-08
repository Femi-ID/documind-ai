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
import { SkipThrottle } from '@nestjs/throttler';
import { CustomThrottlers } from 'src/common/constants/custom-throttlers.constant';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

// @Throttle({ default: { ttl: seconds(60), limit: 10 } }) // 10 requests per minute
@SkipThrottle({
  [CustomThrottlers.DEFAULT]: true, //sets DEFAULT off
  [CustomThrottlers.STRICT]: false, // wakes up STRICT throttler with default settings.
})
@ApiTags('Auth')
@Controller({ version: '1', path: 'auth' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login with email and password.' })
  @ApiResponse({
    status: 200,
    description: 'Returns access and refresh tokens',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
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
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: 200,
    description: 'Returns new access and refresh tokens.',
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @Post('refresh')
  async refreshToken(@Request() req: UserRequest) {
    console.log(`Request.user: ${JSON.stringify(req.user)}`);
    return await this.authService.generateNewTokens({
      sub: req.user.id,
      email: req.user.email,
      role: req.user.role,
    });
  }

  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  @Post('logout')
  @HttpCode(HttpStatus.ACCEPTED)
  async logOut(@Request() req: UserRequest) {
    await this.authService.logout(req.user.id);
    return { statusCode: 204, message: 'Logged out successfully' };
  }
}
