import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'john@gmail.com', description: 'User email address' })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'john doe',
    minLength: 2,
    maxLength: 200,
    description: 'Minimum characters- 2, maximum characters- 200',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  full_name: string;

  @ApiProperty({
    example: '#Strong-£P@s$worD',
    minLength: 8,
    description: 'Minimum of 8 characters',
  })
  @IsString()
  @IsNotEmpty()
  hashed_password: string;
}
