import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export class UpdateJobDto {
  @ApiPropertyOptional({ example: 'CLOSED', enum: ['ACTIVE', 'CLOSED', 'DRAFT', 'FLAGGED'] })
  @IsOptional() @IsEnum(['ACTIVE', 'CLOSED', 'DRAFT', 'FLAGGED'])
  status?: string;

  @ApiPropertyOptional({ example: 'Updated job title' })
  @IsOptional() @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'New description...' })
  @IsOptional() @IsString()
  description?: string;
}
