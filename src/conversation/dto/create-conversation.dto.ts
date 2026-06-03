import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Question cannot be empty.' })
  @MinLength(3, { message: 'Question must be at least 3 characters.' })
  @MaxLength(2000, { message: 'Question must be at most 1000 characters.' })
  // 2000 questions is about 500 tokens which is enough for a real question but short enough to prevent an abuse and keeps the context window budget predictable.
  content: string;

  @IsString()
  @IsOptional()
  collectionId?: string;
}
