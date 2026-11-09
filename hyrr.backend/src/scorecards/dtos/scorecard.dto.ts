import { Transform, Type } from "class-transformer"
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator"

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value)

export const RECOMMENDATIONS = ["STRONG_YES", "YES", "NEUTRAL", "NO", "STRONG_NO"] as const
export type Recommendation = (typeof RECOMMENDATIONS)[number]

export class ScorecardRatingDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  competency: string

  @Type(() => Number)
  @IsInt({ message: "Scores are whole numbers from 1 to 5" })
  @Min(1, { message: "Scores are whole numbers from 1 to 5" })
  @Max(5, { message: "Scores are whole numbers from 1 to 5" })
  score: number

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000, { message: "Notes can be at most 1000 characters" })
  notes?: string
}

export class SubmitScorecardDto {
  @IsIn(RECOMMENDATIONS as unknown as string[], { message: "Choose a recommendation" })
  recommendation: Recommendation

  @Transform(trim)
  @IsString()
  @MinLength(10, { message: "Write at least a sentence of overall feedback" })
  @MaxLength(4000, { message: "Overall feedback can be at most 4000 characters" })
  overallNotes: string

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ScorecardRatingDto)
  ratings: ScorecardRatingDto[]
}

export class ScorecardCompetenciesDto {
  @IsArray()
  @ArrayMinSize(1, { message: "Keep at least one criterion" })
  @ArrayMaxSize(8, { message: "Use at most 8 criteria" })
  @IsString({ each: true })
  @MinLength(2, { each: true, message: "Each criterion needs at least 2 characters" })
  @MaxLength(60, { each: true, message: "Each criterion can be at most 60 characters" })
  competencies: string[]
}
