import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCollectionDto {
  @ApiProperty({
    example: 'Q2 Research',
    description: 'Collection name (unique per user)',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'Research papers for Q2 analysis',
    description: 'Optional description',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
