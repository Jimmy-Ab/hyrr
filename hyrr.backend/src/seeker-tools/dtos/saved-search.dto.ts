import { PartialType } from "@nestjs/swagger"
import { EmploymentType } from "@prisma/client"
import { Transform, Type } from "class-transformer"
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator"

const trim = ({ value }: { value: any }) => (typeof value === "string" ? value.trim() : value)

export class SavedSearchFiltersDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) location?: string
  @IsOptional() @IsEnum(EmploymentType) type?: EmploymentType
  @IsOptional() @IsBoolean() remote?: boolean
  @IsOptional() @IsString() @MaxLength(64) categoryId?: string
  @IsOptional() @IsString() @MaxLength(30) tab?: string
}

export class CreateSavedSearchDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) name: string

  /** Free-text query; null / "" clears it. */
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(200)
  query?: string | null

  @IsObject()
  @ValidateNested()
  @Type(() => SavedSearchFiltersDto)
  filters: SavedSearchFiltersDto
}

export class UpdateSavedSearchDto extends PartialType(CreateSavedSearchDto) {}
