import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Type } from "class-transformer"
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator"

export const MAX_CHAT_MESSAGE_LENGTH = 4000
export const MAX_CHAT_HISTORY = 20

export class ChatTurnDto {
  @IsIn(["user", "assistant"])
  role: "user" | "assistant"

  @IsString()
  @MaxLength(MAX_CHAT_MESSAGE_LENGTH)
  content: string
}

export class ChatDto {
  @ApiProperty({ maxLength: MAX_CHAT_MESSAGE_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CHAT_MESSAGE_LENGTH)
  message: string

  @ApiPropertyOptional({ type: [ChatTurnDto], maxItems: MAX_CHAT_HISTORY })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CHAT_HISTORY)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  history?: ChatTurnDto[]
}

export class UpdateAiSettingsDto {
  /** Must be one of the configured models (validated against the allowlist in AiService). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  activeModel?: string

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  temperature?: number

  @ApiPropertyOptional({ maxLength: 8000 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  systemPrompt?: string
}
