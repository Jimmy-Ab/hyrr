import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dtos/create-job.dto';
import { UpdateJobDto } from './dtos/update-job.dto';
import { CacheService } from '../cache/cache.service';
import { AccessService, Actor } from '../core/access/access.service';
import { NotificationsService } from '../notifications/notifications.service';

const JOB_COLORS = ['purple', 'blue', 'green', 'orange'] as const;
const PUBLIC_JOBS_CACHE_KEY = 'jobs:public';

@Injectable()
export class JobsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private access: AccessService,
    private notifications: NotificationsService,
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

    let companyId = user?.companyId;
    if (!companyId) {
      const company = await this.prisma.company.create({
        data: {
          name: user?.name ? `${user.name}'s Company` : 'Hyrr Hiring Co',
          logo: user?.name ? user.name.charAt(0).toUpperCase() : 'H',
          country: 'United States',
        },
      });
      companyId = company.id;
      if (user) {
        await this.prisma.user.update({
          where: { id: recruiterId },
          data: { companyId: company.id },
        });
      }
    }

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
        companyId,
        recruiterId,
        categoryId: dto.categoryId,
      },
      include: { company: true, category: true },
    });

    // Invalidate cached public listings
    await this.cache.delByPattern('jobs:public*');
    await this.notifyMatchingAlerts(job);
    return job;
  }

  private async notifyMatchingAlerts(job: any) {
    const alerts = await (this.prisma as any).jobAlert.findMany({ where: { active: true } });
    const searchable = `${job.title} ${job.location} ${job.type} ${(job.skills || []).join(' ')}`.toLowerCase();
    await Promise.all(alerts.filter((alert: any) => {
      const keywordMatch = !alert.keywords.length || alert.keywords.some((keyword: string) => searchable.includes(keyword.toLowerCase()));
      const locationMatch = !alert.locations.length || alert.locations.some((location: string) => job.location.toLowerCase().includes(location.toLowerCase()));
      const typeMatch = !alert.jobTypes.length || alert.jobTypes.includes(job.type);
      return keywordMatch && locationMatch && typeMatch && (!alert.remoteOnly || job.remote);
    }).map((alert: any) => this.notifications.createNotification(alert.userId, `New job alert match: ${job.title} at ${job.company?.name || 'a company'}`)));
  }

  // ─── Recruiter: update / close a job ─────────────────────────────
  async updateJob(jobId: string, dto: UpdateJobDto, actor: Actor) {
    await this.access.jobForManagement(actor, jobId);
    const job = await this.prisma.job.update({
      where: { id: jobId },
      data: dto as any,
      include: { company: true, category: true },
    });
    await this.cache.delByPattern('jobs:public*');
    return job;
  }

  // ─── Recruiter: delete a job ──────────────────────────────────────
  async deleteJob(jobId: string, actor: Actor) {
    await this.access.jobForManagement(actor, jobId);
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

  // ─── Recruiter: hiring funnel analytics ──────────────────────────
  async getAnalytics(recruiterId: string) {
    const jobs = await this.prisma.job.findMany({
      where: { recruiterId },
      include: { _count: { select: { applications: true } } },
    });

    const applications = await this.prisma.application.findMany({
      where: { job: { recruiterId } },
      select: { status: true, appliedAt: true, aiScore: true },
    });

    const total = applications.length;
    const pipeline = {
      Applied:      applications.filter(a => a.status === 'APPLIED').length,
      InProcess:    applications.filter(a => a.status === 'IN_PROCESS').length,
      Interviewing: applications.filter(a => a.status === 'INTERVIEWING').length,
      Offer:        applications.filter(a => a.status === 'OFFER').length,
      Archived:     applications.filter(a => a.status === 'ARCHIVED').length,
    };

    const offerRate = total > 0 ? ((pipeline.Offer / total) * 100).toFixed(1) : '0.0';
    const avgAiScore =
      applications.length > 0
        ? Math.round(applications.reduce((acc, a) => acc + (a.aiScore || 0), 0) / applications.length)
        : 0;

    // Monthly breakdown (last 7 months)
    const monthly: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleString('default', { month: 'short' });
      monthly[key] = 0;
    }
    applications.forEach(a => {
      const key = new Date(a.appliedAt).toLocaleString('default', { month: 'short' });
      if (key in monthly) monthly[key]++;
    });

    return {
      totalJobs: jobs.length,
      totalApplications: total,
      pipeline,
      offerConversionRate: offerRate,
      avgAiMatchScore: avgAiScore,
      monthlyApplications: Object.entries(monthly).map(([month, count]) => ({ month, applications: count })),
    };
  }
}
