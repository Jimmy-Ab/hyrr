import { Controller, Get, Req, UseGuards } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { Roles } from "../auth/decorators/roles.decorator"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { RolesGuard } from "../auth/guards/roles.guard"
import { DashboardService } from "./dashboard.service"

@ApiTags("Dashboard")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("seeker")
  @Roles("SEEKER")
  @ApiOperation({ summary: "Get the authenticated seeker's dashboard metrics and timeline" })
  getSeekerDashboard(@Req() req: any) {
    return this.dashboard.getSeekerDashboard(req.user.userId)
  }
}
