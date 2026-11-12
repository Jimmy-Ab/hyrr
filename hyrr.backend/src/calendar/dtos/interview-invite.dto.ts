import { Transform, Type } from "class-transformer"
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator"

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value)

export const INTERVIEW_DURATIONS = [15, 30, 45, 60, 90, 120] as const

export class InterviewSlotInputDto {
  @IsISO8601({ strict: true }, { message: "Each time must be a valid date and time" })
  startTime: string
}

export class CreateInterviewInviteDto {
  @IsUUID(undefined, { message: "Choose an application" })
  applicationId: string

  @Transform(trim)
  @IsString()
  @MinLength(2, { message: "Give the interview a title" })
  @MaxLength(120, { message: "The title can be at most 120 characters" })
  title: string

  @Type(() => Number)
  @IsIn(INTERVIEW_DURATIONS as unknown as number[], {
    message: "Duration must be 15, 30, 45, 60, 90 or 120 minutes",
  })
  durationMin: number

  @IsArray()
  @ArrayMinSize(1, { message: "Offer at least one time" })
  @ArrayMaxSize(10, { message: "Offer at most 10 times" })
  @ValidateNested({ each: true })
  @Type(() => InterviewSlotInputDto)
  slots: InterviewSlotInputDto[]

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200, { message: "Location can be at most 200 characters" })
  location?: string

  @IsOptional()
  @Transform(trim)
  @IsUrl(
    { require_protocol: true, protocols: ["http", "https"] },
    { message: "Enter a valid meeting link, e.g. https://meet.google.com/…" }
  )
  @MaxLength(500)
  meetingUrl?: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000, { message: "The note can be at most 1000 characters" })
  note?: string
}

export class BookInterviewSlotDto {
  @IsUUID(undefined, { message: "Choose a time" })
  slotId: string
}
