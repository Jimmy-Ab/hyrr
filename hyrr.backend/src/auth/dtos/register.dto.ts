import { ApiProperty } from "@nestjs/swagger"
import { IsEmail, IsIn, IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator"

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
}
