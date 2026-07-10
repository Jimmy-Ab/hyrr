import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiFactory } from './ai.factory';
import { GeminiAdapter } from './adapters/gemini.adapter';

const DEFAULT_SYSTEM_PROMPT =
  'You are an expert AI recruiter. Analyze the candidate profile against the job requirements and rate the match strength from 0 to 100. Be precise and objective.';

const CHAT_SYSTEM_PROMPT_SEEKER =
  `You are Hyrr AI, a friendly and knowledgeable career assistant embedded in the Hyrr job platform.
Help job seekers with: resume tips, cover letter writing, interview preparation, career advice, salary negotiation, and understanding job descriptions.
Be concise, actionable, and encouraging. Use bullet points where helpful. Keep responses under 300 words unless more detail is explicitly requested.`;

const CHAT_SYSTEM_PROMPT_RECRUITER =
  `You are Hyrr AI, an intelligent recruiting assistant embedded in the Hyrr platform.
Help recruiters with: candidate evaluation, job description writing, interview question ideas, pipeline management tips, salary benchmarking, and talent acquisition strategies.
Be professional, data-driven, and practical. Use bullet points where helpful. Keep responses under 300 words unless more detail is explicitly requested.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private prisma: PrismaService,
    private factory: AiFactory,
    private gemini: GeminiAdapter,
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

  /**
   * AI Chat - conversational assistant for seekers and recruiters
   */
  async chat(
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    role: 'SEEKER' | 'RECRUITER',
  ): Promise<string> {
    try {
      const systemPrompt = role === 'SEEKER' ? CHAT_SYSTEM_PROMPT_SEEKER : CHAT_SYSTEM_PROMPT_RECRUITER;

      // Build messages array for the adapter
      const contextMessages = history.slice(-10); // keep last 10 messages for context
      const historyContext = contextMessages.length > 0
        ? '\n\nConversation history:\n' + contextMessages
            .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n')
        : '';

      const fullPrompt = message + historyContext;

      const result = await this.gemini.generateMatch(
        systemPrompt,
        0.7,
        { message: fullPrompt },
        {},
      );

      return result.summary || 'I\'m having trouble responding right now. Please try again.';
    } catch (err) {
      this.logger.warn('AI chat failed, using fallback:', err);
      return this.getFallbackResponse(message, role);
    }
  }

  private getFallbackResponse(message: string, role: 'SEEKER' | 'RECRUITER'): string {
    const lm = message.toLowerCase();
    if (role === 'SEEKER') {
      if (lm.includes('resume') || lm.includes('cv')) {
        return '**Resume Tips:**\n• Tailor each resume to the job description\n• Use action verbs and quantify achievements (e.g., "Increased sales by 30%")\n• Keep it to 1-2 pages\n• Add relevant keywords from the job posting\n• Include a strong summary at the top';
      }
      if (lm.includes('interview')) {
        return '**Interview Preparation:**\n• Research the company thoroughly\n• Practice the STAR method (Situation, Task, Action, Result)\n• Prepare 5-7 relevant questions to ask\n• Review your portfolio and past projects\n• Do a mock interview with a friend or record yourself';
      }
      if (lm.includes('salary') || lm.includes('pay')) {
        return '**Salary Negotiation:**\n• Research market rates on Glassdoor, Levels.fyi, or LinkedIn Salary\n• Always negotiate — 70% of employers expect it\n• State a specific number, not a range\n• Consider the full package: equity, benefits, remote flexibility\n• Never accept on the spot; ask for time to review';
      }
      return 'I\'m your Hyrr AI career assistant! Ask me about resumes, interviews, salary negotiation, cover letters, or career advice.';
    } else {
      if (lm.includes('job description') || lm.includes('jd')) {
        return '**Writing Effective Job Descriptions:**\n• Lead with impact, not just tasks\n• Be specific about required vs nice-to-have skills\n• Include salary range (increases applications by 30%)\n• Highlight company culture and benefits\n• Keep it under 700 words for best conversion';
      }
      if (lm.includes('interview') || lm.includes('question')) {
        return '**Interview Question Ideas:**\n• "Tell me about a time you handled a challenging project deadline"\n• "How do you prioritize when working on multiple projects?"\n• "Describe your ideal work environment"\n• "What\'s your approach to learning new technologies?"\n• "How do you handle disagreements with teammates?"';
      }
      return 'I\'m your Hyrr AI recruiting assistant! Ask me about candidate evaluation, job descriptions, interview questions, or talent acquisition strategies.';
    }
  }

  async getFeaturedJobsForSeeker(userId: string): Promise<any[]> {
    const profile = await this.prisma.seekerProfile.findUnique({
      where: { userId },
      include: { interests: true, experiences: true, educations: true },
    });
    if (!profile) return [];

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
      return this.prisma.job.findMany({
        where: { status: 'ACTIVE', featured: true },
        include: { company: true, category: true },
        take: 6,
      });
    }

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
