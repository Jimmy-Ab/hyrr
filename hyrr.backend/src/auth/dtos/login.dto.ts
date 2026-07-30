import { ApiProperty } from "@nestjs/swagger"
import { IsEmail, IsNotEmpty, IsString } from "class-validator"

export class LoginDto {
  @ApiProperty({ example: "emily@example.com", description: "User email address" })
  @IsEmail()
  email: string

  @ApiProperty({ example: "SuperSecure123!", description: "User password" })
  @IsString()
  @IsNotEmpty()
  password: string
}
