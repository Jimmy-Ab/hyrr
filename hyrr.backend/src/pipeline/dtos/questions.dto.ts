import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Transform, Type } from "class-transformer"
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator"

export const MAX_SCREENING_QUESTIONS = 10

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value)

export class ScreeningQuestionInputDto {
  @ApiPropertyOptional({ description: "Existing question id (kept); omit for a new question" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string

  @ApiProperty({ example: "Do you have a valid work permit for Germany?" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question: string

  @ApiProperty({ example: true })
  @IsBoolean()
  required: boolean
}

export class ReplaceQuestionsDto {
  @ApiProperty({ type: [ScreeningQuestionInputDto] })
  @IsArray()
  @ArrayMaxSize(MAX_SCREENING_QUESTIONS)
  @ValidateNested({ each: true })
  @Type(() => ScreeningQuestionInputDto)
  questions: ScreeningQuestionInputDto[]
}
