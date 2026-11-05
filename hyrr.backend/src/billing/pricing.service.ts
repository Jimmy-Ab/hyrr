import { Injectable, Logger } from "@nestjs/common"
import { approxYearlyUsd } from "../core/validation/structured"
import { PrismaService } from "../prisma/prisma.service"

export type MomentumConfig = {
  publishBase: number
  multipliers: { remote: number; highSalary: number; featuredCategory: number }
  highSalaryThresholdUsd: number
  featureCost: number
  featureDays: number
  aiRerunCost: number
  signupBonus: number
  /** Seeker side: credits per application and the new-seeker welcome bonus. */
  applyCost: number
  seekerSignupBonus: number
}

export type PublishCostInput = {
  remote?: boolean | null
  /** Legacy free text; used only when no structured range is given. */
  salary?: string | null
  salaryMax?: number | null
  salaryCurrency?: string | null
  salaryPeriod?: string | null
  categoryId?: string | null
}

export type PublishCostBreakdown = {
  cost: number
  base: number
  multipliers: { name: string; factor: number }[]
}

const CACHE_MS = 60_000

const DEFAULTS: MomentumConfig = {
  publishBase: 10,
  multipliers: { remote: 0.9, highSalary: 1.5, featuredCategory: 1.2 },
  highSalaryThresholdUsd: 120_000,
  featureCost: 25,
  featureDays: 14,
  aiRerunCost: 2,
  signupBonus: 20,
  applyCost: 1,
  seekerSignupBonus: 10,
}

const num = (value: unknown, fallback: number, min = 0): number => {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value
  return typeof n === "number" && Number.isFinite(n) && n >= min ? n : fallback
}

/**
 * Largest amount mentioned in a free-text salary ("$120,000 – $150,000", "From $130k", "90K-110K",
 * "1.2m"). Returns null when no number is found.
 */
export function parseSalaryMax(salary?: string | null): number | null {
  if (!salary) return null
  const re = /(\d+(?:[.,]\d+)*)\s*([km])?(?![a-z])/gi
  let max: number | null = null
  for (const match of salary.matchAll(re)) {
    const raw = match[1]
    // "120,000" / "120.000" → thousands separators; "1.5" (k/m suffix) → decimal
    const suffix = match[2]?.toLowerCase()
    let value: number
    if (suffix) value = Number(raw.replace(/,/g, ".").replace(/\.(?=.*\.)/g, ""))
    else
      value = Number(
        /^\d{1,3}([.,]\d{3})+$/.test(raw) ? raw.replace(/[.,]/g, "") : raw.replace(/,/g, "")
      )
    if (!Number.isFinite(value)) continue
    if (suffix === "k") value *= 1_000
    if (suffix === "m") value *= 1_000_000
    if (max === null || value > max) max = value
  }
  return max
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name)
  private cached: { at: number; config: MomentumConfig } | null = null
  private categoryCache = new Map<string, { at: number; premium: boolean }>()

  constructor(private readonly prisma: PrismaService) {}

  /** Defaults ← env overrides ← SystemSetting.momentumConfig. Cached for 60 s. */
  async getConfig(): Promise<MomentumConfig> {
    if (this.cached && Date.now() - this.cached.at < CACHE_MS) return this.cached.config
    const env = process.env
    let config: MomentumConfig = {
      ...DEFAULTS,
      multipliers: { ...DEFAULTS.multipliers },
      publishBase: num(env.MOMENTUM_PUBLISH_BASE, DEFAULTS.publishBase),
      featureCost: num(env.MOMENTUM_FEATURE_COST, DEFAULTS.featureCost),
      featureDays: num(env.MOMENTUM_FEATURE_DAYS, DEFAULTS.featureDays, 1),
      aiRerunCost: num(env.MOMENTUM_AI_RERUN_COST, DEFAULTS.aiRerunCost),
      signupBonus: num(env.MOMENTUM_SIGNUP_BONUS, DEFAULTS.signupBonus),
      applyCost: num(env.MOMENTUM_APPLY_COST, DEFAULTS.applyCost),
      seekerSignupBonus: num(env.MOMENTUM_SEEKER_SIGNUP_BONUS, DEFAULTS.seekerSignupBonus),
    }
    try {
      const setting = await this.prisma.systemSetting.findFirst({
        select: { momentumConfig: true },
      })
      const o = (setting?.momentumConfig ?? null) as Record<string, any> | null
      if (o && typeof o === "object") {
        const m = (o.multipliers ?? {}) as Record<string, unknown>
        config = {
          publishBase: num(o.publishBase, config.publishBase),
          multipliers: {
            remote: num(m.remote, config.multipliers.remote),
            highSalary: num(m.highSalary, config.multipliers.highSalary),
            featuredCategory: num(m.featuredCategory, config.multipliers.featuredCategory),
          },
          highSalaryThresholdUsd: num(o.highSalaryThresholdUsd, config.highSalaryThresholdUsd),
          featureCost: num(o.featureCost, config.featureCost),
          featureDays: num(o.featureDays, config.featureDays, 1),
          aiRerunCost: num(o.aiRerunCost, config.aiRerunCost),
          signupBonus: num(o.signupBonus, config.signupBonus),
          applyCost: num(o.applyCost, config.applyCost),
          seekerSignupBonus: num(o.seekerSignupBonus, config.seekerSignupBonus),
        }
      }
    } catch (err: any) {
      this.logger.warn(`Could not read momentumConfig: ${err?.message || err}`)
    }
    this.cached = { at: Date.now(), config }
    return config
  }

  /** Drops the cached config (e.g. after an admin edits SystemSetting.momentumConfig). */
  invalidate() {
    this.cached = null
    this.categoryCache.clear()
  }

  async publishCost(job: PublishCostInput): Promise<number> {
    return (await this.publishCostBreakdown(job)).cost
  }

  async publishCostBreakdown(job: PublishCostInput): Promise<PublishCostBreakdown> {
    const config = await this.getConfig()
    const multipliers: { name: string; factor: number }[] = []
    if (job.remote) multipliers.push({ name: "remote", factor: config.multipliers.remote })
    // Structured range -> approximate yearly USD; legacy text -> its largest number (assumed USD).
    const salaryMax =
      job.salaryMax != null
        ? approxYearlyUsd(job.salaryMax, job.salaryCurrency, job.salaryPeriod)
        : parseSalaryMax(job.salary)
    if (salaryMax !== null && salaryMax >= config.highSalaryThresholdUsd)
      multipliers.push({ name: "highSalary", factor: config.multipliers.highSalary })
    if (job.categoryId && (await this.isPremiumCategory(job.categoryId)))
      multipliers.push({ name: "featuredCategory", factor: config.multipliers.featuredCategory })
    const product = multipliers.reduce((acc, m) => acc * m.factor, 1)
    const cost = Math.max(1, Math.round(config.publishBase * product))
    return { cost, base: config.publishBase, multipliers }
  }

  private premiumCategories(): string[] {
    return (process.env.MOMENTUM_PREMIUM_CATEGORIES || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  }

  private async isPremiumCategory(categoryId: string): Promise<boolean> {
    const list = this.premiumCategories()
    if (list.length === 0) return false
    const hit = this.categoryCache.get(categoryId)
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.premium
    let premium = list.includes(categoryId.toLowerCase())
    if (!premium) {
      const category = await this.prisma.jobCategory
        .findUnique({ where: { id: categoryId }, select: { name: true, slug: true } })
        .catch(() => null)
      premium =
        !!category &&
        [category.slug, category.name]
          .filter(Boolean)
          .some((v) => list.includes(String(v).toLowerCase()))
    }
    this.categoryCache.set(categoryId, { at: Date.now(), premium })
    return premium
  }
}
