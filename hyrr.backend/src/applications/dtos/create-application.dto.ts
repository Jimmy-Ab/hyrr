import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from "class-validator"

/** Only files uploaded through our own POST /api/uploads endpoint are accepted as resumes. */
export const UPLOAD_URL_PATTERN =
  /^https?:\/\/[^\s/]+(?:\/[^\s]*)?\/api\/uploads\/[A-Za-z0-9._%-]+(?:\?[^\s]*)?$/
export const UPLOAD_URL_MESSAGE = "resumeUrl must be a file uploaded through /api/uploads"

export class CreateApplicationDto {
  @ApiProperty({ example: "Emily Carter", description: "Applicant full name" })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: "emily@example.com", description: "Applicant email address" })
  @IsEmail()
  email: string

  @ApiPropertyOptional({ example: "+1 555 123 4567" })
  @IsOptional()
  @IsString()
  phone?: string

  @ApiProperty({ example: "Senior Frontend Engineer", description: "Current job title" })
  @IsString()
  @IsNotEmpty()
  title: string

  @ApiProperty({ example: "San Francisco, CA", description: "Applicant location" })
  @IsString()
  @IsNotEmpty()
  location: string

  @ApiPropertyOptional({ example: "I am passionate about..." })
  @IsOptional()
  @IsString()
  coverLetter?: string

  @ApiPropertyOptional({ example: "http://localhost:3000/api/uploads/3f0c...pdf" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Matches(UPLOAD_URL_PATTERN, { message: UPLOAD_URL_MESSAGE })
  resumeUrl?: string

  @ApiPropertyOptional({
    description: "Turnstile token (guest applications, when captcha is enabled)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  captchaToken?: string
}
