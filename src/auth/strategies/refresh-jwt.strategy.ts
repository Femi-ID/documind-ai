import { Inject, Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import refreshJwtConfig from '../config/refresh-jwt.config';
import type { ConfigType } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayloadDto } from 'src/users/dto/jwt-payload.dto';

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'refresh-jwt') {
  private readonly logger = new Logger(RefreshStrategy.name);
  constructor(
    private authService: AuthService,
    @Inject(refreshJwtConfig.KEY)
    private refreshJwtConfiguration: ConfigType<typeof refreshJwtConfig>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: refreshJwtConfiguration.secret!,
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayloadDto) {
    this.logger.log('payload.sub', payload.sub);
    const refreshToken = req.get('authorization')?.replace('Bearer', '').trim();

    return await this.authService.validateRefreshToken(payload, refreshToken!);
    // returned data is appended to the request.user object
  }
}
