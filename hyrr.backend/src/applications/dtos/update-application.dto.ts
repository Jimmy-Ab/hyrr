import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export class UpdateApplicationDto {
  @ApiPropertyOptional({ enum: ['SAVED', 'APPLIED', 'IN_PROCESS', 'OFFER', 'ARCHIVED'] })
  @IsOptional() @IsEnum(['SAVED', 'APPLIED', 'IN_PROCESS', 'OFFER', 'ARCHIVED'])
  status?: string;

  @ApiPropertyOptional({ example: 'Technical Interview', description: 'Pipeline sub-stage tag' })
  @IsOptional() @IsString()
  tag?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean()
  recruiterBookmarked?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean()
  seekerBookmarked?: boolean;

  @ApiPropertyOptional({ example: '$185,000 + equity' })
  @IsOptional() @IsString()
  offerAmount?: string;

  @ApiPropertyOptional({ example: 'Strong React skills...' })
  @IsOptional() @IsString()
  notes?: string;
}
