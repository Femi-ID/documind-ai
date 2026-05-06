import { registerAs } from '@nestjs/config';
import { JwtSignOptions } from '@nestjs/jwt';

export default registerAs(
  'refresh-jwt',
  (): JwtSignOptions => ({
    secret: process.env.JWT_REFRESH_TOKEN_SECRET,
    expiresIn: process.env
      .JWT_REFRESH_TOKEN_EXPIRY as unknown as `${number}${'s' | 'm' | 'h' | 'd'}`,
  }),
);
