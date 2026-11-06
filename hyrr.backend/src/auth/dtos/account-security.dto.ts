import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator"

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value)

export class CaptchaFieldDto {
  @ApiPropertyOptional({ description: "Cloudflare Turnstile token (required when captcha is on)" })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  captchaToken?: string
}

export class TokenDto {
  @ApiProperty({ description: "One-time token from the e-mail link" })
  @Transform(trim)
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  token: string
}

export class ForgotPasswordDto extends CaptchaFieldDto {
  @ApiProperty({ example: "emily@example.com" })
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string
}

export class ResetPasswordDto extends TokenDto {
  @ApiProperty({ description: "New password (min 8 chars)" })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string
}

/** TOTP (6 digits) or a recovery code (`xxxxx-xxxxx`). */
export class TwoFactorCodeDto {
  @ApiProperty({ example: "123456" })
  @Transform(trim)
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9 -]+$/, { message: "code must be a 6-digit code or a recovery code" })
  code: string
}

export class TwoFactorDisableDto extends TwoFactorCodeDto {
  @ApiPropertyOptional({ description: "Current password (required for password accounts)" })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string
}

export class TwoFactorLoginDto extends TwoFactorCodeDto {
  @ApiProperty({ description: "mfaToken returned by POST /auth/login" })
  @IsString()
  @MaxLength(2048)
  mfaToken: string
}
