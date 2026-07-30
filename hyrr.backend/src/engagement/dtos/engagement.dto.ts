import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator"

export class CreateEmailTemplateDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name: string
  @IsString() @IsNotEmpty() @MaxLength(80) kind: string
  @IsString() @IsNotEmpty() @MaxLength(200) subject: string
  @IsString() @IsNotEmpty() @MaxLength(10000) body: string
}

export class CreateAvailabilityDto {
  @IsDateString() startTime: string
  @IsDateString() endTime: string
  @IsOptional() @IsString() @MaxLength(1000) meetingUrl?: string
}

export class ReserveAvailabilityDto {
  @IsString() @IsNotEmpty() applicationId: string
}
