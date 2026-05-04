import {
  BadRequestException,
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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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
      // role: user.role,
    };
  }

  async login(userId: string, email: string, userRole?: Role) {
    const payload = { sub: userId, email: email };
    const accessToken = await this.generateToken(payload);

    // await this.usersService.hashAndStoreRefreshToken(userId, refreshToken);
    // this.logger.log({ accessToken: accessToken, refreshToken: refreshToken });
    // return { accessToken: accessToken, refreshToken: refreshToken };
    return { accessToken: accessToken };
  }

  async generateToken(payload: JwtPayloadDto) {
    // const [accessToken, refreshToken] = await Promise.all([
    //   this.jwtService.signAsync(payload),
    //   this.jwtService.signAsync(payload, this.refreshTokenConfig),
    // ]);
    return await this.jwtService.signAsync(payload);
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

    // if (payload.role !== user.role || payload.email !== user.email)
    //   throw new UnauthorizedException(
    //     "Payload role/email doesn't match the user's info",
    //   );
    const currentUser = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    return currentUser;
  }
}
