import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator"
import { Roles } from "../auth/decorators/roles.decorator"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { RolesGuard } from "../auth/guards/roles.guard"
import { SeekerAiService } from "./seeker-ai.service"
import { SkillAssessmentsService } from "./skill-assessments.service"

const uuid = new ParseUUIDPipe({ version: undefined })

export class TailorDto {
  @IsUUID(undefined, { message: "Choose a job" })
  jobId: string

  @IsOptional()
  @IsBoolean()
  rerun?: boolean
}

export class StartMockDto {
  @IsUUID(undefined, { message: "Choose a job" })
  jobId: string
}

export class MockAnswerDto {
  @IsInt()
  @Min(0)
  @Max(9)
  index: number

  @IsString()
  @MinLength(20, { message: "Write at least a few sentences (20+ characters)" })
  @MaxLength(4000, { message: "Keep your answer under 4000 characters" })
  answer: string
}

export class StartSkillTestDto {
  @IsString()
  @MaxLength(60)
  skill: string
}

export class ReportSkillQuestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: "Keep the reason under 300 characters" })
  reason?: string
}

export class SubmitSkillTestDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  answers: number[]
}

@ApiTags("Seeker AI tools")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("seeker-ai")
export class SeekerAiController {
  constructor(
    private readonly seekerAi: SeekerAiService,
    private readonly skills: SkillAssessmentsService
  ) {}

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

  @Get("mock-interviews")
  @Roles("SEEKER")
  listMocks(@Req() req: any) {
    return this.seekerAi.listMocks(req.user.userId)
  }

  @Get("mock-interviews/:id")
  @Roles("SEEKER")
  getMock(@Req() req: any, @Param("id", uuid) id: string) {
    return this.seekerAi.getMock(req.user.userId, id)
  }

  /** Starts a practice interview (charges mockInterviewCost; refunded if question generation fails). */
  @Post("mock-interviews")
  @Roles("SEEKER")
  startMock(@Req() req: any, @Body() dto: StartMockDto) {
    return this.seekerAi.startMock(req.user.userId, dto.jobId)
  }

  @Post("mock-interviews/:id/answers")
  @Roles("SEEKER")
  answerMock(@Req() req: any, @Param("id", uuid) id: string, @Body() dto: MockAnswerDto) {
    return this.seekerAi.answerMock(req.user.userId, id, dto.index, dto.answer)
  }

  /** Free: yearly percentiles from real postings in one currency (null figures below 10 samples). */
  @Get("salary-benchmark")
  @Roles("SEEKER")
  salaryBenchmark(
    @Query("title") title = "",
    @Query("currency") currency = "USD",
    @Query("location") location?: string
  ) {
    return this.seekerAi.salaryBenchmark(
      title.slice(0, 120),
      currency.toUpperCase().slice(0, 3),
      location?.slice(0, 120)
    )
  }

  /** Paid: AI negotiation advice for an open offer (negotiationAdviceCost; refunded on AI failure). */
  @Post("offers/:offerId/negotiation")
  @Roles("SEEKER")
  negotiation(@Req() req: any, @Param("offerId", uuid) offerId: string) {
    return this.seekerAi.negotiationAdvice(req.user.userId, offerId)
  }

  // ─── Verified skill badges ───
  @Get("skills")
  @Roles("SEEKER")
  skillOverview(@Req() req: any) {
    return this.skills.overview(req.user.userId)
  }

  @Post("skills/tests")
  @Roles("SEEKER")
  startSkillTest(@Req() req: any, @Body() dto: StartSkillTestDto) {
    return this.skills.start(req.user.userId, dto.skill)
  }

  @Post("skills/tests/:id/submit")
  @Roles("SEEKER")
  submitSkillTest(@Req() req: any, @Param("id", uuid) id: string, @Body() dto: SubmitSkillTestDto) {
    return this.skills.submit(req.user.userId, id, dto.answers)
  }

  /** "Report this question" (wrong, unclear or off-topic). Three reports remove it from the bank. */
  @Post("skills/questions/:id/report")
  @Roles("SEEKER")
  reportSkillQuestion(
    @Req() req: any,
    @Param("id", uuid) id: string,
    @Body() dto: ReportSkillQuestionDto
  ) {
    return this.skills.reportQuestion(req.user.userId, id, dto.reason)
  }
}
