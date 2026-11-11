import { HttpStatus, Injectable, Logger } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { PricingService } from "../billing/pricing.service"
import { WalletService } from "../billing/wallet.service"
import { AppException } from "../core/exceptions/app-exception"
import type { JobFilters } from "../jobs/dtos/job-filters.dto"
import { evaluateJobContent } from "../jobs/job-content-policy"
import { webJobFilterWhere } from "../jobs/job-filters"
import { PrismaService } from "../prisma/prisma.service"
import { providers, type ExternalJobInput, type Provider } from "./providers"

const DAY = 86_400_000
const PAGE = 30

/** EXTERNAL_JOBS_ENABLED=true turns on the scheduled sync (off by default: no outbound calls). */
export const externalJobsEnabled = (env = process.env) =>
  (env.EXTERNAL_JOBS_ENABLED ?? "false").trim().toLowerCase() === "true"
const ttlDays = (env = process.env) => Math.max(1, Number(env.EXTERNAL_JOBS_TTL_DAYS) || 10)
const maxPerSource = (env = process.env) =>
  Math.max(10, Number(env.EXTERNAL_JOBS_MAX_PER_SOURCE) || 200)

const dedupeKey = (j: { title: string; company: string }) =>
  `${j.title.trim().toLowerCase()}|${j.company.trim().toLowerCase()}`

export type SyncReport = Record<
  string,
  { fetched: number; saved: number; skipped: number; error?: string }
>

/**
 * "Jobs from the web": postings pulled from licensed job APIs (never scraped). Seekers see them in
 * Discover; applying charges `externalApplyCost` once and opens the original posting.
 */
@Injectable()
export class ExternalJobsService {
  private readonly logger = new Logger(ExternalJobsService.name)
  private lastSync: { at: Date; report: SyncReport } | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly pricing: PricingService
  ) {}

  /** Fetches every enabled provider, upserts by (source, sourceId), drops duplicates and scams. */
  async sync(list: Provider[] = providers()): Promise<SyncReport> {
    const report: SyncReport = {}
    const now = new Date()
    const expiresAt = new Date(now.getTime() + ttlDays() * DAY)
    // Same job listed by two APIs: keep the first source we already have.
    const existing = await this.prisma.externalJob.findMany({
      where: { active: true },
      select: { title: true, company: true, source: true, sourceId: true },
    })
    const owner = new Map(existing.map((e) => [dedupeKey(e), `${e.source}:${e.sourceId}`]))

    for (const provider of list.filter((p) => p.enabled)) {
      const stats = { fetched: 0, saved: 0, skipped: 0 } as SyncReport[string]
      report[provider.source] = stats
      let jobs: ExternalJobInput[] = []
      try {
        jobs = await provider.fetch(maxPerSource())
      } catch (err: any) {
        stats.error = err?.message ?? String(err)
        this.logger.warn(`External jobs: ${provider.source} failed: ${stats.error}`)
        continue
      }
      stats.fetched = jobs.length
      for (const job of jobs) {
        const key = dedupeKey(job)
        const id = `${job.source}:${job.sourceId}`
        const taken = owner.get(key)
        if (
          (taken && taken !== id) ||
          evaluateJobContent({ title: job.title, description: job.description }).length
        ) {
          stats.skipped++
          continue
        }
        owner.set(key, id)
        const data = { ...job, fetchedAt: now, expiresAt, active: true }
        await this.prisma.externalJob.upsert({
          where: { source_sourceId: { source: job.source, sourceId: job.sourceId } },
          create: data,
          update: data,
        })
        stats.saved++
      }
    }
    await this.prisma.externalJob.updateMany({
      where: { active: true, expiresAt: { lt: now } },
      data: { active: false },
    })
    this.lastSync = { at: now, report }
    return report
  }

  async list(
    userId: string,
    q?: string,
    remote?: boolean,
    cursor?: string,
    filters: JobFilters = {}
  ) {
    const terms = (q ?? "").trim()
    const categoryName = filters.categoryId
      ? (
          await this.prisma.jobCategory.findUnique({
            where: { id: filters.categoryId },
            select: { name: true },
          })
        )?.name
      : null
    const filterWhere = webJobFilterWhere(filters, categoryName)
    const where: Prisma.ExternalJobWhereInput = {
      active: true,
      ...(remote ? { remote: true } : {}),
      ...(filterWhere.length ? { AND: filterWhere } : {}),
      ...(terms
        ? {
            OR: [
              { title: { contains: terms, mode: "insensitive" } },
              { company: { contains: terms, mode: "insensitive" } },
              { location: { contains: terms, mode: "insensitive" } },
            ],
          }
        : {}),
    }
    const rows = await this.prisma.externalJob.findMany({
      where,
      orderBy: [{ postedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      take: PAGE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { applies: { where: { userId }, select: { id: true } } },
    })
    const page = rows.slice(0, PAGE)
    return {
      // No posting URL in the list: Apply (POST :id/apply) is the only way to the original posting.
      items: page.map(({ applies, url: _url, ...job }) => ({
        ...job,
        applied: applies.length > 0,
      })),
      nextCursor: rows.length > PAGE ? page[page.length - 1].id : null,
    }
  }

  /**
   * Charges externalApplyCost once (402 INSUFFICIENT_CREDITS writes nothing), records the apply,
   * adds the job to the seeker's tracker and returns the original posting URL to open.
   */
  async apply(userId: string, jobId: string) {
    const job = await this.prisma.externalJob.findUnique({ where: { id: jobId } })
    if (!job) throw new AppException("Job not found", HttpStatus.NOT_FOUND, "JOB_NOT_FOUND")
    const already = await this.prisma.externalJobApply.findUnique({
      where: { userId_externalJobId: { userId, externalJobId: jobId } },
    })
    if (already) return { url: job.url, charged: 0, alreadyApplied: true }
    if (!job.active)
      throw new AppException(
        "This posting is no longer available.",
        HttpStatus.GONE,
        "EXTERNAL_JOB_EXPIRED"
      )
    const { externalApplyCost } = await this.pricing.getConfig()
    await this.prisma.$transaction(async (tx) => {
      if (externalApplyCost > 0)
        await this.wallet.debit(
          {
            userId,
            amount: externalApplyCost,
            type: "EXTERNAL_APPLY",
            referenceId: job.id,
            actorId: userId,
            note: `Applied on the web: ${job.title} at ${job.company}`,
          },
          tx
        )
      await tx.externalJobApply.create({
        data: { userId, externalJobId: job.id, credits: externalApplyCost },
      })
      // Auto-track it next to Hyrr applications.
      const tracked = await tx.externalApplication.findFirst({
        where: { userId, externalJobId: job.id },
        select: { id: true },
      })
      if (!tracked)
        await tx.externalApplication.create({
          data: {
            userId,
            externalJobId: job.id,
            company: job.company,
            title: job.title,
            url: job.url,
            location: job.location,
            stage: "APPLIED",
            appliedAt: new Date(),
          },
        })
    })
    return { url: job.url, charged: externalApplyCost, alreadyApplied: false }
  }

  async status() {
    const [bySource, active] = await Promise.all([
      this.prisma.externalJob.groupBy({
        by: ["source"],
        where: { active: true },
        _count: { _all: true },
      }),
      this.prisma.externalJob.count({ where: { active: true } }),
    ])
    return {
      enabled: externalJobsEnabled(),
      providers: providers().map((p) => ({ source: p.source, configured: p.enabled })),
      active,
      bySource: Object.fromEntries(bySource.map((g) => [g.source, g._count._all])),
      lastSync: this.lastSync,
    }
  }
}
