import { Injectable, Logger, Optional } from "@nestjs/common"
import { JobStatus } from "@prisma/client"
import { CacheService } from "../cache/cache.service"
import { EmbeddingsService } from "../embeddings/embeddings.service"
import { PUBLIC_COMPANY_SELECT } from "../jobs/public-company"
import { PrismaService } from "../prisma/prisma.service"
import { MatchTab } from "./dtos/matching-query.dto"
import { decodeMatchCursor, encodeMatchCursor } from "./match-cursor"
import { matchingCacheKey, matchingCachePattern } from "./matching-cache"
import { blendMatch, computeProfileStrength, isThinProfile, scoreJobForProfile } from "./scoring"

export const MATCH_CACHE_TTL_SECONDS = 5 * 60
/** Minimum score for the "for-you" tab. */
export const FOR_YOU_MIN_SCORE = 40
/** ACTIVE jobs scored per request (newest first). */
const CANDIDATE_POOL = 500
const DEFAULT_LIMIT = 50

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name)

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    @Optional() private embeddings?: EmbeddingsService
  ) {}

  /** Drops every cached match list of a seeker (call after profile changes). */
  async invalidate(userId: string) {
    await this.cache.delByPattern(matchingCachePattern(userId))
  }

  async getMatchedJobs(
    userId: string,
    tab: MatchTab = "for-you",
    limit = DEFAULT_LIMIT,
    rawCursor?: string
  ) {
    const cursor = decodeMatchCursor(rawCursor)
    if (tab === "for-you")
      return this.forYouPage(userId, limit, cursor && "o" in cursor ? cursor.o : 0)

    const key = matchingCacheKey(userId, tab, limit, rawCursor ?? "")
    const cached = await this.cache.get<any>(key)
    if (cached) return cached

    const profile = await this.loadProfile(userId)
    const { profileStrength, missing } = computeProfileStrength(profile)
    const after = cursor && "t" in cursor ? cursor : null
    // Keyset page (newest first); one extra row tells whether another page exists.
    const rows = await this.prisma.job.findMany({
      where: after
        ? {
            status: JobStatus.ACTIVE,
            OR: [
              { createdAt: { lt: new Date(after.t) } },
              { createdAt: new Date(after.t), id: { lt: after.i } },
            ],
          }
        : { status: JobStatus.ACTIVE },
      include: { company: { select: PUBLIC_COMPANY_SELECT }, category: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    })
    const page = rows.slice(0, limit)
    const last = page[page.length - 1]
    const nextCursor =
      rows.length > limit && last
        ? encodeMatchCursor({ t: new Date(last.createdAt).toISOString(), i: last.id })
        : null

    const result = {
      profileStrength,
      missing,
      thinProfile: isThinProfile(profile),
      jobs: await this.score(userId, page, profile),
      nextCursor,
    }
    await this.cache.set(key, result, MATCH_CACHE_TTL_SECONDS)
    return result
  }

  /**
   * "For you": the whole ranked list (newest CANDIDATE_POOL jobs, minus own applications, score
   * >= FOR_YOU_MIN_SCORE) is computed once and cached, so every page slices the same order.
   */
  private async forYouPage(userId: string, limit: number, offset: number) {
    const key = matchingCacheKey(userId, "for-you", 0)
    let ranked = await this.cache.get<any>(key)
    if (!ranked) {
      const profile = await this.loadProfile(userId)
      const { profileStrength, missing } = computeProfileStrength(profile)
      const jobs = await this.prisma.job.findMany({
        where: { status: JobStatus.ACTIVE },
        include: { company: { select: PUBLIC_COMPANY_SELECT }, category: true },
        orderBy: { createdAt: "desc" },
        take: CANDIDATE_POOL,
      })
      let excluded = new Set<string>()
      if (jobs.length) {
        // Applied, saved (SAVED bookmark) or withdrawn: any application row hides the job.
        const own = await this.prisma.application.findMany({
          where: { userId, jobId: { in: jobs.map((j) => j.id) } },
          select: { jobId: true },
        })
        excluded = new Set(own.map((a) => a.jobId))
      }
      const scored = await this.score(
        userId,
        jobs.filter((job) => !excluded.has(job.id)),
        profile
      )
      ranked = {
        profileStrength,
        missing,
        thinProfile: isThinProfile(profile),
        jobs: scored
          .filter((job) => job.match.score >= FOR_YOU_MIN_SCORE)
          .sort(
            (a, b) =>
              b.match.score - a.match.score ||
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),
      }
      await this.cache.set(key, ranked, MATCH_CACHE_TTL_SECONDS)
    }
    const end = offset + limit
    return {
      ...ranked,
      jobs: ranked.jobs.slice(offset, end),
      nextCursor: end < ranked.jobs.length ? encodeMatchCursor({ o: end }) : null,
    }
  }

  private loadProfile(userId: string) {
    return this.prisma.seekerProfile.findUnique({
      where: { userId },
      include: {
        interests: { select: { id: true } },
        experiences: { select: { role: true } },
        educations: { select: { id: true } },
      },
    })
  }

  /** Rule score blended with the stored embedding similarity (when embeddings are on). */
  private async score<J extends { id: string; requirements: string[] | null }>(
    userId: string,
    jobs: J[],
    profile: Awaited<ReturnType<MatchingService["loadProfile"]>>
  ) {
    // Embedding cosine similarity (0..1) per job; empty when embeddings are off or not ready.
    const similarity = await this.similarities(
      userId,
      jobs.map((job) => job.id)
    )
    return jobs.map((job) => ({
      ...job,
      requirements: job.requirements ?? [],
      match: blendMatch(scoreJobForProfile(job as any, profile || {}), similarity.get(job.id)),
    }))
  }

  /** Never lets an embeddings problem break matching: falls back to rule-only scores. */
  private async similarities(userId: string, jobIds: string[]): Promise<Map<string, number>> {
    if (!this.embeddings || !jobIds.length) return new Map()
    try {
      return await this.embeddings.similarities(userId, jobIds)
    } catch (err: any) {
      this.logger.warn(`Embedding similarities failed, using rule scores: ${err?.message ?? err}`)
      return new Map()
    }
  }
}
