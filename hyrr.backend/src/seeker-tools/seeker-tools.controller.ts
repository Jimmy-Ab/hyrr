import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { Roles } from "../auth/decorators/roles.decorator"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { RolesGuard } from "../auth/guards/roles.guard"
import { AlertsService } from "./alerts.service"
import { CreateAlertDto, UpdateAlertDto } from "./dtos/alert.dto"
import { CreateSavedSearchDto, UpdateSavedSearchDto } from "./dtos/saved-search.dto"
import { SavedSearchesService } from "./saved-searches.service"

@ApiTags("Job alerts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("alerts")
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  @Roles("SEEKER")
  @ApiOperation({ summary: "List the seeker's job alerts" })
  list(@Req() req: any) {
    return this.alerts.list(req.user.userId)
  }

  @Post()
  @Roles("SEEKER")
  @ApiOperation({ summary: "Create a job alert (max 10 → 409 ALERT_LIMIT)" })
  create(@Req() req: any, @Body() body: CreateAlertDto) {
    return this.alerts.create(req.user.userId, body)
  }

  @Patch(":id")
  @Roles("SEEKER")
  @ApiOperation({ summary: "Update a job alert (any field, incl. active)" })
  update(@Req() req: any, @Param("id") id: string, @Body() body: UpdateAlertDto) {
    return this.alerts.update(req.user.userId, id, body)
  }

  @Delete(":id")
  @Roles("SEEKER")
  @ApiOperation({ summary: "Delete a job alert" })
  remove(@Req() req: any, @Param("id") id: string) {
    return this.alerts.remove(req.user.userId, id)
  }
}

@ApiTags("Saved searches")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("saved-searches")
export class SavedSearchesController {
  constructor(private readonly searches: SavedSearchesService) {}

  @Get()
  @Roles("SEEKER")
  @ApiOperation({ summary: "List saved searches" })
  list(@Req() req: any) {
    return this.searches.list(req.user.userId)
  }

  @Post()
  @Roles("SEEKER")
  @ApiOperation({ summary: "Save a search (max 20 → 409 SAVED_SEARCH_LIMIT)" })
  create(@Req() req: any, @Body() body: CreateSavedSearchDto) {
    return this.searches.create(req.user.userId, body)
  }

  @Patch(":id")
  @Roles("SEEKER")
  @ApiOperation({ summary: "Rename / change a saved search" })
  update(@Req() req: any, @Param("id") id: string, @Body() body: UpdateSavedSearchDto) {
    return this.searches.update(req.user.userId, id, body)
  }

  @Delete(":id")
  @Roles("SEEKER")
  @ApiOperation({ summary: "Delete a saved search" })
  remove(@Req() req: any, @Param("id") id: string) {
    return this.searches.remove(req.user.userId, id)
  }
}
