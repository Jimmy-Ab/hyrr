import { Injectable, Logger, Optional } from "@nestjs/common"
import { JobStatus, NotificationType } from "@prisma/client"
import { WalletService } from "../billing/wallet.service"
import { CacheService } from "../cache/cache.service"
import { NotFoundAppException } from "../core/exceptions/app-exception"
import { MessagesGateway } from "../messages/messages.gateway"
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
    @Optional() private readonly search?: SearchService,
    @Optional() private readonly gateway?: MessagesGateway
  ) {}

  /** Live: the hiring team sees the moderation state; seekers who applied/saved drop the job. */
  private async broadcastModeration(
    job: { id: string; companyId: string; recruiterId: string },
    removed: { removedAt: string | null; removedReason: string | null; status: string }
  ) {
    if (!this.gateway) return
    try {
      this.gateway.emitToCompany(job.companyId, "job_moderated", { jobId: job.id, ...removed }, [
        job.recruiterId,
      ])
      if (removed.removedAt) {
        const seekers = await this.prisma.application.findMany({
          where: { jobId: job.id, userId: { not: null } },
          select: { userId: true },
        })
        this.gateway.emitToUsers(seekers.map((a) => a.userId!).filter(Boolean), "job_removed", {
          jobId: job.id,
        })
      }
    } catch (err: any) {
      // Live updates are best effort; the data change is committed.
      console.warn(`Moderation broadcast failed for ${job.id}: ${err?.message}`)
    }
  }

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
      select: {
        id: true,
        title: true,
        status: true,
        companyId: true,
        recruiterId: true,
        removedAt: true,
      },
    })
    if (!job) throw new NotFoundAppException("Job not found", "JOB_NOT_FOUND")
    return job
  }

  /** FLAGGED → ACTIVE, pending reports dismissed, reindexed, poster notified. */
  async restore(jobId: string, note: string | undefined, ctx: AdminCtx) {
    const job = await this.load(jobId)
    const reporterIds = await this.pendingReporterIds(jobId)
    const wasRemoved = !!job.removedAt
    const result = await this.prisma.$transaction(async (tx) => {
      // FLAGGED (under review) or removed by moderation → live again; the removal mark is cleared.
      const restored =
        job.status === JobStatus.FLAGGED || wasRemoved
          ? (
              await tx.job.updateMany({
                where: {
                  id: jobId,
                  OR: [{ status: JobStatus.FLAGGED }, { removedAt: { not: null } }],
                },
                data: { status: JobStatus.ACTIVE, removedAt: null, removedReason: null },
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
    await this.notifyMany(
      reporterIds,
      `Thanks for your report. We reviewed "${job.title}" and it stays up.`,
      jobId
    )
    await this.broadcastModeration(job, {
      removedAt: null,
      removedReason: null,
      status: result.restored ? JobStatus.ACTIVE : job.status,
    })
    return {
      job: { id: jobId, status: result.restored ? JobStatus.ACTIVE : job.status },
      dismissedReports: result.dismissed,
    }
  }

  /** CLOSED, pending reports resolved, unreviewed applications refunded, poster notified. */
  async remove(jobId: string, reason: string, ctx: AdminCtx) {
    const job = await this.load(jobId)
    const reporterIds = await this.pendingReporterIds(jobId)
    const result = await this.prisma.$transaction(async (tx) => {
      // removedAt blocks the recruiter from reopening it (jobs.service).
      await tx.job.update({
        where: { id: jobId },
        data: { status: JobStatus.CLOSED, removedAt: new Date(), removedReason: reason },
      })
      const resolved = await tx.jobReport.updateMany({
        where: { jobId, status: "PENDING" },
        data: { status: "RESOLVED" },
      })
      const applied = await tx.application.findMany({
        where: { jobId, status: "APPLIED", userId: { not: null } },
        select: { id: true },
      })
      const refunded = await this.wallet.refundUnreviewedApplications(jobId, tx)
      const refundRows = applied.length
        ? await tx.creditTransaction.findMany({
            where: { type: "REFUND", referenceId: { in: applied.map((a) => a.id) } },
            select: { userId: true },
          })
        : []
      const refundedUserIds = [
        ...new Set(refundRows.map((r) => r.userId).filter((u): u is string => !!u)),
      ]
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
      return { resolved: resolved.count, refunded, refundedUserIds }
    })
    await this.afterJobChange(jobId)
    await this.notify(
      job.recruiterId,
      `Your job "${job.title}" was removed by Hyrr moderation. Reason: ${reason}`,
      jobId
    )
    await this.notifyMany(
      result.refundedUserIds,
      `"${job.title}" was removed by Hyrr, so your application credit was refunded.`,
      jobId
    )
    await this.notifyMany(reporterIds, `Thanks for your report. We removed "${job.title}".`, jobId)
    await this.broadcastModeration(job, {
      removedAt: new Date().toISOString(),
      removedReason: reason,
      status: JobStatus.CLOSED,
    })
    return {
      job: { id: jobId, status: JobStatus.CLOSED },
      resolvedReports: result.resolved,
      refundedApplications: result.refunded,
    }
  }

  /** Pending reports → DISMISSED; the job itself is unchanged. */
  async dismiss(jobId: string, note: string | undefined, ctx: AdminCtx) {
    const job = await this.load(jobId)
    const reporterIds = await this.pendingReporterIds(jobId)
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
    await this.notifyMany(
      reporterIds,
      `Thanks for your report. We reviewed "${job.title}" and it stays up.`,
      jobId
    )
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

  /** Users with a still-open report on the job (they hear the outcome). */
  private async pendingReporterIds(jobId: string): Promise<string[]> {
    const rows = await this.prisma.jobReport.findMany({
      where: { jobId, status: "PENDING" },
      select: { reporterId: true },
    })
    return [...new Set(rows.map((r) => r.reporterId))]
  }

  private async notifyMany(userIds: string[], title: string, jobId: string) {
    for (const id of userIds) await this.notify(id, title, jobId)
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
