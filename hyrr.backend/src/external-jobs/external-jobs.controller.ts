import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { Roles } from "../auth/decorators/roles.decorator"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { RolesGuard } from "../auth/guards/roles.guard"
import { toJobFilters } from "../jobs/dtos/job-filters.dto"
import { ExternalJobsQueryDto } from "./dtos/external-jobs-query.dto"
import { ExternalJobsService } from "./external-jobs.service"

const uuid = new ParseUUIDPipe({ version: undefined })

@ApiTags("Jobs from the web")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("external-jobs")
export class ExternalJobsController {
  constructor(private readonly external: ExternalJobsService) {}

  @Get()
  @Roles("SEEKER")
  list(@Req() req: any, @Query() query: ExternalJobsQueryDto) {
    return this.external.list(
      req.user.userId,
      query.q,
      query.remote === "true",
      query.cursor || undefined,
      toJobFilters(query),
      { refresh: query.refresh === "true" }
    )
  }

  /** Charges the external apply cost once and returns the original posting URL to open. */
  @Post(":id/apply")
  @Roles("SEEKER")
  @HttpCode(HttpStatus.OK)
  apply(@Req() req: any, @Param("id", uuid) id: string) {
    return this.external.apply(req.user.userId, id)
  }
}
