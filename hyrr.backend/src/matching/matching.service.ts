import { Injectable } from "@nestjs/common"
import { JobStatus } from "@prisma/client"
import { CacheService } from "../cache/cache.service"
import { PUBLIC_COMPANY_SELECT } from "../jobs/public-company"
import { PrismaService } from "../prisma/prisma.service"
import { MatchTab } from "./dtos/matching-query.dto"
import { computeProfileStrength, isThinProfile, scoreJobForProfile } from "./scoring"

export const MATCH_CACHE_TTL_SECONDS = 5 * 60
/** Minimum score for the "for-you" tab. */
export const FOR_YOU_MIN_SCORE = 40
/** ACTIVE jobs scored per request (newest first). */
const CANDIDATE_POOL = 500
const DEFAULT_LIMIT = 50

const cacheKey = (userId: string, tab: MatchTab, limit: number) =>
  `matching:${userId}:${tab}:${limit}`

@Injectable()
export class MatchingService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService
  ) {}

  /** Drops every cached match list of a seeker (call after profile changes). */
  async invalidate(userId: string) {
    await this.cache.delByPattern(`matching:${userId}:*`)
  }

  async getMatchedJobs(userId: string, tab: MatchTab = "for-you", limit = DEFAULT_LIMIT) {
    const key = cacheKey(userId, tab, limit)
    const cached = await this.cache.get<any>(key)
    if (cached) return cached

    const profile = await this.prisma.seekerProfile.findUnique({
      where: { userId },
      include: {
        interests: { select: { id: true } },
        experiences: { select: { role: true } },
        educations: { select: { id: true } },
      },
    })
    const { profileStrength, missing } = computeProfileStrength(profile)
    const thinProfile = isThinProfile(profile)

    const jobs = await this.prisma.job.findMany({
      where: { status: JobStatus.ACTIVE },
      include: { company: { select: PUBLIC_COMPANY_SELECT }, category: true },
      orderBy: { createdAt: "desc" },
      take: tab === "all" ? limit : CANDIDATE_POOL,
    })

    let excluded = new Set<string>()
    if (tab === "for-you" && jobs.length) {
      // Applied, saved (SAVED bookmark) or withdrawn: any application row hides the job.
      const own = await this.prisma.application.findMany({
        where: { userId, jobId: { in: jobs.map((j) => j.id) } },
        select: { jobId: true },
      })
      excluded = new Set(own.map((a) => a.jobId))
    }

    let scored = jobs
      .filter((job) => !excluded.has(job.id))
      .map((job) => ({
        ...job,
        requirements: job.requirements ?? [],
        match: scoreJobForProfile(job, profile || {}),
      }))
    if (tab === "for-you") {
      scored = scored
        .filter((job) => job.match.score >= FOR_YOU_MIN_SCORE)
        .sort(
          (a, b) =>
            b.match.score - a.match.score ||
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, limit)
    }

    const result = { profileStrength, missing, thinProfile, jobs: scored }
    await this.cache.set(key, result, MATCH_CACHE_TTL_SECONDS)
    return result
  }
}
