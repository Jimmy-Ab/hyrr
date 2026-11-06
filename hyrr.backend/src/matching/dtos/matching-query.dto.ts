import { Type } from "class-transformer"
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator"

export const MATCH_TABS = ["for-you", "all"] as const
export type MatchTab = (typeof MATCH_TABS)[number]

export class MatchingQueryDto {
  @IsOptional() @IsIn(MATCH_TABS) tab?: MatchTab

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number
}
