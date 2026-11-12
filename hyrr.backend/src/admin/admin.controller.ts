import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import type { Response } from "express"
import { AiService } from "../ai/ai.service"
import { UpdateAiSettingsDto } from "../ai/dtos/ai.dto"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { ExternalJobsService } from "../external-jobs/external-jobs.service"
import { AdminCompaniesService } from "./admin-companies.service"
import { AdminCtx, AdminModerationService } from "./admin-moderation.service"
import { AdminMoneyService } from "./admin-money.service"
import { AdminStatsService } from "./admin-stats.service"
import { AdminSystemService } from "./admin-system.service"
import { AdminUsersService } from "./admin-users.service"
import { AdminGuard } from "./admin.guard"
import { AuditService } from "./audit.service"
import {
  AnalyticsQueryDto,
  AuditCsvQueryDto,
  AuditQueryDto,
  CompaniesQueryDto,
  CreditAdjustmentDto,
  DashboardQueryDto,
  ModerationQueryDto,
  NoteDto,
  PackageUpdateDto,
  PaymentsQueryDto,
  PlanUpdateDto,
  PricingDto,
  ReasonDto,
  TransferOwnerDto,
  UsersQueryDto,
} from "./dtos/admin.dto"

const ctxOf = (req: any): AdminCtx => ({ actorId: req.user.userId, ip: req.ip ?? null })
const date = (value?: string) => (value ? new Date(value) : undefined)
const uuid = new ParseUUIDPipe({ version: undefined })

/** Admin console API. Every route: JWT + ADMIN role + two-factor enabled (AdminGuard). */
@ApiTags("Admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(
    private readonly stats: AdminStatsService,
    private readonly moderation: AdminModerationService,
    private readonly users: AdminUsersService,
    private readonly companies: AdminCompaniesService,
    private readonly money: AdminMoneyService,
    private readonly system: AdminSystemService,
    private readonly audit: AuditService,
    private readonly ai: AiService,
    private readonly externalJobs: ExternalJobsService
  ) {}

  // ─── Dashboard & analytics ───────────────────────────────────────
  @Get("dashboard")
  @ApiOperation({ summary: "Period metrics, live totals, attention items and health" })
  dashboard(@Query() q: DashboardQueryDto) {
    return this.stats.dashboard(q.period ?? "today")
  }

  @Get("analytics")
  @ApiOperation({ summary: "Series, marketplace health, breakdowns, money and cohorts" })
  analytics(@Query() q: AnalyticsQueryDto) {
    return this.stats.analytics(new Date(q.from), new Date(q.to), q.interval)
  }

  @Get("ai-usage")
  @ApiOperation({ summary: "AI calls, failures, latency, estimated cost and recruiter feedback" })
  aiUsage(@Query("days") days?: string) {
    const n = Number(days)
    return this.stats.aiUsage(Number.isFinite(n) && n >= 1 && n <= 90 ? Math.round(n) : 30)
  }

  @Get("liquidity")
  @ApiOperation({
    summary: "Supply (active applicants) vs demand (open jobs) per category or location",
  })
  liquidity(@Query("by") by?: string) {
    return this.stats.liquidity(by === "location" ? "location" : "category")
  }

  // ─── Moderation ──────────────────────────────────────────────────
  @Get("moderation")
  moderationList(@Query() q: ModerationQueryDto) {
    return this.moderation.list(q.status ?? "open", q.cursor, q.limit)
  }

  @Get("moderation/:jobId")
  moderationDetail(@Param("jobId", uuid) jobId: string) {
    return this.moderation.detail(jobId)
  }

  @Post("moderation/:jobId/restore")
  @HttpCode(HttpStatus.OK)
  restore(@Param("jobId", uuid) jobId: string, @Body() dto: NoteDto, @Req() req: any) {
    return this.moderation.restore(jobId, dto.note, ctxOf(req))
  }

  @Post("moderation/:jobId/remove")
  @HttpCode(HttpStatus.OK)
  remove(@Param("jobId", uuid) jobId: string, @Body() dto: ReasonDto, @Req() req: any) {
    return this.moderation.remove(jobId, dto.reason, ctxOf(req))
  }

  @Post("moderation/:jobId/dismiss")
  @HttpCode(HttpStatus.OK)
  dismiss(@Param("jobId", uuid) jobId: string, @Body() dto: NoteDto, @Req() req: any) {
    return this.moderation.dismiss(jobId, dto.note, ctxOf(req))
  }

  // ─── Users ───────────────────────────────────────────────────────
  @Get("users")
  usersList(@Query() q: UsersQueryDto) {
    return this.users.list(
      { q: q.q || undefined, role: q.role, status: q.status },
      q.cursor,
      q.limit
    )
  }

  @Get("users/:id")
  userDetail(@Param("id", uuid) id: string) {
    return this.users.detail(id)
  }

  @Post("users/:id/suspend")
  @HttpCode(HttpStatus.OK)
  suspendUser(@Param("id", uuid) id: string, @Body() dto: ReasonDto, @Req() req: any) {
    return this.users.suspend(id, dto.reason, ctxOf(req))
  }

  @Post("users/:id/reactivate")
  @HttpCode(HttpStatus.OK)
  reactivateUser(@Param("id", uuid) id: string, @Req() req: any) {
    return this.users.reactivate(id, ctxOf(req))
  }

  @Post("users/:id/verify-email")
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Param("id", uuid) id: string, @Req() req: any) {
    return this.users.verifyEmail(id, ctxOf(req))
  }

  @Post("users/:id/reset-password")
  @HttpCode(HttpStatus.OK)
  resetPassword(@Param("id", uuid) id: string, @Req() req: any) {
    return this.users.resetPassword(id, ctxOf(req))
  }

  // ─── Companies ───────────────────────────────────────────────────
  @Get("companies")
  companiesList(@Query() q: CompaniesQueryDto) {
    return this.companies.list(
      { q: q.q || undefined, status: q.status, ghosting: q.ghosting === "true" },
      q.cursor,
      q.limit
    )
  }

  @Get("companies/:id")
  companyDetail(@Param("id", uuid) id: string) {
    return this.companies.detail(id)
  }

  @Post("companies/:id/verify")
  @HttpCode(HttpStatus.OK)
  verifyCompany(@Param("id", uuid) id: string, @Req() req: any) {
    return this.companies.verify(id, ctxOf(req))
  }

  @Post("companies/:id/unverify")
  @HttpCode(HttpStatus.OK)
  unverifyCompany(@Param("id", uuid) id: string, @Body() dto: ReasonDto, @Req() req: any) {
    return this.companies.unverify(id, dto.reason, ctxOf(req))
  }

  @Post("companies/:id/suspend")
  @HttpCode(HttpStatus.OK)
  suspendCompany(@Param("id", uuid) id: string, @Body() dto: ReasonDto, @Req() req: any) {
    return this.companies.suspend(id, dto.reason, ctxOf(req))
  }

  @Post("companies/:id/reactivate")
  @HttpCode(HttpStatus.OK)
  reactivateCompany(@Param("id", uuid) id: string, @Req() req: any) {
    return this.companies.reactivate(id, ctxOf(req))
  }

  @Post("companies/:id/credits")
  @HttpCode(HttpStatus.OK)
  adjustCredits(@Param("id", uuid) id: string, @Body() dto: CreditAdjustmentDto, @Req() req: any) {
    return this.companies.adjustCredits(id, dto.amount, dto.reason, ctxOf(req))
  }

  @Post("companies/:id/owner")
  @HttpCode(HttpStatus.OK)
  transferOwner(@Param("id", uuid) id: string, @Body() dto: TransferOwnerDto, @Req() req: any) {
    return this.companies.transferOwnership(id, dto.userId, dto.reason, ctxOf(req))
  }

  // ─── Money ───────────────────────────────────────────────────────
  @Get("payments")
  payments(@Query() q: PaymentsQueryDto) {
    return this.money.payments(
      { provider: q.provider, status: q.status, from: date(q.from), to: date(q.to) },
      q.cursor,
      q.limit
    )
  }

  @Get("pricing")
  pricing() {
    return this.money.getPricing()
  }

  @Put("pricing")
  updatePricing(@Body() dto: PricingDto, @Req() req: any) {
    return this.money.updatePricing(dto, ctxOf(req))
  }

  @Get("packages")
  packages() {
    return this.money.packages()
  }

  @Put("packages/:id")
  updatePackage(@Param("id", uuid) id: string, @Body() dto: PackageUpdateDto, @Req() req: any) {
    return this.money.updatePackage(id, dto, ctxOf(req))
  }

  @Get("plans")
  plans() {
    return this.money.plans()
  }

  @Put("plans/:code")
  updatePlan(@Param("code") code: string, @Body() dto: PlanUpdateDto, @Req() req: any) {
    return this.money.updatePlan(code.toUpperCase().slice(0, 40), dto, ctxOf(req))
  }

  // ─── AI & system ─────────────────────────────────────────────────
  @Get("ai")
  @ApiOperation({ summary: "AI settings: stored values plus what is used at runtime" })
  aiSettings() {
    return this.ai.getSettingsView()
  }

  @Put("ai")
  @ApiOperation({ summary: "Update AI model, temperature or system prompt (audited)" })
  async updateAiSettings(@Body() dto: UpdateAiSettingsDto, @Req() req: any) {
    const before = await this.ai.getSettings()
    await this.ai.updateSettings(dto)
    await this.audit.record({
      actorId: req.user.userId,
      action: "ai.update",
      target: "ai",
      details: `Updated AI settings (${Object.keys(dto).join(", ") || "no fields"})`,
      meta: {
        before: { activeModel: before.activeModel, temperature: before.temperature },
        after: {
          activeModel: dto.activeModel,
          temperature: dto.temperature,
          systemPromptChanged: dto.systemPrompt !== undefined,
        },
      },
      ip: req.ip,
      severity: "warning",
    })
    return this.ai.getSettingsView()
  }

  @Get("external-jobs")
  @ApiOperation({ summary: "Jobs from the web: providers configured, active count, last sync" })
  externalJobsStatus() {
    return this.externalJobs.status()
  }

  @Post("external-jobs/sync")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Fetch jobs from the configured licensed APIs now (audited)" })
  async syncExternalJobs(@Req() req: any) {
    const report = await this.externalJobs.sync()
    const ctx = ctxOf(req)
    await this.audit.record({
      actorId: ctx.actorId,
      action: "external_jobs.sync",
      target: "external-jobs",
      details: "Synced jobs from the web",
      meta: { report },
      ip: ctx.ip,
      severity: "info",
    })
    return report
  }

  @Get("system")
  @ApiOperation({ summary: "Configured integrations (presence only, never values)" })
  systemStatus() {
    return this.system.system()
  }

  // ─── Audit ───────────────────────────────────────────────────────
  @Get("audit")
  auditList(@Query() q: AuditQueryDto) {
    return this.audit.list(
      { actorId: q.actorId, action: q.action, from: date(q.from), to: date(q.to) },
      q.cursor,
      q.limit
    )
  }

  @Get("audit.csv")
  async auditCsv(@Query() q: AuditCsvQueryDto, @Res({ passthrough: true }) res: Response) {
    const csv = await this.audit.csv({
      actorId: q.actorId,
      action: q.action,
      from: date(q.from),
      to: date(q.to),
    })
    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="hyrr-audit-${new Date().toISOString().slice(0, 10)}.csv"`
    )
    return csv
  }
}
