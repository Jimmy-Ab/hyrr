import { HttpStatus, Injectable, Logger, Optional } from "@nestjs/common"
import {
  ApplicationStatus,
  CompanyMemberRole,
  NotificationAction,
  NotificationType,
  Prisma,
} from "@prisma/client"
import { AccessService, Actor } from "../core/access/access.service"
import { AppException } from "../core/exceptions/app-exception"
import { RealtimeService } from "../core/realtime/realtime.service"
import { MessagesGateway } from "../messages/messages.gateway"
import { NotificationsService } from "../notifications/notifications.service"
import { PrismaService } from "../prisma/prisma.service"

const DAY = 86_400_000
const fail = (message: string, status: HttpStatus, code: string) =>
  new AppException(message, status, code)

const OFFER_INCLUDE = {
  application: {
    select: {
      id: true,
      userId: true,
      name: true,
      status: true,
      job: {
        select: { id: true, title: true, companyId: true, company: { select: { name: true } } },
      },
    },
  },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.OfferInclude

type OfferRow = Prisma.OfferGetPayload<{ include: typeof OFFER_INCLUDE }>

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    amount
  )
const PERIOD = { YEAR: "year", MONTH: "month", HOUR: "hour" } as const

/** Short display string kept on Application.offerAmount (legacy field, display only). */
export const offerSummary = (o: {
  baseSalary: number
  salaryCurrency: string
  salaryPeriod: string
}) =>
  `${money(o.baseSalary, o.salaryCurrency)} / ${PERIOD[o.salaryPeriod as keyof typeof PERIOD] ?? o.salaryPeriod}`

/** Same shape for both sides; the IP stays server-side (audit log only). */
export function presentOffer(o: OfferRow, now = Date.now()) {
  return {
    id: o.id,
    applicationId: o.applicationId,
    jobTitle: o.jobTitle,
    companyName: o.application.job.company?.name ?? null,
    candidateName: o.application.name,
    createdBy: o.createdBy?.name ?? null,
    baseSalary: o.baseSalary,
    salaryCurrency: o.salaryCurrency,
    salaryPeriod: o.salaryPeriod,
    bonusAmount: o.bonusAmount,
    equityPercentage: o.equityPercentage,
    startDate: o.startDate,
    expiresAt: o.expiresAt,
    benefits: o.benefits,
    message: o.message,
    // SENT past its deadline reads as EXPIRED and can't be accepted.
    status: o.status === "SENT" && o.expiresAt.getTime() <= now ? "EXPIRED" : o.status,
    signatureName: o.signatureName,
    signedAt: o.signedAt,
    declineReason: o.declineReason,
    respondedAt: o.respondedAt,
    createdAt: o.createdAt,
  }
}

/** Digital offers: the hiring team sends terms, the candidate accepts with a typed signature. */
@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly gateway?: MessagesGateway,
    @Optional() private readonly realtime?: RealtimeService
  ) {}

  private load(id: string) {
    return this.prisma.offer.findUnique({ where: { id }, include: OFFER_INCLUDE })
  }

  private async teamIds(companyId: string, createdById?: string | null) {
    const owners = await this.prisma.companyMember.findMany({
      where: { companyId, role: CompanyMemberRole.OWNER },
      select: { userId: true },
    })
    return [...new Set([...(createdById ? [createdById] : []), ...owners.map((o) => o.userId)])]
  }

  private async notifyMany(ids: string[], title: string, type: NotificationType, targetId: string) {
    for (const id of ids)
      await this.notifications
        .createNotification(id, title, type, NotificationAction.APPLICATIONS, targetId)
        .catch((err) => this.logger.warn(`Offer notification failed: ${err?.message}`))
  }

  async create(
    actor: Actor,
    data: {
      applicationId: string
      jobTitle?: string
      baseSalary: number
      salaryCurrency: string
      salaryPeriod: "YEAR" | "MONTH" | "HOUR"
      bonusAmount?: number
      equityPercentage?: number
      startDate: string
      expiresAt: string
      benefits?: string[]
      message?: string
    }
  ) {
    const app = await this.access.applicationFor(actor, data.applicationId, "manage")
    if (!app.userId)
      throw fail(
        "This candidate has no Hyrr account, so they can't accept in the app. Send the offer by e-mail instead.",
        HttpStatus.BAD_REQUEST,
        "CANDIDATE_HAS_NO_ACCOUNT"
      )
    if (app.status === ApplicationStatus.WITHDRAWN || app.status === ApplicationStatus.ARCHIVED)
      throw fail("This application is closed.", HttpStatus.CONFLICT, "APPLICATION_CLOSED")
    const now = Date.now()
    const start = new Date(data.startDate)
    const expires = new Date(data.expiresAt)
    if (expires.getTime() < now + 3_600_000)
      throw fail(
        "Give the candidate at least an hour to respond.",
        HttpStatus.BAD_REQUEST,
        "OFFER_EXPIRY_TOO_SOON"
      )
    if (expires.getTime() > now + 60 * DAY)
      throw fail(
        "An offer can stay open for at most 60 days.",
        HttpStatus.BAD_REQUEST,
        "OFFER_EXPIRY_TOO_FAR"
      )
    if (start.getTime() < now - DAY)
      throw fail(
        "The start date can't be in the past.",
        HttpStatus.BAD_REQUEST,
        "OFFER_START_IN_PAST"
      )
    const benefits = [...new Set((data.benefits ?? []).map((b) => b.trim()).filter(Boolean))]

    const offer = await this.prisma.$transaction(async (tx) => {
      // One live offer per application: a new one replaces the previous.
      await tx.offer.updateMany({
        where: { applicationId: app.id, status: "SENT" },
        data: { status: "WITHDRAWN", respondedAt: new Date() },
      })
      const created = await tx.offer.create({
        data: {
          applicationId: app.id,
          createdById: actor.userId,
          jobTitle: data.jobTitle || app.job.title,
          baseSalary: data.baseSalary,
          salaryCurrency: data.salaryCurrency,
          salaryPeriod: data.salaryPeriod,
          bonusAmount: data.bonusAmount ?? null,
          equityPercentage: data.equityPercentage ?? null,
          startDate: start,
          expiresAt: expires,
          benefits,
          message: data.message || null,
        },
        include: OFFER_INCLUDE,
      })
      await tx.application.update({
        where: { id: app.id },
        data: {
          status: ApplicationStatus.OFFER,
          tag: "Offer Sent",
          offerAmount: offerSummary(created),
        },
      })
      if (app.status !== ApplicationStatus.OFFER)
        await tx.applicationStageEvent.create({
          data: {
            applicationId: app.id,
            fromStatus: app.status,
            toStatus: ApplicationStatus.OFFER,
            actorId: actor.userId,
          },
        })
      return created
    })

    const payload = presentOffer(offer)
    await this.notifyMany(
      [app.userId],
      `🎉 ${payload.companyName ?? "The hiring team"} sent you an offer for ${payload.jobTitle}`,
      NotificationType.OFFER,
      app.id
    )
    this.gateway?.emitToUsers([app.userId], "offer_extended", payload)
    this.gateway?.emitToCompany(offer.application.job.companyId, "offer_updated", payload)
    this.gateway?.emitApplicationUpdate(
      app.userId,
      {
        applicationId: app.id,
        status: ApplicationStatus.OFFER,
        tag: "Offer Sent",
        actorId: actor.userId,
      },
      offer.application.job.companyId
    )
    return payload
  }

  async list(actor: Actor, applicationId?: string) {
    if (actor.role === "SEEKER") {
      const rows = await this.prisma.offer.findMany({
        where: { application: { userId: actor.userId }, status: { not: "WITHDRAWN" } },
        include: OFFER_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: 50,
      })
      return rows.map((r) => presentOffer(r))
    }
    if (!applicationId)
      throw fail("applicationId is required", HttpStatus.BAD_REQUEST, "APPLICATION_REQUIRED")
    await this.access.applicationFor(actor, applicationId, "view")
    const rows = await this.prisma.offer.findMany({
      where: { applicationId },
      include: OFFER_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 20,
    })
    return rows.map((r) => presentOffer(r))
  }

  /** The candidate's offer that is still open, or a clear error. */
  private async openOfferFor(actor: Actor, id: string) {
    const offer = await this.load(id)
    if (!offer || actor.role !== "SEEKER" || offer.application.userId !== actor.userId)
      throw fail("Offer not found", HttpStatus.NOT_FOUND, "OFFER_NOT_FOUND")
    if (offer.status !== "SENT")
      throw fail("This offer is no longer open.", HttpStatus.CONFLICT, "OFFER_CLOSED")
    if (offer.expiresAt.getTime() <= Date.now())
      throw fail(
        "This offer has expired. Contact the hiring team if you're still interested.",
        HttpStatus.CONFLICT,
        "OFFER_EXPIRED"
      )
    return offer
  }

  async accept(actor: Actor, id: string, signatureName: string, ip?: string) {
    const offer = await this.openOfferFor(actor, id)
    const signedAt = new Date()
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.offer.updateMany({
        where: { id, status: "SENT" },
        data: {
          status: "ACCEPTED",
          signatureName,
          signedAt,
          signedIp: ip ?? null,
          respondedAt: signedAt,
        },
      })
      if (claimed.count !== 1)
        throw fail("This offer is no longer open.", HttpStatus.CONFLICT, "OFFER_CLOSED")
      await tx.application.update({
        where: { id: offer.applicationId },
        data: { tag: "Offer Accepted" },
      })
      // Evidence trail for the typed-name acceptance (not a qualified e-signature).
      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: "offer.accept",
          target: `application:${offer.applicationId}`,
          details: `Accepted the offer for ${offer.jobTitle}, signed as "${signatureName}"`,
          meta: { offerId: id, signatureName, signedAt: signedAt.toISOString() },
          ip: ip ?? "",
          severity: "info",
        },
      })
    })
    const fresh = await this.load(id)
    const payload = presentOffer(fresh!)
    const companyId = offer.application.job.companyId
    await this.notifyMany(
      await this.teamIds(companyId, offer.createdById),
      `🎉 ${offer.application.name} accepted the offer for ${offer.jobTitle}!`,
      NotificationType.OFFER,
      offer.applicationId
    )
    this.gateway?.emitToCompany(companyId, "offer_accepted", payload)
    this.gateway?.emitApplicationUpdate(
      offer.application.userId,
      {
        applicationId: offer.applicationId,
        status: "OFFER",
        tag: "Offer Accepted",
        actorId: actor.userId,
      },
      companyId
    )
    this.realtime?.adminMetric("placement", { companyId })
    return payload
  }

  async decline(actor: Actor, id: string, reason?: string) {
    const offer = await this.openOfferFor(actor, id)
    const { count } = await this.prisma.offer.updateMany({
      where: { id, status: "SENT" },
      data: { status: "DECLINED", declineReason: reason || null, respondedAt: new Date() },
    })
    if (count !== 1)
      throw fail("This offer is no longer open.", HttpStatus.CONFLICT, "OFFER_CLOSED")
    await this.prisma.application.update({
      where: { id: offer.applicationId },
      data: { tag: "Offer Declined" },
    })
    const payload = presentOffer((await this.load(id))!)
    await this.notifyMany(
      await this.teamIds(offer.application.job.companyId, offer.createdById),
      `${offer.application.name} declined the offer for ${offer.jobTitle}.`,
      NotificationType.OFFER,
      offer.applicationId
    )
    this.gateway?.emitToCompany(offer.application.job.companyId, "offer_declined", payload)
    return payload
  }

  async withdraw(actor: Actor, id: string) {
    const offer = await this.load(id)
    if (!offer) throw fail("Offer not found", HttpStatus.NOT_FOUND, "OFFER_NOT_FOUND")
    await this.access.applicationFor(actor, offer.applicationId, "manage")
    const { count } = await this.prisma.offer.updateMany({
      where: { id, status: "SENT" },
      data: { status: "WITHDRAWN", respondedAt: new Date() },
    })
    if (count !== 1)
      throw fail("Only open offers can be withdrawn.", HttpStatus.CONFLICT, "OFFER_CLOSED")
    const payload = presentOffer((await this.load(id))!)
    if (offer.application.userId) {
      await this.notifyMany(
        [offer.application.userId],
        `The offer for ${offer.jobTitle} was withdrawn.`,
        NotificationType.OFFER,
        offer.applicationId
      )
      this.gateway?.emitToUsers([offer.application.userId], "offer_updated", payload)
    }
    this.gateway?.emitToCompany(offer.application.job.companyId, "offer_updated", payload)
    return payload
  }
}
