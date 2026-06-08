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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDocumentDto {
  @ApiPropertyOptional({
    example: 'eiuh54o3-n5injkrt-rtoier-reoi459-34344$%',
    description:
      'Optional collectionId. If provided it will be used to create a message in a conversation in the collectio, else the "General collection" will be used.',
  })
  @IsString()
  @IsOptional()
  collectionId?: string;

  @ApiProperty({
    description: 'The name of the attached file will be used here',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  original_filename: string;

  @ApiProperty({
    example: 'PDF',
    description: `Must be an enum from ${JSON.stringify(DocumentFileType)}`,
  })
  @IsEnum(DocumentFileType, {
    message: 'Must be an option from enum- DocumentFileType',
  })
  @IsNotEmpty()
  file_type: DocumentFileType;

  @ApiProperty({ description: 'The size of the file in bytes.' })
  @IsNumber()
  @IsNotEmpty()
  @Max(20 * 1024 * 1024)
  file_size_bytes: number;

  @ApiProperty({
    description: 'The s3 key generated from the document service logic',
  })
  @IsString()
  @IsNotEmpty()
  s3_key: string;

  @ApiProperty({
    example: 'PENDING',
    description: `Must be an enum from ${JSON.stringify(DocumentStatus)}`,
  })
  @IsEnum(DocumentStatus, {
    message: 'Must be an option from enum- DocumentStatus',
  })
  @IsNotEmpty()
  status: DocumentStatus;

  @ApiPropertyOptional({
    description: 'Optional status message for the document uploaded',
  })
  @IsString()
  @IsOptional()
  statusMessage?: string;

  //   @IsNumber()
  //   @IsNotEmpty()
  //   pageCount: number;

  @ApiProperty({
    description: 'This data is provided in document service codebase',
  })
  @IsString()
  @IsNotEmpty()
  checkSum: string;
}
