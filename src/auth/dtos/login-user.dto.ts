import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginUserDto {
  @ApiProperty({ example: 'john@gmail.com', description: 'User email address' })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '#sTRong-£p@s$worD',
    minLength: 8,
    description: 'Minimum of 8 characters',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
