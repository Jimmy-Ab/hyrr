import { Transform, Type } from "class-transformer"
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator"

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value)

export class TalentSearchQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  q?: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  location?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}

export class OutreachDto {
  @IsUUID(undefined, { message: "Choose one of your open jobs" })
  jobId: string

  @Transform(trim)
  @IsString()
  @MinLength(20, { message: "Write a short personal message (at least 20 characters)" })
  @MaxLength(2000, { message: "The message can be at most 2000 characters" })
  message: string
}

export class OutreachResponseDto {
  @IsBoolean({ message: "Answer yes or no" })
  interested: boolean
}

export class TalentVisibilityDto {
  @IsBoolean()
  open: boolean
}
