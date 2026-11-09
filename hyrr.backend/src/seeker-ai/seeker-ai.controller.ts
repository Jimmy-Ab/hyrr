import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { IsBoolean, IsOptional, IsUUID } from "class-validator"
import { Roles } from "../auth/decorators/roles.decorator"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { RolesGuard } from "../auth/guards/roles.guard"
import { SeekerAiService } from "./seeker-ai.service"

const uuid = new ParseUUIDPipe({ version: undefined })

export class TailorDto {
  @IsUUID(undefined, { message: "Choose a job" })
  jobId: string

  @IsOptional()
  @IsBoolean()
  rerun?: boolean
}

@ApiTags("Seeker AI tools")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("seeker-ai")
export class SeekerAiController {
  constructor(private readonly seekerAi: SeekerAiService) {}

  /** Saved CV tailoring for a job (free to reopen). */
  @Get("tailor/:jobId")
  @Roles("SEEKER")
  async getTailoring(@Req() req: any, @Param("jobId", uuid) jobId: string) {
    const saved = await this.seekerAi.getTailoring(req.user.userId, jobId)
    if (!saved) throw new NotFoundException("No tailoring for this job yet")
    return saved
  }

  /** Runs CV tailoring (charges resumeTailorCost; refunded if the AI fails). */
  @Post("tailor")
  @Roles("SEEKER")
  tailor(@Req() req: any, @Body() dto: TailorDto) {
    return this.seekerAi.tailor(req.user.userId, dto.jobId, !!dto.rerun)
  }
}
