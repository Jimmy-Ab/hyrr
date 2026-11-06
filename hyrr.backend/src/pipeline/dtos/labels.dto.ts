import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator"

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value)

/** A design-token colour name ("purple") or a hex colour ("#7c3aed"). */
export const LABEL_COLOR_PATTERN = /^(?:[a-z][a-z0-9-]{0,19}|#[0-9a-fA-F]{6})$/
const COLOR_MESSAGE = "color must be a colour name (e.g. purple) or a #rrggbb hex value"

export class CreateLabelDto {
  @ApiProperty({ example: "Top talent" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  name: string

  @ApiProperty({ example: "purple" })
  @IsString()
  @Matches(LABEL_COLOR_PATTERN, { message: COLOR_MESSAGE })
  color: string
}

export class UpdateLabelDto {
  @ApiPropertyOptional({ example: "Top talent" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  name?: string

  @ApiPropertyOptional({ example: "green" })
  @IsOptional()
  @IsString()
  @Matches(LABEL_COLOR_PATTERN, { message: COLOR_MESSAGE })
  color?: string
}

export class SetLabelsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  labelIds: string[]
}
