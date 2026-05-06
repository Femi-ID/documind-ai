import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import jwtConfig from '../config/jwt.config';
import type { ConfigType } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { JwtPayloadDto } from 'src/users/dto/jwt-payload.dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    @Inject(jwtConfig.KEY)
    private jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfiguration.secret!,
    });
  }

  async validate(payload: JwtPayloadDto) {
    // console.log('payload.sub: ', payload.sub);
    const result = await this.authService.validateJwtUser({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    });
    return result;
    // can also search for the userId in a list of revoked tokens
    // note: the response from here will used for the request.user object
  }
}
