import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { DocType } from "@prisma/client"
import { PrismaService } from "../prisma/prisma.service"
import { UploadsService } from "../uploads/uploads.service"
import { CreateDocumentDto } from "./dtos/create-document.dto"

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private uploads: UploadsService
  ) {}

  private present<T extends { url: string }>(document: T): T {
    return { ...document, url: this.uploads.formatFileUrl(this.uploads.getFilename(document.url)) }
  }

  async getMyDocuments(userId: string) {
    const documents = await this.prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
    return documents.map((document) => this.present(document))
  }

  async createDocument(userId: string, data: CreateDocumentDto) {
    // Only files this user uploaded through /api/uploads can be attached (400 otherwise).
    const filename = this.uploads.assertOwnedUpload(data.url, userId)
    if (!(await this.uploads.fileExists(filename))) {
      throw new BadRequestException("The uploaded file was not found")
    }
    const docType = Object.values(DocType).includes(data.type) ? data.type : DocType.OTHER

    const document = await this.prisma.$transaction(async (tx) => {
      // A new resume becomes the active one.
      if (docType === DocType.RESUME) {
        await tx.document.updateMany({
          where: { userId, type: DocType.RESUME, active: true },
          data: { active: false },
        })
      }
      return tx.document.create({
        data: {
          userId,
          name: data.name,
          type: docType,
          size: data.size,
          url: filename,
          active: true,
        },
      })
    })
    return this.present(document)
  }

  async toggleActive(id: string, userId: string) {
    const document = await this.prisma.document.findUnique({ where: { id } })
    if (!document || document.userId !== userId) throw new NotFoundException("Document not found")

    const updated = await this.prisma.$transaction(async (tx) => {
      if (document.type === DocType.RESUME && !document.active) {
        await tx.document.updateMany({
          where: { userId, type: DocType.RESUME, active: true },
          data: { active: false },
        })
      }
      return tx.document.update({ where: { id }, data: { active: !document.active } })
    })
    return this.present(updated)
  }

  async deleteDocument(id: string, userId: string) {
    const document = await this.prisma.document.findUnique({ where: { id } })
    if (!document || document.userId !== userId) throw new NotFoundException("Document not found")

    const deleted = await this.prisma.document.delete({ where: { id } })
    const filename = this.uploads.getFilename(document.url)
    // Keep the file if another record (e.g. an application resume) still references it.
    const [otherDocs, applications] = await Promise.all([
      this.prisma.document.count({ where: { url: filename, id: { not: id } } }),
      this.prisma.application.count({ where: { resumeUrl: { contains: filename } } }),
    ])
    if (!otherDocs && !applications) await this.uploads.deleteFile(filename)
    return deleted
  }
}
