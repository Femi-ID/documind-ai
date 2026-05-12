import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';
import { DocumentFileType } from '../enums/document-file-type.dto';
import { DocumentStatus } from '../enums/document-status.dto';

export class CreateUserDocumentDto {
  @IsString()
  @IsOptional()
  collectionId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  original_filename: string;

  @IsEnum(DocumentFileType, {
    message: 'Must be an option from enum- DocumentFileType',
  })
  @IsNotEmpty()
  file_type: DocumentFileType;

  @IsNumber()
  @IsNotEmpty()
  @Max(20 * 1024 * 1024)
  file_size_bytes: number;

  @IsString()
  @IsNotEmpty()
  s3_key: string;

  @IsEnum(DocumentStatus, {
    message: 'Must be an option from enum- DocumentStatus',
  })
  @IsNotEmpty()
  status: DocumentStatus;

  @IsString()
  @IsOptional()
  statusMessage?: string;

  //   @IsNumber()
  //   @IsNotEmpty()
  //   pageCount: number;

  @IsString()
  @IsNotEmpty()
  checkSum: string;
}
