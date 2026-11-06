import { HttpStatus, Injectable } from "@nestjs/common"
import { AccessService, Actor } from "../core/access/access.service"
import {
  requireCompanyWriter,
  resolveCompanyMembership,
} from "../core/access/company-membership"
import { AppException, NotFoundAppException } from "../core/exceptions/app-exception"
import { PrismaService } from "../prisma/prisma.service"
import { CreateLabelDto, UpdateLabelDto } from "./dtos/labels.dto"

export const MAX_LABELS_PER_COMPANY = 50
export const LABEL_SELECT = { id: true, name: true, color: true } as const

const labelNotFound = () => new NotFoundAppException("Label not found", "LABEL_NOT_FOUND")

/** R3: company-scoped candidate labels. */
@Injectable()
export class LabelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService
  ) {}

  async list(actor: Actor) {
    const { companyId } = await resolveCompanyMembership(this.prisma, actor)
    const labels = await this.prisma.candidateLabel.findMany({
      where: { companyId },
      select: { ...LABEL_SELECT, _count: { select: { applications: true } } },
      orderBy: { name: "asc" },
      take: MAX_LABELS_PER_COMPANY * 2,
    })
    return labels.map(({ _count, ...l }) => ({ ...l, count: _count.applications }))
  }

  async create(actor: Actor, dto: CreateLabelDto) {
    const { companyId } = await requireCompanyWriter(this.prisma, actor)
    const count = await this.prisma.candidateLabel.count({ where: { companyId } })
    if (count >= MAX_LABELS_PER_COMPANY)
      throw new AppException(
        `A company can have at most ${MAX_LABELS_PER_COMPANY} labels`,
        HttpStatus.CONFLICT,
        "LABEL_LIMIT"
      )
    const label = await this.prisma.candidateLabel.create({
      data: { companyId, name: dto.name, color: dto.color },
      select: LABEL_SELECT,
    })
    return { ...label, count: 0 }
  }

  private async ownLabel(actor: Actor, id: string) {
    const { companyId } = await requireCompanyWriter(this.prisma, actor)
    const label = await this.prisma.candidateLabel.findFirst({
      where: { id, companyId },
      select: { id: true },
    })
    if (!label) throw labelNotFound()
    return label
  }

  async update(actor: Actor, id: string, dto: UpdateLabelDto) {
    await this.ownLabel(actor, id)
    const label = await this.prisma.candidateLabel.update({
      where: { id },
      data: { name: dto.name, color: dto.color },
      select: { ...LABEL_SELECT, _count: { select: { applications: true } } },
    })
    const { _count, ...rest } = label
    return { ...rest, count: _count.applications }
  }

  async remove(actor: Actor, id: string) {
    await this.ownLabel(actor, id)
    await this.prisma.candidateLabel.delete({ where: { id } })
    return { id, deleted: true }
  }

  /** Loads a label of the application's company (404 LABEL_NOT_FOUND otherwise). */
  async labelForCompany(labelId: string, companyId: string) {
    const label = await this.prisma.candidateLabel.findFirst({
      where: { id: labelId, companyId },
      select: LABEL_SELECT,
    })
    if (!label) throw labelNotFound()
    return label
  }

  /** PUT /applications/:id/labels: the given set replaces the application's labels. */
  async setForApplication(actor: Actor, applicationId: string, labelIds: string[]) {
    const app = await this.access.applicationFor(actor, applicationId, "manage")
    const ids = [...new Set(labelIds)]
    const labels = ids.length
      ? await this.prisma.candidateLabel.findMany({
          where: { id: { in: ids }, companyId: app.job.companyId },
          select: LABEL_SELECT,
        })
      : []
    if (labels.length !== ids.length) throw labelNotFound()
    await this.prisma.$transaction(async (tx) => {
      await tx.applicationLabel.deleteMany({
        where: { applicationId, labelId: { notIn: ids } },
      })
      if (ids.length)
        await tx.applicationLabel.createMany({
          data: ids.map((labelId) => ({ applicationId, labelId })),
          skipDuplicates: true,
        })
    })
    labels.sort((a, b) => a.name.localeCompare(b.name))
    return { labels }
  }

  async addToApplication(applicationId: string, labelId: string) {
    await this.prisma.applicationLabel.createMany({
      data: [{ applicationId, labelId }],
      skipDuplicates: true,
    })
  }

  async removeFromApplication(applicationId: string, labelId: string) {
    await this.prisma.applicationLabel.deleteMany({ where: { applicationId, labelId } })
  }
}
