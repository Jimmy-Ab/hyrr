import { Transform } from "class-transformer"
import { IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf } from "class-validator"
import { sanitizeUrl } from "./profile.dto"

const trim = ({ value }: { value: any }) => (typeof value === "string" ? value.trim() : value)
const trimToNull = ({ value }: { value: any }) => {
  if (value === null) return null
  if (typeof value !== "string") return value
  return value.trim() || null
}
const IfPresent = () => ValidateIf((_o, value) => value !== undefined && value !== null)

/** PUT /profile/company. Omitted = unchanged; null / "" clears the optional fields. */
export class UpdateCompanyProfileDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(120) name?: string

  /** A single letter or an uploaded image URL. */
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(500) logo?: string

  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(30) color?: string

  /** http(s) URL (a bare domain gets https://); "" / null clears it. */
  @Transform(sanitizeUrl)
  @IfPresent()
  @IsUrl({ require_tld: true, protocols: ["http", "https"], require_protocol: true })
  @MaxLength(500)
  website?: string | null

  @Transform(trimToNull) @IfPresent() @IsString() @MaxLength(5000) description?: string | null

  @Transform(trimToNull) @IfPresent() @IsString() @MaxLength(120) industry?: string | null

  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(120) country?: string

  @Transform(trimToNull) @IfPresent() @IsString() @MaxLength(120) city?: string | null
}
