import { Transform, Type } from "class-transformer"
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from "class-validator"

const sanitizeUrl = ({ value }: { value: any }) => {
  if (typeof value !== "string" || !value.trim()) return undefined
  const trimmed = value.trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return trimmed
}

export class ExperienceDto {
  @IsString() @MaxLength(120) role: string
  @IsString() @MaxLength(120) company: string
  @IsString() @MaxLength(80) duration: string
  @IsOptional() @IsString() @MaxLength(2000) desc?: string
}

export class EducationDto {
  @IsString() @MaxLength(160) school: string
  @IsString() @MaxLength(160) degree: string
  @IsString() @MaxLength(80) duration: string
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string
  @IsOptional() @IsString() @MaxLength(120) title?: string
  @IsOptional() @IsString() @MaxLength(160) location?: string

  @IsOptional()
  @Transform(sanitizeUrl)
  @IsUrl({ require_tld: false })
  website?: string

  @IsOptional()
  @Transform(sanitizeUrl)
  @IsUrl({ require_tld: false })
  github?: string

  @IsOptional()
  @Transform(sanitizeUrl)
  @IsUrl({ require_tld: false })
  linkedin?: string

  @IsOptional()
  @Transform(sanitizeUrl)
  @IsUrl({ require_tld: false })
  avatar?: string

  @IsOptional() @IsString() @MaxLength(4000) bio?: string
  @IsOptional() @IsString() @MaxLength(100) expectedSalary?: string
  @IsOptional() @IsString() @MaxLength(60) preferredType?: string
  @IsOptional() @IsString() @MaxLength(120) availability?: string
  @IsOptional() @IsIn(["public", "private"]) visibility?: string
  @IsOptional() @IsString() @MaxLength(40) phone?: string
  @IsOptional() @IsString() @MaxLength(40) yearsOfExperience?: string
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  skills?: string[]
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  languages?: string[]
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  preferredLocations?: string[]
  @IsOptional() @IsArray() @IsString({ each: true }) interests?: string[]
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperienceDto)
  experiences?: ExperienceDto[]
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  educations?: EducationDto[]
}

