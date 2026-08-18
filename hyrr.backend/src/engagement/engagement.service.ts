import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { EventType } from "@prisma/client"
import { AccessService, Actor } from "../core/access/access.service"
import { EmailDeliveryService } from "../core/delivery/email-delivery.service"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class EngagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly emailDelivery: EmailDeliveryService
  ) {}
  private db() {
    return this.prisma as any
  }
  private company(actor: Actor) {
    if (actor.role !== "RECRUITER" || !actor.companyId)
      throw new ForbiddenException("Recruiter company required")
    return actor.companyId
  }

  templates(actor: Actor) {
    return this.db().companyEmailTemplate.findMany({
      where: { companyId: this.company(actor) },
      orderBy: { name: "asc" },
    })
  }
  createTemplate(actor: Actor, data: any) {
    const companyId = this.company(actor)
    return this.db().companyEmailTemplate.upsert({
      where: { companyId_name: { companyId, name: data.name } },
      update: data,
      create: { ...data, companyId },
    })
  }
  async previewTemplate(actor: Actor, id: string, context: Record<string, string>) {
    const template = await this.db().companyEmailTemplate.findUnique({ where: { id } })
    if (!template || template.companyId !== this.company(actor))
      throw new NotFoundException("Email template not found")
    const render = (value: string) =>
      value.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => context[key] || "")
    return { subject: render(template.subject), body: render(template.body) }
  }
  async sendTemplate(actor: Actor, id: string, applicationId: string) {
    const application = await this.access.applicationFor(actor, applicationId, "manage")
    const template = await this.db().companyEmailTemplate.findUnique({ where: { id } })
    if (!template || template.companyId !== application.job.companyId)
      throw new NotFoundException("Email template not found")
    const values: Record<string, string> = {
      candidateName: application.name,
      jobTitle: application.job.title,
      companyName: application.job.companyId,
    }
    const render = (value: string) =>
      value.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => values[key] || "")
    return this.emailDelivery.send(
      application.email,
      render(template.subject),
      render(template.body)
    )
  }

  async createAvailability(
    actor: Actor,
    jobId: string,
    data: { startTime: string; endTime: string; meetingUrl?: string }
  ) {
    const job = await this.access.jobForManagement(actor, jobId)
    const startTime = new Date(data.startTime)
    const endTime = new Date(data.endTime)
    if (endTime <= startTime)
      throw new BadRequestException("The end time must be after the start time")
    return this.db().interviewAvailability.create({
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
  availableSlots(jobId: string) {
    return this.db().interviewAvailability.findMany({
      where: { jobId, bookedApplicationId: null, startTime: { gt: new Date() } },
      orderBy: { startTime: "asc" },
    })
  }
  async reserveSlot(actor: Actor, slotId: string, applicationId: string) {
    if (actor.role !== "SEEKER")
      throw new ForbiddenException("Only seekers can reserve interview slots")
    const application = await this.access.applicationFor(actor, applicationId, "view")
    const slot = await this.db().interviewAvailability.findUnique({ where: { id: slotId } })
    if (!slot || slot.bookedApplicationId || slot.jobId !== application.jobId)
      throw new BadRequestException("This interview slot is unavailable")
    const booked = await this.db().interviewAvailability.update({
      where: { id: slotId },
      data: { bookedApplicationId: applicationId },
    })
    await this.prisma.calendarEvent.create({
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
    return booked
  }
}
