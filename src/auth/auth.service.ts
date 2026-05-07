import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from 'src/users/enums/role.enums';
import { UsersService } from 'src/users/users.service';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { JwtPayloadDto } from 'src/users/dto/jwt-payload.dto';
import refreshJwtConfig from './config/refresh-jwt.config';
import type { ConfigType } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @Inject(refreshJwtConfig.KEY)
    private refreshTokenConfig: ConfigType<typeof refreshJwtConfig>,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.getUserByEmail(email);
    if (!user) throw new UnauthorizedException('Incorrect user credentials.');

    const isPasswordValid = await this.verifyPassword(
      user.hashed_password,
      password,
    );
    if (!isPasswordValid)
      throw new UnauthorizedException('Incorrect user credentials.');

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  async login(userId: string, email: string, userRole: Role) {
    const payload = { sub: userId, email: email, role: userRole };
    const { accessToken, refreshToken } = await this.generateTokens(payload);

    await this.usersService.hashAndStoreRefreshToken(userId, refreshToken);
    this.logger.log({ accessToken: accessToken, refreshToken: refreshToken });
    return { accessToken: accessToken, refreshToken: refreshToken };
  }

  async generateTokens(payload: JwtPayloadDto) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, this.refreshTokenConfig),
    ]);
    // return await this.jwtService.signAsync(payload);
    return { accessToken, refreshToken };
  }

  async verifyPassword(
    hashedPassword: string,
    plainPassword: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(hashedPassword, plainPassword);
    } catch (error) {
      this.logger.log(`Error verifying password`, error);
      throw new InternalServerErrorException('Could not verify password');
    }
  }

  async validateJwtUser(payload: JwtPayloadDto) {
    const user = await this.usersService.getUserByEmail(payload.email);
    if (!user) throw new BadRequestException('Invalid userId provided.');

    if (payload.role !== user.role || payload.email !== user.email)
      throw new UnauthorizedException(
        "Payload's information doesn't match the user's info",
      );
    const currentUser = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    return currentUser;
  }

  async validateRefreshToken(payload: JwtPayloadDto, refreshToken: string) {
    try {
      const user = await this.usersService.getUserById(payload.sub);
      if (!user.hashed_refresh_token)
        throw new UnauthorizedException('Invalid refresh token!');

      const refreshTokenMatches = await argon2.verify(
        user.hashed_refresh_token,
        refreshToken,
      );
      if (!refreshTokenMatches)
        throw new UnauthorizedException('Invalid refresh token...');
      return { id: payload.sub, email: payload.email, role: payload.role };
      // return { ...payload };
    } catch (error) {
      this.logger.error(error);
      throw new UnauthorizedException({
        message: 'Unable to validate refresh token...',
      });
    }
  }

  async generateNewTokens(payload: JwtPayloadDto) {
    const { accessToken, refreshToken } = await this.generateTokens(payload);
    await this.usersService.hashAndStoreRefreshToken(payload.sub, refreshToken);

    this.logger.log({ accessToken: accessToken, refreshToken: refreshToken });
    return { accessToken: accessToken, refreshToken: refreshToken };
  }

  async logout(userId: string) {
    await this.usersService.hashAndStoreRefreshToken(userId, '');
  }
}
