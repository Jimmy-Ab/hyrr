import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async getMyDocuments(userId: string) {
    return this.prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDocument(userId: string, data: { name: string; type: string; size: string; url: string }) {
    // If uploading a new active resume, deactivate existing ones first
    if (data.type === 'RESUME') {
      await this.prisma.document.updateMany({
        where: { userId, type: 'RESUME', active: true },
        data: { active: false },
      });
    }

    return this.prisma.document.create({
      data: {
        userId,
        name: data.name,
        type: data.type as any,
        size: data.size,
        url: data.url,
        active: true,
      },
    });
  }

  async toggleActive(id: string, userId: string) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document || document.userId !== userId) throw new NotFoundException('Document not found');

    if (document.type === 'RESUME' && !document.active) {
      // Deactivate others
      await this.prisma.document.updateMany({
        where: { userId, type: 'RESUME', active: true },
        data: { active: false },
      });
    }

    return this.prisma.document.update({
      where: { id },
      data: { active: !document.active },
    });
  }

  async deleteDocument(id: string, userId: string) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document || document.userId !== userId) throw new NotFoundException('Document not found');

    return this.prisma.document.delete({ where: { id } });
  }
}
