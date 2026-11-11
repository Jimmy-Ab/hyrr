import { IsBooleanString, IsOptional, IsString, MaxLength } from "class-validator"
import { JobFiltersDto } from "../../jobs/dtos/job-filters.dto"

/** GET /external-jobs: search text, page cursor and the shared Discover filters. */
export class ExternalJobsQueryDto extends JobFiltersDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: "Search at most 200 characters" })
  q?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string

  /** "true": re-rank stored jobs now (no provider sync, no embeddings). */
  @IsOptional()
  @IsBooleanString({ message: "Refresh must be true or false" })
  refresh?: "true" | "false"
}
