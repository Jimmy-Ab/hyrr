import { ApiPropertyOptional } from "@nestjs/swagger"
import { IsOptional, IsString, MaxLength } from "class-validator"

export class DeleteAccountDto {
  @ApiPropertyOptional({ description: "Current password (required for password accounts)" })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string
}
