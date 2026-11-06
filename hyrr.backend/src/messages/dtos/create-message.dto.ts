import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from "class-validator"

export const MESSAGE_MAX_LENGTH = 5000
export const CLIENT_ID_MAX_LENGTH = 64
export const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/

export class CreateMessageDto {
  @ApiProperty({ maxLength: MESSAGE_MAX_LENGTH })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: "Message text is required" })
  @MaxLength(MESSAGE_MAX_LENGTH, { message: "Message is too long (max 5000 characters)" })
  text: string

  @ApiPropertyOptional({
    maxLength: CLIENT_ID_MAX_LENGTH,
    description: "Client-generated id; retries with the same id return the stored message",
  })
  @IsOptional()
  @IsString()
  @MaxLength(CLIENT_ID_MAX_LENGTH)
  @Matches(CLIENT_ID_PATTERN, { message: "clientId may only contain letters, digits, _ and -" })
  clientId?: string
}
