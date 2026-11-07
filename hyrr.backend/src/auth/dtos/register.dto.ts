import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator"
import { sanitizeUrl } from "../../profile/dtos/profile.dto"

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value)
/** Recruiters create a company unless they join one (invite link or join request). */
const createsCompany = (o: RegisterDto) =>
  o.role === "RECRUITER" && !o.inviteToken && !o.joinCompanyId

export const SIGNUP_ROLES = ["SEEKER", "RECRUITER"] as const

export class RegisterDto {
  @ApiProperty({ example: "Emily Carter", description: "Full name of the user" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string

  @ApiProperty({ example: "emily@example.com", description: "User email address" })
  @IsEmail()
  @MaxLength(254)
  email: string

  @ApiProperty({ example: "SuperSecure123!", description: "Password (min 8 chars)" })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string

  @ApiProperty({ example: "SEEKER", enum: SIGNUP_ROLES, description: "Account role" })
  @IsIn(SIGNUP_ROLES as unknown as string[])
  role: "SEEKER" | "RECRUITER"

  @ApiPropertyOptional({ description: "Cloudflare Turnstile token (required when captcha is on)" })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  captchaToken?: string

  @ApiPropertyOptional({ example: "Acme Inc.", description: "Recruiters: the company to create" })
  @ValidateIf(createsCompany)
  @Transform(trim)
  @IsString({ message: "Company name must be text" })
  @IsNotEmpty({ message: "Enter your company name" })
  @MaxLength(120, { message: "Company name can be at most 120 characters" })
  companyName?: string

  @ApiPropertyOptional({ example: "https://acme.com" })
  @IsOptional()
  @Transform(sanitizeUrl)
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== "")
  @IsUrl(
    { require_tld: true, protocols: ["http", "https"], require_protocol: true },
    { message: "Enter a valid website, e.g. https://acme.com" }
  )
  @MaxLength(500)
  companyWebsite?: string | null

  @ApiPropertyOptional({ description: "Recruiters: team invite token from the e-mail link" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  inviteToken?: string

  @ApiPropertyOptional({ description: "Recruiters: ask to join this verified company instead" })
  @IsOptional()
  @IsUUID(undefined, { message: "Choose a company" })
  joinCompanyId?: string
}
