import { HttpStatus, Injectable, Logger, Optional } from "@nestjs/common"
import {
  AlertFrequency,
  JobAlert,
  JobStatus,
  NotificationAction,
  NotificationType,
  Prisma,
} from "@prisma/client"
import { EmailService } from "../core/delivery/email.service"
import { appUrl, jobAlertDigest } from "../core/delivery/templates"
import { AppException, NotFoundAppException } from "../core/exceptions/app-exception"
import { MessagesGateway } from "../messages/messages.gateway"
import { PrismaService } from "../prisma/prisma.service"
import { AlertJob, jobMatchesAlert } from "./alert-matching"
import { CreateAlertDto, UpdateAlertDto } from "./dtos/alert.dto"

export const MAX_ALERTS_PER_USER = 10
/** Max jobs listed in one digest. */
export const DIGEST_MAX_JOBS = 20
/** INSTANT alerts evaluated per published job. */
const INSTANT_SCAN_LIMIT = 1000
/** Alerts processed per digest page. */
const DIGEST_PAGE_SIZE = 500
/** Newest ACTIVE jobs considered per digest page. */
const DIGEST_JOB_POOL = 2000

type DigestJob = AlertJob & {
  id: string
  createdAt: Date
  recruiterId: string
  company: { name: string } | null
}

const JOB_SELECT = {
  id: true,
  title: true,
  description: true,
  skills: true,
  requirements: true,
  location: true,
  remote: true,
  type: true,
  createdAt: true,
  recruiterId: true,
  company: { select: { name: true } },
} satisfies Prisma.JobSelect

/** Only live seekers receive alerts. */
const RECIPIENT_WHERE = { role: "SEEKER", status: "ACTIVE" } satisfies Prisma.UserWhereInput

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name)

  constructor(
    private prisma: PrismaService,
    @Optional() private email?: EmailService,
    @Optional() private gateway?: MessagesGateway
  ) {}

  // ─── CRUD ─────────────────────────────────────────────────────────

  list(userId: string) {
    return this.prisma.jobAlert.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: MAX_ALERTS_PER_USER * 2,
    })
  }

  async create(userId: string, dto: CreateAlertDto) {
    const count = await this.prisma.jobAlert.count({ where: { userId } })
    if (count >= MAX_ALERTS_PER_USER)
      throw new AppException(
        `You can keep up to ${MAX_ALERTS_PER_USER} job alerts`,
        HttpStatus.CONFLICT,
        "ALERT_LIMIT"
      )
    return this.prisma.jobAlert.create({
      data: {
        userId,
        name: dto.name,
        keywords: dto.keywords ?? [],
        locations: dto.locations ?? [],
        jobTypes: dto.jobTypes ?? [],
        remoteOnly: dto.remoteOnly ?? false,
        frequency: dto.frequency,
      },
    })
  }

  async update(userId: string, id: string, dto: UpdateAlertDto) {
    await this.owned(userId, id)
    const data: Prisma.JobAlertUpdateInput = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.keywords !== undefined) data.keywords = dto.keywords ?? []
    if (dto.locations !== undefined) data.locations = dto.locations ?? []
    if (dto.jobTypes !== undefined) data.jobTypes = dto.jobTypes ?? []
    if (dto.remoteOnly !== undefined) data.remoteOnly = dto.remoteOnly
    if (dto.frequency !== undefined) data.frequency = dto.frequency
    if (dto.active !== undefined) data.active = dto.active
    return this.prisma.jobAlert.update({ where: { id }, data })
  }

  async remove(userId: string, id: string) {
    await this.owned(userId, id)
    await this.prisma.jobAlert.delete({ where: { id } })
    return { success: true }
  }

  private async owned(userId: string, id: string) {
    const alert = await this.prisma.jobAlert.findFirst({
      where: { id, userId },
      select: { id: true },
    })
    if (!alert) throw new NotFoundAppException("Job alert not found", "ALERT_NOT_FOUND")
    return alert
  }

  // ─── Delivery ─────────────────────────────────────────────────────

  /**
   * INSTANT alerts for a freshly published job. Only ACTIVE jobs are announced (never DRAFT /
   * FLAGGED / CLOSED). Returns the number of users notified. Callers run it fire-and-forget.
   */
  async onJobPublished(jobId: string): Promise<number> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { ...JOB_SELECT, status: true },
    })
    if (!job || job.status !== JobStatus.ACTIVE) return 0

    const alerts = await this.prisma.jobAlert.findMany({
      where: {
        active: true,
        frequency: AlertFrequency.INSTANT,
        userId: { not: job.recruiterId },
        ...(job.remote ? {} : { remoteOnly: false }),
        user: RECIPIENT_WHERE,
      },
      select: {
        id: true,
        userId: true,
        keywords: true,
        locations: true,
        jobTypes: true,
        remoteOnly: true,
      },
      orderBy: { createdAt: "asc" },
      take: INSTANT_SCAN_LIMIT,
    })
    const matched = alerts.filter((alert) => jobMatchesAlert(job, alert))
    if (!matched.length) return 0

    const byUser = new Map<string, DigestJob[]>()
    for (const alert of matched) byUser.set(alert.userId, [job])
    const notified = await this.deliver(byUser)
    await this.prisma.jobAlert.updateMany({
      where: { id: { in: matched.map((a) => a.id) } },
      data: { lastSentAt: new Date() },
    })
    return notified
  }

  /**
   * DAILY / WEEKLY digest: per alert, ACTIVE jobs created after `lastSentAt` (or the alert's
   * createdAt) that match it; one e-mail + one in-app notification per user (max 20 jobs, merged
   * across the user's alerts of that frequency). Every processed alert gets `lastSentAt = run start`
   * (also when nothing matched, so the window never grows). Returns users notified.
   */
  async runDigest(frequency: "DAILY" | "WEEKLY"): Promise<{ alerts: number; users: number }> {
    const runStartedAt = new Date()
    let cursor: string | undefined
    let alertsProcessed = 0
    let usersNotified = 0

    for (;;) {
      const page: JobAlert[] = await this.prisma.jobAlert.findMany({
        where: { active: true, frequency, user: RECIPIENT_WHERE },
        orderBy: { id: "asc" },
        take: DIGEST_PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      if (!page.length) break
      cursor = page[page.length - 1].id

      const since = (alert: JobAlert) => alert.lastSentAt ?? alert.createdAt
      const oldest = page.reduce((min, a) => (since(a) < min ? since(a) : min), since(page[0]))
      const jobs: DigestJob[] = await this.prisma.job.findMany({
        where: { status: JobStatus.ACTIVE, createdAt: { gt: oldest, lte: runStartedAt } },
        select: JOB_SELECT,
        orderBy: { createdAt: "desc" },
        take: DIGEST_JOB_POOL,
      })

      const byUser = new Map<string, DigestJob[]>()
      for (const alert of page) {
        const from = since(alert)
        for (const job of jobs) {
          if (job.createdAt <= from || job.recruiterId === alert.userId) continue
          if (!jobMatchesAlert(job, alert)) continue
          const list = byUser.get(alert.userId) ?? []
          if (!list.some((j) => j.id === job.id)) list.push(job)
          byUser.set(alert.userId, list)
        }
      }
      for (const [userId, list] of byUser) {
        byUser.set(
          userId,
          list
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, DIGEST_MAX_JOBS)
        )
      }

      if (byUser.size) usersNotified += await this.deliver(byUser)
      await this.prisma.jobAlert.updateMany({
        where: { id: { in: page.map((a) => a.id) } },
        data: { lastSentAt: runStartedAt },
      })
      alertsProcessed += page.length
      if (page.length < DIGEST_PAGE_SIZE) break
    }
    return { alerts: alertsProcessed, users: usersNotified }
  }

  /**
   * One in-app notification (+ socket push) and one digest e-mail per user. Users who turned off
   * job recommendations get nothing; e-mail also requires `emailNotifications`. Returns users notified.
   */
  private async deliver(byUser: Map<string, DigestJob[]>): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...byUser.keys()] } },
      select: {
        id: true,
        email: true,
        name: true,
        setting: { select: { emailNotifications: true, jobRecommendations: true } },
      },
    })
    const recipients = users.filter((u) => u.setting?.jobRecommendations !== false)
    if (!recipients.length) return 0

    const titleFor = (jobs: DigestJob[]) =>
      jobs.length === 1
        ? `New job alert match: ${jobs[0].title} at ${jobs[0].company?.name || "a company"}`
        : `${jobs.length} new jobs match your job alerts`
    const created = await this.prisma.notification.createManyAndReturn({
      data: recipients.map((u) => {
        const jobs = byUser.get(u.id)!
        return {
          userId: u.id,
          title: titleFor(jobs),
          type: NotificationType.JOB_ALERT,
          actionView: NotificationAction.DISCOVER,
          targetId: jobs.length === 1 ? jobs[0].id : null,
        }
      }),
    })
    for (const notification of created) {
      try {
        this.gateway?.emitNotification(notification.userId, notification)
      } catch {
        // socket optional
      }
    }

    if (this.email) {
      for (const user of recipients) {
        if (!user.email || user.setting?.emailNotifications === false) continue
        const jobs = byUser.get(user.id)!.map((job) => ({
          title: job.title,
          company: job.company?.name || "A company",
          location: job.remote ? `${job.location} (remote)` : job.location,
          url: appUrl("SEEKER", `/discover?job=${encodeURIComponent(job.id)}`),
        }))
        const content = jobAlertDigest({ name: user.name, jobs })
        this.email
          .send({ to: user.email, ...content })
          .catch((err) =>
            this.logger.warn(`Job alert e-mail to ${user.id} failed: ${err?.message}`)
          )
      }
    }
    return recipients.length
  }
}
