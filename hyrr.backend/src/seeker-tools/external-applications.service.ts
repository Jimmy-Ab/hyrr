import { HttpStatus, Injectable } from "@nestjs/common"
import { AppException } from "../core/exceptions/app-exception"
import { PrismaService } from "../prisma/prisma.service"
import type {
  CreateExternalApplicationDto,
  UpdateExternalApplicationDto,
} from "./dtos/external-application.dto"

/** Seeker's own tracker for jobs outside Hyrr. Free, private to the seeker. */
export const EXTERNAL_LIMIT = 300

@Injectable()
export class ExternalApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.externalApplication.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: EXTERNAL_LIMIT,
    })
  }

  async create(userId: string, dto: CreateExternalApplicationDto) {
    if ((await this.prisma.externalApplication.count({ where: { userId } })) >= EXTERNAL_LIMIT)
      throw new AppException(
        `You can track up to ${EXTERNAL_LIMIT} external jobs. Remove old ones first.`,
        HttpStatus.CONFLICT,
        "EXTERNAL_LIMIT"
      )
    return this.prisma.externalApplication.create({
      data: {
        userId,
        company: dto.company,
        title: dto.title,
        url: dto.url || null,
        location: dto.location || null,
        stage: dto.stage ?? "APPLIED",
        notes: dto.notes || null,
        appliedAt: dto.appliedAt ? new Date(dto.appliedAt) : null,
      },
    })
  }

  private async own(userId: string, id: string) {
    const row = await this.prisma.externalApplication.findUnique({ where: { id } })
    if (!row || row.userId !== userId)
      throw new AppException("Not found", HttpStatus.NOT_FOUND, "EXTERNAL_NOT_FOUND")
    return row
  }

  async update(userId: string, id: string, dto: UpdateExternalApplicationDto) {
    await this.own(userId, id)
    return this.prisma.externalApplication.update({
      where: { id },
      data: {
        ...(dto.company !== undefined ? { company: dto.company } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.url !== undefined ? { url: dto.url || null } : {}),
        ...(dto.location !== undefined ? { location: dto.location || null } : {}),
        ...(dto.stage !== undefined ? { stage: dto.stage } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
        ...(dto.appliedAt !== undefined
          ? { appliedAt: dto.appliedAt ? new Date(dto.appliedAt) : null }
          : {}),
      },
    })
  }

  async remove(userId: string, id: string) {
    await this.own(userId, id)
    await this.prisma.externalApplication.delete({ where: { id } })
    return { id, deleted: true }
  }
}
