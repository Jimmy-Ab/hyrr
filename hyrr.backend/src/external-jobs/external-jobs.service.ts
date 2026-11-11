import { HttpStatus, Injectable, Logger, Optional } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { PricingService } from "../billing/pricing.service"
import { WalletService } from "../billing/wallet.service"
import { CacheService } from "../cache/cache.service"
import { AppException } from "../core/exceptions/app-exception"
import type { JobFilters } from "../jobs/dtos/job-filters.dto"
import { evaluateJobContent } from "../jobs/job-content-policy"
import { webJobFilterWhere } from "../jobs/job-filters"
import { scoreJobForProfile, type JobMatch } from "../matching/scoring"
import { PrismaService } from "../prisma/prisma.service"
import { providers, type ExternalJobInput, type Provider } from "./providers"

const DAY = 86_400_000
const PAGE = 30
/** Newest matching rows ranked per request (search and filters narrow it first). */
const RANK_POOL = 500
const RANK_TTL_SECONDS = 5 * 60

type RankedWebJobs = { ids: string[]; matches: Record<string, JobMatch> }

/** Opaque page cursor: the offset into the cached ranking. */
function decodeOffsetCursor(cursor?: string): number {
  if (!cursor) return 0
  if (!/^\d{1,5}$/.test(cursor))
    throw new AppException(
      "This list link has expired. Reload the page.",
      HttpStatus.BAD_REQUEST,
      "INVALID_CURSOR"
    )
  return Number(cursor)
}

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
    private readonly pricing: PricingService,
    @Optional() private readonly cache?: CacheService
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

  /**
   * Active web jobs ranked for the seeker (keyword scoring from matching/scoring.ts: title,
   * skills in the text, preferred categories by name, location, type). The ranking of the newest
   * RANK_POOL matches is cached per user + search for 5 minutes and paged by an opaque offset
   * cursor. `refresh` recomputes it from stored rows: no provider calls, no embeddings.
   */
  async list(
    userId: string,
    q?: string,
    remote?: boolean,
    cursor?: string,
    filters: JobFilters = {},
    opts: { refresh?: boolean } = {}
  ) {
    const offset = decodeOffsetCursor(cursor)
    const terms = (q ?? "").trim()
    const key = `webjobs:${userId}:${JSON.stringify({ terms, remote: !!remote, filters })}`
    let ranked = opts.refresh ? null : await this.cache?.get<RankedWebJobs>(key)
    if (!ranked || !Array.isArray(ranked.ids)) {
      ranked = await this.rank(userId, terms, !!remote, filters)
      await this.cache?.set(key, ranked, RANK_TTL_SECONDS)
    }

    const ids = ranked.ids.slice(offset, offset + PAGE)
    const rows = ids.length
      ? await this.prisma.externalJob.findMany({
          where: { id: { in: ids }, active: true },
          include: { applies: { where: { userId }, select: { id: true } } },
        })
      : []
    const byId = new Map(rows.map((r) => [r.id, r]))
    const end = offset + PAGE
    return {
      // No posting URL in the list: Apply (POST :id/apply) is the only way to the original posting.
      items: ids
        .map((id) => byId.get(id))
        .filter((r): r is NonNullable<typeof r> => !!r)
        .map(({ applies, url: _url, ...job }) => ({
          ...job,
          applied: applies.length > 0,
          match: ranked!.matches[job.id] ?? null,
        })),
      nextCursor: end < ranked.ids.length ? String(end) : null,
    }
  }

  private async rank(
    userId: string,
    terms: string,
    remote: boolean,
    filters: JobFilters
  ): Promise<RankedWebJobs> {
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
    const [profile, pool] = await Promise.all([
      this.prisma.seekerProfile.findUnique({
        where: { userId },
        include: {
          interests: { select: { id: true, name: true } },
          experiences: { select: { role: true } },
        },
      }),
      this.prisma.externalJob.findMany({
        where,
        orderBy: [{ postedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
        take: RANK_POOL,
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          remote: true,
          employmentType: true,
          category: true,
        },
      }),
    ])
    const interests = profile?.interests ?? []
    // Provider categories are free text: a preferred category matches when either name contains
    // the other ("Software Development" ~ "Software").
    const interestFor = (category: string | null) => {
      const c = category?.toLowerCase()
      if (!c) return null
      return (
        interests.find((i) => {
          const n = i.name.toLowerCase()
          return c.includes(n) || n.includes(c)
        })?.id ?? null
      )
    }
    const scored = pool.map((job, index) => ({
      id: job.id,
      index,
      match: scoreJobForProfile(
        {
          title: job.title,
          description: job.description,
          location: job.location,
          remote: job.remote,
          type: job.employmentType,
          categoryId: interestFor(job.category),
        },
        profile ?? {}
      ),
    }))
    // Best match first; ties keep recency (pool order).
    scored.sort((a, b) => b.match.score - a.match.score || a.index - b.index)
    return {
      ids: scored.map((s) => s.id),
      matches: Object.fromEntries(scored.map((s) => [s.id, s.match])),
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
