import { EventType } from "@prisma/client"
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from "class-validator"

/** Times are full ISO-8601 datetimes with offset, e.g. "2026-07-15T10:00:00.000Z" or "...+02:00". */
export class CreateCalendarEventDto {
  @IsOptional() @IsString() applicationId?: string
  @IsString() @MaxLength(200) title: string
  @IsISO8601({ strict: true }) startTime: string
  @IsOptional() @IsISO8601({ strict: true }) endTime?: string
  @IsEnum(EventType) type: EventType
  @IsOptional() @IsString() @MaxLength(1000) meetingUrl?: string
  @IsOptional() @IsString() @MaxLength(500) location?: string
  @IsOptional() @IsString() @MaxLength(5000) notes?: string
}
