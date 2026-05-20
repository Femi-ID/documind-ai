import { IsNotEmpty, IsString } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  collectionId: string;

  @IsString()
  @IsNotEmpty()
  question: string;
}
