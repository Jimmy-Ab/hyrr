import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
export class CreateCalendarEventDto {
  @IsOptional() @IsString() applicationId?: string;
  @IsString() @MaxLength(200) title: string;
  @IsDateString() startTime: string;
  @IsOptional() @IsDateString() endTime?: string;
  @IsEnum(['INTERVIEW', 'DEADLINE', 'OFFER', 'OTHER']) type: string;
  @IsOptional() @IsString() @MaxLength(1000) meetingUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) location?: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}
