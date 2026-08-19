import { Injectable, NotFoundException } from "@nestjs/common"
import { DocType } from "@prisma/client"
import { PrismaService } from "../prisma/prisma.service"
import { UploadsService } from "../uploads/uploads.service"

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private uploads: UploadsService
  ) {}

  async getMyDocuments(userId: string) {
    const documents = await this.prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })
    return documents.map((document) => ({
      ...document,
      url: this.uploads.formatFileUrl(this.uploads.getFilename(document.url)),
    }))
  }

  async createDocument(
    userId: string,
    data: { name: string; type: string; size: string; url: string }
  ) {
    // Normalize type to uppercase to match Prisma DocType enum
    const normalizedType = data.type?.toUpperCase()
    const docType = Object.values(DocType).includes(normalizedType as DocType)
      ? (normalizedType as DocType)
      : DocType.OTHER

    // If uploading a new active resume, deactivate existing ones first
    if (docType === DocType.RESUME) {
      await this.prisma.document.updateMany({
        where: { userId, type: DocType.RESUME, active: true },
        data: { active: false },
      })
    }

    const document = await this.prisma.document.create({
      data: {
        userId,
        name: data.name,
        type: docType,
        size: data.size,
        url: this.uploads.getFilename(data.url),
        active: true,
      },
    })
    return { ...document, url: this.uploads.formatFileUrl(this.uploads.getFilename(document.url)) }
  }

  async toggleActive(id: string, userId: string) {
    const document = await this.prisma.document.findUnique({ where: { id } })
    if (!document || document.userId !== userId) throw new NotFoundException("Document not found")

    if (document.type === DocType.RESUME && !document.active) {
      // Deactivate others
      await this.prisma.document.updateMany({
        where: { userId, type: "RESUME", active: true },
        data: { active: false },
      })
    }

    return this.prisma.document.update({
      where: { id },
      data: { active: !document.active },
    })
  }

  async deleteDocument(id: string, userId: string) {
    const document = await this.prisma.document.findUnique({ where: { id } })
    if (!document || document.userId !== userId) throw new NotFoundException("Document not found")

    return this.prisma.document.delete({ where: { id } })
  }
}
