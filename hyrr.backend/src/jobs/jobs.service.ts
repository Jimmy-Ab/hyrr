import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dtos/create-job.dto';
import { UpdateJobDto } from './dtos/update-job.dto';
import { CacheService } from '../cache/cache.service';

const JOB_COLORS = ['purple', 'blue', 'green', 'orange'] as const;
const PUBLIC_JOBS_CACHE_KEY = 'jobs:public';

@Injectable()
export class JobsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

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

    const job = await this.prisma.job.create({
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

    // Invalidate cached public listings
    await this.cache.delByPattern('jobs:public*');
    return job;
  }

  // ─── Recruiter: update / close a job ─────────────────────────────
  async updateJob(jobId: string, dto: UpdateJobDto) {
    const job = await this.prisma.job.update({
      where: { id: jobId },
      data: dto as any,
      include: { company: true, category: true },
    });
    await this.cache.delByPattern('jobs:public*');
    return job;
  }

  // ─── Recruiter: delete a job ──────────────────────────────────────
  async deleteJob(jobId: string) {
    const result = await this.prisma.job.delete({ where: { id: jobId } });
    await this.cache.delByPattern('jobs:public*');
    return result;
  }

  // ─── Public: full-text search + filter (Redis cached) ────────────
  async searchPublicJobs(query?: string, type?: string, categorySlug?: string, remote?: boolean) {
    const cacheKey = `${PUBLIC_JOBS_CACHE_KEY}:${query || ''}:${type || ''}:${categorySlug || ''}:${remote ?? ''}`;

    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const where: any = { status: 'ACTIVE' };
    if (type && type !== 'All') where.type = type;
    if (remote) where.remote = true;
    if (categorySlug) {
      where.category = { slug: categorySlug };
    }

    if (query && query.trim()) {
      const searchString = query.trim().split(/\s+/).join(' & ');
      where.OR = [
        { title: { search: searchString } },
        { description: { search: searchString } },
      ];
    }

    const results = await this.prisma.job.findMany({
      where,
      include: { company: true, category: true },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });

    await this.cache.set(cacheKey, results, 120); // 2-minute TTL
    return results;
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
