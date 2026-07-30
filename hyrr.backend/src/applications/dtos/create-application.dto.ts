import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator"

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
}
