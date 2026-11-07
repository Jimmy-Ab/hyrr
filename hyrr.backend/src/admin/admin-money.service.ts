import { Injectable, Optional } from "@nestjs/common"
import { PaymentProvider, PaymentStatus, Prisma } from "@prisma/client"
import { AiService } from "../ai/ai.service"
import { MomentumConfig, PricingService } from "../billing/pricing.service"
import { NotFoundAppException } from "../core/exceptions/app-exception"
import { PrismaService } from "../prisma/prisma.service"
import type { AdminCtx } from "./admin-moderation.service"
import { AuditService } from "./audit.service"
import { PackageUpdateDto, PlanUpdateDto, PricingDto } from "./dtos/admin.dto"
import { pageArgs, pageOf } from "./pagination"

const SETTINGS_ID = "global-settings"

export type PricingSource = "defaults" | "env" | "settings"

/** Env overrides PricingService reads (multipliers and the salary threshold have none). */
const ENV_KEYS: Partial<Record<keyof MomentumConfig, string>> = {
  publishBase: "MOMENTUM_PUBLISH_BASE",
  featureCost: "MOMENTUM_FEATURE_COST",
  featureDays: "MOMENTUM_FEATURE_DAYS",
  aiRerunCost: "MOMENTUM_AI_RERUN_COST",
  signupBonus: "MOMENTUM_SIGNUP_BONUS",
  applyCost: "MOMENTUM_APPLY_COST",
  seekerSignupBonus: "MOMENTUM_SEEKER_SIGNUP_BONUS",
}

export type PaymentFilters = {
  provider?: PaymentProvider
  status?: PaymentStatus
  from?: Date
  to?: Date
}

/** Payments, Momentum pricing, credit packages and plans. */
@Injectable()
export class AdminMoneyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly audit: AuditService,
    @Optional() private readonly ai?: AiService
  ) {}

  // ─── Payments ────────────────────────────────────────────────────
  async payments(filters: PaymentFilters, cursor?: string, limit?: number) {
    const where: Prisma.PaymentWhereInput = {}
    if (filters.provider) where.provider = filters.provider
    if (filters.status) where.status = filters.status
    if (filters.from || filters.to)
      where.createdAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lt: filters.to } : {}),
      }
    const rows = await this.prisma.payment.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageArgs(cursor, limit),
    })
    const page = pageOf(rows, limit)
    return {
      items: page.items.map((p) => ({
        id: p.id,
        provider: p.provider,
        providerRef: p.providerRef,
        kind: p.kind,
        status: p.status,
        amount: p.amount,
        currency: p.currency,
        credits: p.credits,
        description: p.description,
        createdAt: p.createdAt,
        paidAt: p.paidAt,
        owner: p.company
          ? { type: "company" as const, id: p.company.id, name: p.company.name }
          : p.user
            ? { type: "seeker" as const, id: p.user.id, name: p.user.name }
            : null,
      })),
      nextCursor: page.nextCursor,
    }
  }

  // ─── Pricing ─────────────────────────────────────────────────────
  private async storedConfig(): Promise<Record<string, any>> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { id: SETTINGS_ID },
      select: { momentumConfig: true },
    })
    const stored = setting?.momentumConfig
    return stored && typeof stored === "object" && !Array.isArray(stored)
      ? { ...(stored as Record<string, any>) }
      : {}
  }

  /** The effective config plus where each field comes from. */
  async getPricing() {
    this.pricing.invalidate()
    const [config, stored] = await Promise.all([this.pricing.getConfig(), this.storedConfig()])
    const source = {} as Record<keyof MomentumConfig, PricingSource>
    for (const key of Object.keys(config) as (keyof MomentumConfig)[]) {
      const envKey = ENV_KEYS[key]
      const fromSettings =
        key === "multipliers"
          ? stored.multipliers && Object.keys(stored.multipliers).length > 0
          : stored[key] !== undefined && stored[key] !== null
      source[key] = fromSettings
        ? "settings"
        : envKey && process.env[envKey]?.trim()
          ? "env"
          : "defaults"
    }
    return { ...config, source }
  }

  /** Merges the given fields into SystemSetting.momentumConfig and applies them immediately. */
  async updatePricing(dto: PricingDto, ctx: AdminCtx) {
    const before = await this.pricing.getConfig()
    const stored = await this.storedConfig()
    const { multipliers, ...rest } = dto
    const next: Record<string, any> = { ...stored }
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) next[k] = v
    if (multipliers) {
      const m = { ...(stored.multipliers ?? {}) }
      for (const [k, v] of Object.entries(multipliers)) if (v !== undefined) m[k] = v
      next.multipliers = m
    }
    // Creates the settings row (with the AI defaults) when it doesn't exist yet.
    await this.ai?.getSettings()
    await this.prisma.$transaction(async (tx) => {
      await tx.systemSetting.update({
        where: { id: SETTINGS_ID },
        data: { momentumConfig: next as Prisma.InputJsonValue },
      })
      await this.audit.record(
        {
          actorId: ctx.actorId,
          action: "pricing.update",
          target: "pricing",
          details: `Updated Momentum pricing (${Object.keys(dto).join(", ") || "no fields"})`,
          meta: { before, changes: dto },
          ip: ctx.ip,
          severity: "warning",
        },
        tx
      )
    })
    this.pricing.invalidate()
    return this.getPricing()
  }

  // ─── Packages & plans ────────────────────────────────────────────
  packages() {
    return this.prisma.creditPackage.findMany({
      orderBy: [{ audience: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
    })
  }

  async updatePackage(id: string, dto: PackageUpdateDto, ctx: AdminCtx) {
    const before = await this.prisma.creditPackage.findUnique({ where: { id } })
    if (!before) throw new NotFoundAppException("Package not found", "PACKAGE_NOT_FOUND")
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.creditPackage.update({ where: { id }, data: { ...dto } })
      await this.audit.record(
        {
          actorId: ctx.actorId,
          action: "package.update",
          target: `package:${id}`,
          details: `Updated credit package ${before.name} (${before.code})`,
          meta: { before: pick(before, Object.keys(dto)), after: dto },
          ip: ctx.ip,
          severity: "warning",
        },
        tx
      )
      return updated
    })
  }

  plans() {
    return this.prisma.plan.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] })
  }

  async updatePlan(code: string, dto: PlanUpdateDto, ctx: AdminCtx) {
    const before = await this.prisma.plan.findUnique({ where: { code } })
    if (!before) throw new NotFoundAppException("Plan not found", "PLAN_NOT_FOUND")
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.plan.update({ where: { code }, data: { ...dto } })
      await this.audit.record(
        {
          actorId: ctx.actorId,
          action: "plan.update",
          target: `plan:${code}`,
          details: `Updated plan ${before.name} (${code})`,
          meta: { before: pick(before, Object.keys(dto)), after: dto },
          ip: ctx.ip,
          severity: "warning",
        },
        tx
      )
      return updated
    })
  }
}

function pick(row: Record<string, any>, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, row[k]]))
}
