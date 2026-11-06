import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator"

export class LoginDto {
  @ApiProperty({ example: "emily@example.com", description: "User email address" })
  @IsEmail()
  email: string

  @ApiProperty({ example: "SuperSecure123!", description: "User password" })
  @IsString()
  @IsNotEmpty()
  password: string

  @ApiPropertyOptional({ description: "Cloudflare Turnstile token (required when captcha is on)" })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  captchaToken?: string
}
