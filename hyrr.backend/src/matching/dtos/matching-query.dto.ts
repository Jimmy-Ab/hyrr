import { Type } from "class-transformer"
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator"
import { JobFiltersDto } from "../../jobs/dtos/job-filters.dto"

export const MATCH_TABS = ["for-you", "all"] as const
export type MatchTab = (typeof MATCH_TABS)[number]

export class MatchingQueryDto extends JobFiltersDto {
  @IsOptional() @IsIn(MATCH_TABS) tab?: MatchTab

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number

  /** Opaque `nextCursor` from the previous page. */
  @IsOptional() @IsString() @MaxLength(400) cursor?: string

  /** "true": drop this seeker's cached rankings and re-score stored jobs (no new embeddings). */
  @IsOptional()
  @IsBooleanString({ message: "Refresh must be true or false" })
  refresh?: "true" | "false"
}
