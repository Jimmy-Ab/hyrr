import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dtos/create-job.dto';
import { UpdateJobDto } from './dtos/update-job.dto';

const JOB_COLORS = ['purple', 'blue', 'green', 'orange'] as const;

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  // ─── Recruiter: list their own company jobs ───────────────────────
  async getRecruiterJobs(recruiterId: string) {
    return this.prisma.job.findMany({
      where: { recruiterId },
      include: { company: true, category: true, _count: { select: { applications: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Recruiter: create a job ──────────────────────────────────────
  async createJob(recruiterId: string, dto: CreateJobDto) {
    const user = await this.prisma.user.findUnique({ where: { id: recruiterId } });
    const count = await this.prisma.job.count({ where: { recruiterId } });
    const color = JOB_COLORS[count % JOB_COLORS.length];

    return this.prisma.job.create({
      data: {
        title: dto.title,
        location: dto.location,
        type: dto.type,
        salary: dto.salary,
        description: dto.description,
        requirements: dto.requirements,
        skills: dto.skills,
        benefits: dto.benefits ?? [],
        featured: dto.featured ?? false,
        remote: dto.remote ?? false,
        color,
        companyId: user!.companyId!,
        recruiterId,
        categoryId: dto.categoryId,
      },
      include: { company: true, category: true },
    });
  }

  // ─── Recruiter: update / close a job ─────────────────────────────
  async updateJob(jobId: string, dto: UpdateJobDto) {
    return this.prisma.job.update({
      where: { id: jobId },
      data: dto as any,
      include: { company: true, category: true },
    });
  }

  // ─── Recruiter: delete a job ──────────────────────────────────────
  async deleteJob(jobId: string) {
    return this.prisma.job.delete({ where: { id: jobId } });
  }

  // ─── Public: full-text search + filter for Discover page ─────────
  async searchPublicJobs(query?: string, type?: string, categorySlug?: string, remote?: boolean) {
    const where: any = { status: 'ACTIVE' };
    if (type && type !== 'All') where.type = type;
    if (remote) where.remote = true;
    if (categorySlug) {
      where.category = { slug: categorySlug };
    }

    if (query && query.trim()) {
      // Postgres full-text search across title and description
      const searchString = query.trim().split(/\s+/).join(' & ');
      where.OR = [
        { title: { search: searchString } },
        { description: { search: searchString } },
      ];
    }

    return this.prisma.job.findMany({
      where,
      include: { company: true, category: true },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });
  }

  // ─── Public: get single job detail ───────────────────────────────
  async getJobById(id: string) {
    return this.prisma.job.findUnique({
      where: { id },
      include: { company: true, category: true, postedBy: { select: { name: true, avatar: true } } },
    });
  }

  // ─── Shared: get all categories ──────────────────────────────────
  async getCategories() {
    return this.prisma.jobCategory.findMany({ orderBy: { name: 'asc' } });
  }
}
