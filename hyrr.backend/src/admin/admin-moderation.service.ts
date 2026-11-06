import { Injectable, Logger, Optional } from "@nestjs/common"
import { JobStatus, NotificationType } from "@prisma/client"
import { WalletService } from "../billing/wallet.service"
import { CacheService } from "../cache/cache.service"
import { NotFoundAppException } from "../core/exceptions/app-exception"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"
import { SearchService } from "../search/search.service"
import { AuditService } from "./audit.service"
import { pageArgs, pageOf } from "./pagination"

export type AdminCtx = { actorId: string; ip?: string | null }

const COMPANY_SELECT = { id: true, name: true, verified: true, status: true } as const

/** Flagged / reported jobs: one queue, restore, remove (refunds) or dismiss the reports. */
@Injectable()
export class AdminModerationService {
  private readonly logger = new Logger(AdminModerationService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly search?: SearchService
  ) {}

  /** "open" = FLAGGED jobs and jobs with a PENDING report; "all" = flagged or ever reported. */
  async list(status: "open" | "all" = "open", cursor?: string, limit?: number) {
    const reported = await this.prisma.jobReport.findMany({
      where: status === "open" ? { status: "PENDING" } : {},
      distinct: ["jobId"],
      select: { jobId: true },
    })
    const jobs = await this.prisma.job.findMany({
      where: {
        OR: [{ status: JobStatus.FLAGGED }, { id: { in: reported.map((r) => r.jobId) } }],
      },
      select: {
        id: true,
        title: true,
        status: true,
        publishedAt: true,
        company: { select: COMPANY_SELECT },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageArgs(cursor, limit),
    })
    const page = pageOf(jobs, limit)
    const ids = page.items.map((j) => j.id)
    const groups = ids.length
      ? await this.prisma.jobReport.groupBy({
          by: ["jobId", "reason", "status"],
          where: { jobId: { in: ids } },
          _count: { _all: true },
          _max: { createdAt: true },
        })
      : []
    return {
      items: page.items.map((job) => {
        const mine = groups.filter((g) => g.jobId === job.id)
        const reasons = new Map<string, number>()
        let total = 0
        let pending = 0
        let lastAt: Date | null = null
        for (const g of mine) {
          const count = g._count._all
          total += count
          if (g.status === "PENDING") pending += count
          reasons.set(g.reason, (reasons.get(g.reason) ?? 0) + count)
          const at = g._max.createdAt
          if (at && (!lastAt || at > lastAt)) lastAt = at
        }
        return {
          job,
          reports: {
            total,
            pending,
            reasons: [...reasons]
              .map(([reason, count]) => ({ reason, count }))
              .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
            lastAt,
          },
        }
      }),
      nextCursor: page.nextCursor,
    }
  }

  async detail(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        company: { select: { ...COMPANY_SELECT, logo: true, website: true } },
        category: true,
        postedBy: { select: { id: true, name: true, email: true } },
      },
    })
    if (!job) throw new NotFoundAppException("Job not found", "JOB_NOT_FOUND")
    const reports = await this.prisma.jobReport.findMany({
      where: { jobId },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
    const reporters = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(reports.map((r) => r.reporterId))] } },
      select: { id: true, name: true },
    })
    const byId = new Map(reporters.map((u) => [u.id, u]))
    const [flaggedJobs, removedJobs] = await Promise.all([
      this.prisma.job.count({ where: { companyId: job.companyId, status: JobStatus.FLAGGED } }),
      this.prisma.auditLog.count({
        where: { action: "job.remove", meta: { path: ["companyId"], equals: job.companyId } },
      }),
    ])
    const { postedBy, ...rest } = job
    return {
      job: { ...rest, recruiter: postedBy },
      reports: reports.map((r) => ({
        id: r.id,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.createdAt,
        reporter: byId.get(r.reporterId) ?? { id: r.reporterId, name: "Deleted user" },
      })),
      companyHistory: {
        flaggedJobs,
        removedJobs,
        verified: job.company.verified,
        status: job.company.status,
      },
    }
  }

  private async load(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, status: true, companyId: true, recruiterId: true },
    })
    if (!job) throw new NotFoundAppException("Job not found", "JOB_NOT_FOUND")
    return job
  }

  /** FLAGGED → ACTIVE, pending reports dismissed, reindexed, poster notified. */
  async restore(jobId: string, note: string | undefined, ctx: AdminCtx) {
    const job = await this.load(jobId)
    const result = await this.prisma.$transaction(async (tx) => {
      const restored =
        job.status === JobStatus.FLAGGED
          ? (
              await tx.job.updateMany({
                where: { id: jobId, status: JobStatus.FLAGGED },
                data: { status: JobStatus.ACTIVE },
              })
            ).count === 1
          : false
      const dismissed = await tx.jobReport.updateMany({
        where: { jobId, status: "PENDING" },
        data: { status: "DISMISSED" },
      })
      await this.audit.record(
        {
          actorId: ctx.actorId,
          action: "job.restore",
          target: `job:${jobId}`,
          details: `Restored job "${job.title}"${restored ? "" : " (reports dismissed)"}`,
          reason: note,
          meta: {
            companyId: job.companyId,
            before: { status: job.status },
            after: { status: restored ? JobStatus.ACTIVE : job.status },
            dismissedReports: dismissed.count,
          },
          ip: ctx.ip,
          severity: "info",
        },
        tx
      )
      return { restored, dismissed: dismissed.count }
    })
    await this.afterJobChange(jobId)
    if (result.restored)
      await this.notify(
        job.recruiterId,
        `Your job "${job.title}" was reviewed and is visible to job seekers again`,
        jobId
      )
    return {
      job: { id: jobId, status: result.restored ? JobStatus.ACTIVE : job.status },
      dismissedReports: result.dismissed,
    }
  }

  /** CLOSED, pending reports resolved, unreviewed applications refunded, poster notified. */
  async remove(jobId: string, reason: string, ctx: AdminCtx) {
    const job = await this.load(jobId)
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.job.update({ where: { id: jobId }, data: { status: JobStatus.CLOSED } })
      const resolved = await tx.jobReport.updateMany({
        where: { jobId, status: "PENDING" },
        data: { status: "RESOLVED" },
      })
      const refunded = await this.wallet.refundUnreviewedApplications(jobId, tx)
      await this.audit.record(
        {
          actorId: ctx.actorId,
          action: "job.remove",
          target: `job:${jobId}`,
          details: `Removed job "${job.title}"`,
          reason,
          meta: {
            companyId: job.companyId,
            before: { status: job.status },
            after: { status: JobStatus.CLOSED },
            resolvedReports: resolved.count,
            refundedApplications: refunded,
          },
          ip: ctx.ip,
          severity: "warning",
        },
        tx
      )
      return { resolved: resolved.count, refunded }
    })
    await this.afterJobChange(jobId)
    await this.notify(
      job.recruiterId,
      `Your job "${job.title}" was removed by Hyrr moderation. Reason: ${reason}`,
      jobId
    )
    return {
      job: { id: jobId, status: JobStatus.CLOSED },
      resolvedReports: result.resolved,
      refundedApplications: result.refunded,
    }
  }

  /** Pending reports → DISMISSED; the job itself is unchanged. */
  async dismiss(jobId: string, note: string | undefined, ctx: AdminCtx) {
    const job = await this.load(jobId)
    const dismissed = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.jobReport.updateMany({
        where: { jobId, status: "PENDING" },
        data: { status: "DISMISSED" },
      })
      await this.audit.record(
        {
          actorId: ctx.actorId,
          action: "job.dismiss_reports",
          target: `job:${jobId}`,
          details: `Dismissed ${updated.count} report(s) on "${job.title}"`,
          reason: note,
          meta: { companyId: job.companyId, dismissedReports: updated.count },
          ip: ctx.ip,
          severity: "info",
        },
        tx
      )
      return updated.count
    })
    return { job: { id: jobId, status: job.status }, dismissedReports: dismissed }
  }

  private async afterJobChange(jobId: string) {
    try {
      await this.cache.delByPattern("jobs:public*")
      await this.cache.delByPattern("ai:featured-jobs:*")
      // Indexes ACTIVE jobs and removes every other status.
      this.search?.indexJobSoon(jobId)
    } catch (err: any) {
      this.logger.warn(`Post-moderation refresh failed for ${jobId}: ${err?.message}`)
    }
  }

  private async notify(userId: string, title: string, jobId: string) {
    try {
      await this.notifications?.createNotification(
        userId,
        title,
        NotificationType.SYSTEM,
        undefined,
        jobId
      )
    } catch (err: any) {
      this.logger.warn(`Moderation notification failed for ${jobId}: ${err?.message}`)
    }
  }
}
