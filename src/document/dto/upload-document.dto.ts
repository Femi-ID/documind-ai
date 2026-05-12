import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UploadDocumentDto {
  @IsString()
  @IsOptional()
  @IsUUID()
  collectionId?: string;
}
