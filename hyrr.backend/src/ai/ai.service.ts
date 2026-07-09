import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiFactory } from './ai.factory';

const DEFAULT_SYSTEM_PROMPT =
  'You are an expert AI recruiter. Analyze the candidate profile against the job requirements and rate the match strength from 0 to 100. Be precise and objective.';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private prisma: PrismaService,
    private factory: AiFactory,
  ) {}

  async scoreApplication(applicationId: string): Promise<{ score: number; summary: string }> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: { include: { category: true } },
        user: { include: { seekerProfile: { include: { experiences: true, educations: true } } } },
      },
    });

    if (!application) return { score: 0, summary: 'Application not found.' };

    const settings = await this.getSettings();
    const adapter = this.factory.getAdapter(settings.activeModel);

    const candidateData = {
      title: application.title,
      skills: application.user?.seekerProfile?.skills || [],
      bio: application.user?.seekerProfile?.bio || '',
      experiences: application.user?.seekerProfile?.experiences || [],
      educations: application.user?.seekerProfile?.educations || [],
      coverLetter: application.coverLetter || '',
    };

    const jobData = {
      title: application.job.title,
      description: application.job.description,
      requirements: application.job.requirements,
      skills: application.job.skills,
    };

    try {
      const result = await adapter.generateMatch(settings.systemPrompt, settings.temperature, candidateData, jobData);
      await this.prisma.application.update({
        where: { id: applicationId },
        data: { aiScore: result.score, aiSummary: result.summary },
      });
      return result;
    } catch (err) {
      this.logger.error(`AI scoring failed for application ${applicationId}:`, err);
      return { score: 0, summary: 'AI scoring temporarily unavailable.' };
    }
  }

  async getFeaturedJobsForSeeker(userId: string): Promise<any[]> {
    const profile = await this.prisma.seekerProfile.findUnique({
      where: { userId },
      include: { interests: true, experiences: true, educations: true },
    });
    if (!profile) return [];

    // Stage 1: SQL pre-screening (top 15 matching by category and remote pref)
    const interestIds = profile.interests.map((i) => i.id);
    const preFiltered = await this.prisma.job.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { categoryId: { in: interestIds } },
          { remote: profile.preferredType === 'Remote' },
        ],
      },
      include: { company: true, category: true },
      take: 15,
      orderBy: { createdAt: 'desc' },
    });

    if (preFiltered.length === 0) {
      // Fallback: return featured jobs
      return this.prisma.job.findMany({
        where: { status: 'ACTIVE', featured: true },
        include: { company: true, category: true },
        take: 6,
      });
    }

    // Stage 2: LangChain AI ranking
    const settings = await this.getSettings();
    const adapter = this.factory.getAdapter(settings.activeModel);

    const candidateData = {
      title: profile.title,
      skills: profile.skills,
      bio: profile.bio,
      experiences: profile.experiences,
      educations: profile.educations,
    };

    const scoredJobs = await Promise.allSettled(
      preFiltered.map(async (job) => {
        const result = await adapter.generateMatch(
          settings.systemPrompt,
          settings.temperature,
          candidateData,
          { title: job.title, description: job.description, requirements: job.requirements, skills: job.skills },
        );
        return { ...job, aiMatchScore: result.score, aiMatchSummary: result.summary };
      }),
    );

    return scoredJobs
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value)
      .sort((a, b) => b.aiMatchScore - a.aiMatchScore)
      .slice(0, 6);
  }

  async getSettings() {
    let settings = await this.prisma.systemSetting.findUnique({ where: { id: 'global-settings' } });
    if (!settings) {
      settings = await this.prisma.systemSetting.create({
        data: {
          id: 'global-settings',
          activeModel: 'gemini-1.5-pro',
          temperature: 0.2,
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
        },
      });
    }
    return settings;
  }

  async updateSettings(data: { activeModel?: string; temperature?: number; systemPrompt?: string }) {
    return this.prisma.systemSetting.upsert({
      where: { id: 'global-settings' },
      update: data,
      create: {
        id: 'global-settings',
        activeModel: data.activeModel || 'gemini-1.5-pro',
        temperature: data.temperature || 0.2,
        systemPrompt: data.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      },
    });
  }
}
