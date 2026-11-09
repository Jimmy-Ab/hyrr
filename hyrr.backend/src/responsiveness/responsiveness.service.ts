import { Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common"
import { ApplicationStatus, NotificationAction, NotificationType, UserRole } from "@prisma/client"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"
import { QueueService } from "../queue/queue.service"
import { businessDaysBetween, computeStats } from "./responsiveness"

export const STATS_CRON = "30 3 * * *"
export const STALE_REMINDER_CRON = "0 7 * * 1-5"
export const STALE_BUSINESS_DAYS = 5
const DAY = 86_400_000
const OPEN = [
  ApplicationStatus.APPLIED,
  ApplicationStatus.IN_PROCESS,
  ApplicationStatus.INTERVIEWING,
]

/**
 * Company responsiveness: nightly stats (Fast Responder badge, ghosting rate) and weekday
 * reminders about candidates who have waited more than 5 business days for an update.
 */
@Injectable()
export class ResponsivenessService implements OnModuleInit {
  private readonly logger = new Logger(ResponsivenessService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly queue?: QueueService
  ) {}

  onModuleInit() {
    if (!this.queue) return
    this.queue.process("maintenance", "company-stats", () => this.recomputeAll())
    this.queue.process("maintenance", "stale-candidates", () => this.remindStale())
    this.queue.repeat("maintenance", "company-stats", STATS_CRON)
    this.queue.repeat("maintenance", "stale-candidates", STALE_REMINDER_CRON)
  }

  /** First team response per application: status change by the team or recruiter message. */
  private async firstResponses(ids: string[], seekerOf: Map<string, string | null>) {
    const first = new Map<string, Date>()
    const keep = (id: string, at: Date) => {
      const cur = first.get(id)
      if (!cur || at < cur) first.set(id, at)
    }
    for (let i = 0; i < ids.length; i += 5000) {
      const chunk = ids.slice(i, i + 5000)
      const [events, messages] = await Promise.all([
        this.prisma.applicationStageEvent.findMany({
          where: {
            applicationId: { in: chunk },
            fromStatus: { not: null },
            toStatus: { not: ApplicationStatus.WITHDRAWN },
          },
          select: { applicationId: true, actorId: true, createdAt: true },
        }),
        this.prisma.message.groupBy({
          by: ["applicationId"],
          where: { applicationId: { in: chunk }, senderType: UserRole.RECRUITER },
          _min: { createdAt: true },
        }),
      ])
      for (const e of events)
        if (e.actorId !== seekerOf.get(e.applicationId)) keep(e.applicationId, e.createdAt)
      for (const m of messages) if (m._min.createdAt) keep(m.applicationId, m._min.createdAt)
    }
    return first
  }

  async recomputeAll(now = new Date()) {
    const apps = await this.prisma.application.findMany({
      where: {
        appliedAt: { gte: new Date(now.getTime() - 30 * DAY) },
        status: { notIn: [ApplicationStatus.SAVED, ApplicationStatus.SOURCED] },
      },
      select: {
        id: true,
        userId: true,
        appliedAt: true,
        status: true,
        job: { select: { companyId: true } },
      },
    })
    const first = await this.firstResponses(
      apps.map((a) => a.id),
      new Map(apps.map((a) => [a.id, a.userId]))
    )
    const byCompany = new Map<string, typeof apps>()
    for (const a of apps)
      byCompany.set(a.job.companyId, [...(byCompany.get(a.job.companyId) ?? []), a])
    for (const [companyId, list] of byCompany) {
      const stats = computeStats(
        list.map((a) => ({
          appliedAt: a.appliedAt,
          status: a.status,
          firstResponseAt: first.get(a.id) ?? null,
        })),
        now
      )
      await this.prisma.companyStats.upsert({
        where: { companyId },
        create: { companyId, ...stats, computedAt: now },
        update: { ...stats, computedAt: now },
      })
    }
    // Companies with no applications in 30 days lose the badge.
    await this.prisma.companyStats.updateMany({
      where: { companyId: { notIn: [...byCompany.keys()] } },
      data: { applications30d: 0, fastResponder: false, computedAt: now },
    })
    return { companies: byCompany.size }
  }

  /** Weekday nudge to job posters: candidates without any update for 5+ business days. */
  async remindStale(now = new Date()) {
    const open = await this.prisma.application.findMany({
      where: { status: { in: OPEN }, appliedAt: { lte: new Date(now.getTime() - 7 * DAY) } },
      select: {
        id: true,
        appliedAt: true,
        job: { select: { title: true, recruiterId: true } },
        stageEvents: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        messages: {
          where: { senderType: UserRole.RECRUITER },
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      take: 20_000,
    })
    const byRecruiter = new Map<string, { count: number; jobs: Set<string> }>()
    for (const a of open) {
      const last = [a.appliedAt, a.stageEvents[0]?.createdAt, a.messages[0]?.createdAt]
        .filter(Boolean)
        .reduce((x, y) => (y! > x! ? y : x)) as Date
      if (businessDaysBetween(last, now) < STALE_BUSINESS_DAYS) continue
      const entry = byRecruiter.get(a.job.recruiterId) ?? { count: 0, jobs: new Set<string>() }
      entry.count++
      entry.jobs.add(a.job.title)
      byRecruiter.set(a.job.recruiterId, entry)
    }
    for (const [recruiterId, { count, jobs }] of byRecruiter) {
      const names = [...jobs].slice(0, 3).join(", ") + (jobs.size > 3 ? "…" : "")
      await this.notifications
        .createNotification(
          recruiterId,
          `⏳ ${count} candidate${count === 1 ? " has" : "s have"} waited over ${STALE_BUSINESS_DAYS} business days for an update (${names}). A quick reply keeps your Fast Responder badge.`,
          NotificationType.APPLICATION,
          NotificationAction.APPLICATIONS
        )
        .catch((err) =>
          this.logger.warn(`Stale reminder failed for ${recruiterId}: ${err?.message}`)
        )
    }
    return { recruiters: byRecruiter.size }
  }
}
