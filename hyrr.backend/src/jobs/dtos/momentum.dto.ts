import { ApiPropertyOptional } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength } from "class-validator"

/** Query for GET /jobs/publish-cost (the publish dialog's price preview). */
export class PublishCostQueryDto {
  @ApiPropertyOptional({ enum: ["true", "false"] })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true" || value === "1")
  @IsBoolean()
  remote?: boolean

  @ApiPropertyOptional({ example: "$120,000 – $150,000" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  salary?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoryId?: string
}

export class FeatureJobDto {
  @ApiPropertyOptional({ enum: [7, 14, 30], description: "Defaults to the configured featureDays" })
  @IsOptional()
  @IsInt()
  @IsIn([7, 14, 30])
  days?: number
}
