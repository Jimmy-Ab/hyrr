import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger"
import { Roles } from "../auth/decorators/roles.decorator"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { RolesGuard } from "../auth/guards/roles.guard"
import { CreateLabelDto, UpdateLabelDto } from "./dtos/labels.dto"
import { LabelsService } from "./labels.service"

@ApiTags("Labels")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("RECRUITER")
@Controller("labels")
export class LabelsController {
  constructor(private readonly labels: LabelsService) {}

  @Get()
  @ApiOperation({ summary: "Company candidate labels with usage counts" })
  list(@Req() req: any) {
    return this.labels.list(req.user)
  }

  @Post()
  @ApiOperation({ summary: "Create a company label (OWNER/RECRUITER member)" })
  @ApiResponse({ status: 409, description: "Duplicate name or LABEL_LIMIT" })
  create(@Req() req: any, @Body() dto: CreateLabelDto) {
    return this.labels.create(req.user, dto)
  }

  @Patch(":id")
  @ApiOperation({ summary: "Rename / recolour a label" })
  update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateLabelDto) {
    return this.labels.update(req.user, id, dto)
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a label (removes it from every candidate)" })
  remove(@Req() req: any, @Param("id") id: string) {
    return this.labels.remove(req.user, id)
  }
}
