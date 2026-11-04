import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { EventType, JobStatus } from "@prisma/client"
import { AccessService, Actor } from "../core/access/access.service"
import { requireCompanyWriter, resolveCompanyMembership } from "../core/access/company-membership"
import { EmailDeliveryService } from "../core/delivery/email-delivery.service"
import { PrismaService } from "../prisma/prisma.service"

const render = (value: string, values: Record<string, string>) =>
  value.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => values[key] ?? "")

@Injectable()
export class EngagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly emailDelivery: EmailDeliveryService
  ) {}

  async templates(actor: Actor) {
    const { companyId } = await resolveCompanyMembership(this.prisma, actor)
    return this.prisma.companyEmailTemplate.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      take: 200,
    })
  }

  async createTemplate(
    actor: Actor,
    data: { name: string; kind: string; subject: string; body: string }
  ) {
    const { companyId } = await requireCompanyWriter(this.prisma, actor)
    const fields = { name: data.name, kind: data.kind, subject: data.subject, body: data.body }
    return this.prisma.companyEmailTemplate.upsert({
      where: { companyId_name: { companyId, name: data.name } },
      update: fields,
      create: { ...fields, companyId },
    })
  }

  async previewTemplate(actor: Actor, id: string, context: Record<string, string>) {
    const { companyId } = await resolveCompanyMembership(this.prisma, actor)
    const template = await this.prisma.companyEmailTemplate.findUnique({ where: { id } })
    if (!template || template.companyId !== companyId)
      throw new NotFoundException("Email template not found")
    const values: Record<string, string> = {}
    for (const [key, value] of Object.entries(context || {})) {
      if (typeof value === "string") values[key] = value.slice(0, 1000)
    }
    return { subject: render(template.subject, values), body: render(template.body, values) }
  }

  async sendTemplate(actor: Actor, id: string, applicationId: string) {
    if (actor.role !== "ADMIN") await requireCompanyWriter(this.prisma, actor)
    const application = await this.access.applicationFor(actor, applicationId, "manage")
    const template = await this.prisma.companyEmailTemplate.findUnique({ where: { id } })
    if (!template || template.companyId !== application.job.companyId)
      throw new NotFoundException("Email template not found")
    const company = await this.prisma.company.findUnique({
      where: { id: application.job.companyId },
      select: { name: true },
    })
    const values: Record<string, string> = {
      candidateName: application.name,
      jobTitle: application.job.title,
      companyName: company?.name || "",
    }
    return this.emailDelivery.send(
      application.email,
      render(template.subject, values),
      render(template.body, values)
    )
  }

  async createAvailability(
    actor: Actor,
    jobId: string,
    data: { startTime: string; endTime: string; meetingUrl?: string }
  ) {
    if (actor.role !== "ADMIN") await requireCompanyWriter(this.prisma, actor)
    const job = await this.access.jobForManagement(actor, jobId)
    const startTime = new Date(data.startTime)
    const endTime = new Date(data.endTime)
    if (endTime <= startTime)
      throw new BadRequestException("The end time must be after the start time")
    if (startTime <= new Date()) throw new BadRequestException("The slot must start in the future")
    return this.prisma.interviewAvailability.create({
      data: {
        companyId: job.companyId,
        jobId,
        createdById: actor.userId,
        startTime,
        endTime,
        meetingUrl: data.meetingUrl,
      },
    })
  }

  /** Public: open future slots for an active job. Never exposes meeting links. */
  async availableSlots(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { status: true } })
    if (!job || job.status !== JobStatus.ACTIVE) throw new NotFoundException("Job not found")
    const slots = await this.prisma.interviewAvailability.findMany({
      where: { jobId, bookedApplicationId: null, startTime: { gt: new Date() } },
      orderBy: { startTime: "asc" },
      select: { id: true, startTime: true, endTime: true, bookedApplicationId: true },
      take: 100,
    })
    return slots.map((slot) => ({
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      booked: !!slot.bookedApplicationId,
    }))
  }

  /** Atomically books a slot for the caller's own application (no double booking). */
  async reserveSlot(actor: Actor, slotId: string, applicationId: string) {
    if (actor.role !== "SEEKER")
      throw new ForbiddenException("Only seekers can reserve interview slots")
    const application = await this.access.applicationFor(actor, applicationId, "view")
    if (application.userId !== actor.userId)
      throw new ForbiddenException("You can only book interviews for your own applications")

    return this.prisma.$transaction(async (tx) => {
      const slot = await tx.interviewAvailability.findUnique({ where: { id: slotId } })
      if (!slot || slot.jobId !== application.jobId || slot.startTime <= new Date())
        throw new BadRequestException("This interview slot is unavailable")

      const existing = await tx.interviewAvailability.findUnique({
        where: { bookedApplicationId: applicationId },
      })
      if (existing) throw new ConflictException("You already booked an interview slot")

      const claimed = await tx.interviewAvailability.updateMany({
        where: { id: slotId, bookedApplicationId: null },
        data: { bookedApplicationId: applicationId },
      })
      if (claimed.count !== 1) throw new ConflictException("This interview slot was just taken")

      await tx.calendarEvent.create({
        data: {
          applicationId,
          userId: actor.userId,
          title: `Interview: ${application.job.title}`,
          startTime: slot.startTime,
          endTime: slot.endTime,
          meetingUrl: slot.meetingUrl,
          type: EventType.INTERVIEW,
        },
      })
      return {
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        meetingUrl: slot.meetingUrl,
        bookedApplicationId: applicationId,
        booked: true,
      }
    })
  }
}
