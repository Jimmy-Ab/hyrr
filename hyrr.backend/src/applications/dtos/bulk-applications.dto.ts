import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator"
import { RECRUITER_STATUSES, RecruiterStatus } from "./create-candidate.dto"

export const BULK_ACTIONS = ["MOVE", "ADD_LABEL", "REMOVE_LABEL", "ARCHIVE", "MESSAGE"] as const
export type BulkAction = (typeof BULK_ACTIONS)[number]

export class BulkApplicationsDto {
  @ApiProperty({ type: [String], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  applicationIds: string[]

  @ApiProperty({ enum: BULK_ACTIONS })
  @IsIn(BULK_ACTIONS)
  action: BulkAction

  @ApiPropertyOptional({ enum: RECRUITER_STATUSES, description: "MOVE only" })
  @IsOptional()
  @IsIn(RECRUITER_STATUSES)
  status?: RecruiterStatus

  @ApiPropertyOptional({ description: "ADD_LABEL / REMOVE_LABEL only" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  labelId?: string

  @ApiPropertyOptional({ description: "MESSAGE only" })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message?: string
}
