import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    example: 'What are the key findings in section 3?',
    description: 'The question to ask against the document collection',
    minLength: 3,
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Question cannot be empty.' })
  @MinLength(3, { message: 'Question must be at least 3 characters.' })
  @MaxLength(2000, { message: 'Question must be at most 1000 characters.' })
  // 2000 questions is about 500 tokens which is enough for a real question but short enough to prevent an abuse and keeps the context window budget predictable.
  content: string;

  @ApiPropertyOptional({
    example: 'eiuh54o3-n5injkrt-rtoier-reoi459-34344$%',
    description:
      'Optional collectionId. If provided it will be used to create a message in a conversation in the collection.',
  })
  @IsString()
  @IsOptional()
  collectionId?: string;
}
