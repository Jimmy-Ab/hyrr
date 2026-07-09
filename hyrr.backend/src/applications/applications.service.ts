import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicationDto } from './dtos/create-application.dto';
import { UpdateApplicationDto } from './dtos/update-application.dto';

@Injectable()
export class ApplicationsService {
  constructor(private prisma: PrismaService) {}

  // ─── Seeker: apply to a job ───────────────────────────────────────
  async applyToJob(jobId: string, dto: CreateApplicationDto, userId?: string) {
    // Prevent duplicate applications by the same user
    if (userId) {
      const existing = await this.prisma.application.findFirst({
        where: { jobId, userId },
      });
      if (existing) return existing;
    }

    return this.prisma.application.create({
      data: {
        jobId,
        userId: userId || null,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        title: dto.title,
        location: dto.location,
        coverLetter: dto.coverLetter,
        status: 'APPLIED',
      },
      include: { job: { include: { company: true } } },
    });
  }

  // ─── Seeker: save a job without applying ─────────────────────────
  async saveJob(jobId: string, dto: CreateApplicationDto, userId: string) {
    const existing = await this.prisma.application.findFirst({ where: { jobId, userId } });
    if (existing) return existing;

    return this.prisma.application.create({
      data: {
        jobId,
        userId,
        name: dto.name,
        email: dto.email,
        title: dto.title,
        location: dto.location,
        status: 'SAVED',
        seekerBookmarked: true,
      },
      include: { job: { include: { company: true } } },
    });
  }

  // ─── Seeker: get my applications ─────────────────────────────────
  async getSeekerApplications(userId: string) {
    return this.prisma.application.findMany({
      where: { userId },
      include: {
        job: { include: { company: true, category: true } },
        calendarEvents: { orderBy: { startTime: 'asc' }, take: 1 },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  // ─── Seeker: tracker lookup by email ─────────────────────────────
  async getApplicationsByEmail(email: string) {
    return this.prisma.application.findMany({
      where: { email },
      include: {
        job: { include: { company: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  // ─── Recruiter: get all candidates for a job (Kanban board) ──────
  async getCandidatesForJob(jobId: string) {
    return this.prisma.application.findMany({
      where: { jobId },
      include: {
        user: { select: { id: true, avatar: true } },
        calendarEvents: { orderBy: { startTime: 'asc' }, take: 1 },
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  // ─── Recruiter: get all candidates across company jobs ────────────
  async getAllCompanyCandidates(companyId: string, search?: string) {
    const where: any = { job: { companyId } };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.application.findMany({
      where,
      include: { job: { include: { company: true } } },
      orderBy: { appliedAt: 'desc' },
    });
  }

  // ─── Shared: update application (move column, bookmark, offer) ────
  async updateApplication(id: string, dto: UpdateApplicationDto) {
    // Auto-set tags when moving pipeline stages
    let tag = dto.tag;
    if (!tag && dto.status) {
      if (dto.status === 'IN_PROCESS') tag = 'Interview';
      else if (dto.status === 'OFFER') tag = 'Offer Sent';
      else if (dto.status === 'ARCHIVED') tag = 'Not a fit';
      else if (dto.status === 'SAVED' || dto.status === 'APPLIED') tag = undefined;
    }

    return this.prisma.application.update({
      where: { id },
      data: { ...dto, tag, status: dto.status as any },
      include: { job: { include: { company: true } } },
    });
  }

  // ─── Recruiter: delete candidate ─────────────────────────────────
  async deleteApplication(id: string) {
    return this.prisma.application.delete({ where: { id } });
  }

  async getApplicationById(id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { job: { include: { company: true } }, messages: true, calendarEvents: true },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }
}
