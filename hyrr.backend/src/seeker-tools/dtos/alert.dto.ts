import { PartialType } from "@nestjs/swagger"
import { AlertFrequency, EmploymentType } from "@prisma/client"
import { Transform } from "class-transformer"
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator"

const trim = ({ value }: { value: any }) => (typeof value === "string" ? value.trim() : value)
/** Trims list entries and drops blanks/duplicates (case-insensitive). */
const cleanList = ({ value }: { value: any }) => {
  if (!Array.isArray(value)) return value
  const seen = new Set<string>()
  const out: any[] = []
  for (const item of value) {
    if (typeof item !== "string") {
      out.push(item)
      continue
    }
    const text = item.trim()
    if (!text || seen.has(text.toLowerCase())) continue
    seen.add(text.toLowerCase())
    out.push(text)
  }
  return out
}

export class CreateAlertDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) name: string

  @IsOptional()
  @Transform(cleanList)
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  keywords?: string[]

  @IsOptional()
  @Transform(cleanList)
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  locations?: string[]

  @IsOptional()
  @Transform(cleanList)
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(EmploymentType, { each: true })
  jobTypes?: EmploymentType[]

  @IsOptional() @IsBoolean() remoteOnly?: boolean

  @IsEnum(AlertFrequency) frequency: AlertFrequency
}

export class UpdateAlertDto extends PartialType(CreateAlertDto) {
  @IsOptional() @IsBoolean() active?: boolean
}
