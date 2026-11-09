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
}
