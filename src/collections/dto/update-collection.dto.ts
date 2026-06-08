import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateCollectionDto {
  @ApiPropertyOptional({ example: 'Q3 Research (Updated)' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description for the collection' })
  @IsString()
  @IsOptional()
  description?: string;
}
