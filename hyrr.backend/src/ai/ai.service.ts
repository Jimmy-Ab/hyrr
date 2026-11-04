import { BadRequestException, Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common"
import { DocType, JobStatus } from "@prisma/client"
import { CacheService } from "../cache/cache.service"
import { MessagesGateway } from "../messages/messages.gateway"
import { PrismaService } from "../prisma/prisma.service"
import { CvTextService } from "../uploads/cv-text.service"
import { AiFactory } from "./ai.factory"
import {
  configuredProviders,
  defaultActiveModel,
  getAllowedModels,
  resolveActiveModel,
  ResolvedModel,
} from "./ai.models"
import { buildCandidatePrompt } from "./candidate-analysis"
import { MAX_CHAT_HISTORY } from "./dtos/ai.dto"
import { CandidateAnalysisResult, ChatTurn } from "./interfaces/llm-adapter.interface"

const DEFAULT_SYSTEM_PROMPT =
  "You are an expert AI recruiter. Analyze the candidate profile against the job requirements and rate the match strength from 0 to 100. Be precise and objective."

const CHAT_SYSTEM_PROMPTS = {
  SEEKER: `You are Hyrr AI, a friendly and knowledgeable career assistant embedded in the Hyrr job platform.
Help job seekers with: resume tips, cover letter writing, interview preparation, career advice, salary negotiation, and understanding job descriptions.
Be concise, actionable, and encouraging. Use bullet points where helpful. Keep responses under 300 words unless more detail is explicitly requested.`,
  RECRUITER: `You are Hyrr AI, an intelligent recruiting assistant embedded in the Hyrr platform.
Help recruiters with: candidate evaluation, job description writing, interview question ideas, pipeline management tips, salary benchmarking, and talent acquisition strategies.
Be professional, data-driven, and practical. Use bullet points where helpful. Keep responses under 300 words unless more detail is explicitly requested.`,
  ADMIN: `You are Hyrr AI, an operations assistant for administrators of the Hyrr recruiting platform.
Help with: platform moderation (flagged jobs, suspicious accounts), user and company support questions, AI model configuration, analytics interpretation, and policy or compliance wording.
Be precise and neutral. Never invent platform data you were not given. Use bullet points where helpful. Keep responses under 300 words unless more detail is explicitly requested.`,
} as const

export type ChatRole = keyof typeof CHAT_SYSTEM_PROMPTS

/** Result of scoring an application. `score: null` means scoring failed / was not possible. */
export type ScoreResult = { score: number | null; summary: string | null }

export type AiStatus = "PENDING" | "DONE" | "FAILED" | "DISABLED"

/** Persisted Application.aiAnalysis (contract: recruiter-facing only). */
export type StoredAnalysis = Omit<CandidateAnalysisResult, "score"> & {
  cvUsed: boolean
  cvNote?: string
}

const FEATURED_CACHE_TTL_SECONDS = 60 * 60
const FEATURED_FAILURE_TTL_SECONDS = 5 * 60
const FEATURED_RESULT_COUNT = 6
const FEATURED_CANDIDATE_POOL = 15

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name)

  constructor(
    private prisma: PrismaService,
    private factory: AiFactory,
    private cache: CacheService,
    @Optional() private gateway?: MessagesGateway,
    @Optional() private cvText?: CvTextService
  ) {}

  onModuleInit() {
    // Logged once at startup; the stored model may override this when its provider is keyed.
    this.prisma.systemSetting
      .findUnique({ where: { id: "global-settings" } })
      .catch(() => null)
      .then((settings) => {
        const resolved = resolveActiveModel(settings?.activeModel)
        if (resolved) this.logger.log(`AI enabled: ${resolved.model} (${resolved.provider})`)
        else this.logger.warn("AI disabled – no API key configured")
      })
      .catch(() => undefined)
  }

  /** Model used for every AI call right now, or null when no provider key is configured. */
  async resolveModel(): Promise<ResolvedModel | null> {
    const settings = await this.getSettings()
    return resolveActiveModel(settings.activeModel)
  }

  /**
   * Structured candidate analysis. Writes aiStatus PENDING → DONE / FAILED (or DISABLED) and
   * pushes `candidate_ai_status` / `candidate_ai_scored` to the job's company recruiters.
   * A failure never overwrites a previous good result. Never throws.
   */
  async scoreApplication(applicationId: string): Promise<ScoreResult> {
    let target: { companyId: string; recruiterId: string } | null = null
    try {
      const application = await this.prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          job: { include: { category: true } },
          user: { include: { seekerProfile: { include: { experiences: true, educations: true } } } },
          answers: { include: { question: true } },
        },
      })
      if (!application) return { score: null, summary: null }
      target = { companyId: application.job.companyId, recruiterId: application.job.recruiterId }

      const settings = await this.getSettings()
      const resolved = resolveActiveModel(settings.activeModel)
      if (!resolved) {
        await this.setStatus(applicationId, target, "DISABLED")
        return { score: null, summary: null }
      }
      await this.setStatus(applicationId, target, "PENDING")

      const cv = await this.loadCv(application)
      const profile = application.user?.seekerProfile
      const prompt = buildCandidatePrompt({
        job: {
          title: application.job.title,
          description: application.job.description,
          requirements: application.job.requirements,
          skills: application.job.skills,
          type: application.job.type,
          location: application.job.location,
          remote: application.job.remote,
          category: application.job.category?.name,
        },
        candidate: {
          applicationTitle: application.title,
          applicationLocation: application.location,
          profile: profile
            ? {
                title: profile.title,
                location: profile.location,
                yearsOfExperience: profile.yearsOfExperience,
                languages: profile.languages,
                skills: profile.skills,
                bio: profile.bio,
                experiences: profile.experiences,
                educations: profile.educations,
              }
            : null,
          coverLetter: application.coverLetter,
          screening: (application.answers || [])
            .sort((a, b) => (a.question?.position ?? 0) - (b.question?.position ?? 0))
            .map((a) => ({ question: a.question?.question || "", answer: a.answer })),
        },
        cvText: cv.text,
      })

      const adapter = this.factory.getAdapter(resolved.model)
      const result = await adapter.analyzeCandidate(
        resolved.model,
        settings.systemPrompt,
        settings.temperature,
        prompt
      )
      const { score, ...rest } = result
      const aiAnalysis: StoredAnalysis = {
        ...rest,
        cvUsed: !!cv.text,
        ...(cv.note ? { cvNote: cv.note } : {}),
      }
      const aiScoredAt = new Date()
      await this.prisma.application.update({
        where: { id: applicationId },
        data: {
          aiScore: score,
          aiSummary: result.summary,
          aiAnalysis: aiAnalysis as any,
          aiModel: resolved.model,
          aiScoredAt,
          aiStatus: "DONE",
          aiError: null,
        },
      })
      this.gateway?.emitAiScoreUpdate(
        target.companyId,
        {
          applicationId,
          aiScore: score,
          aiSummary: result.summary,
          aiAnalysis,
          aiModel: resolved.model,
          aiScoredAt: aiScoredAt.toISOString(),
          aiStatus: "DONE",
        },
        target.recruiterId
      )
      return { score, summary: result.summary }
    } catch (err) {
      this.logger.error(
        `AI scoring failed for application ${applicationId}: ${(err as Error)?.message || err}`
      )
      if (target) {
        await this.setStatus(applicationId, target, "FAILED", userSafeAiError(err)).catch((e) =>
          this.logger.warn(`Could not record AI failure for ${applicationId}: ${e?.message}`)
        )
      }
      return { score: null, summary: null }
    }
  }

  /** Writes aiStatus (+ aiError) without touching any previous result, then emits it. */
  private async setStatus(
    applicationId: string,
    target: { companyId: string; recruiterId: string },
    aiStatus: Exclude<AiStatus, "DONE">,
    aiError: string | null = null
  ) {
    await this.prisma.application.update({
      where: { id: applicationId },
      data: { aiStatus, aiError },
    })
    this.gateway?.emitAiStatus(
      target.companyId,
      { applicationId, aiStatus, ...(aiError ? { aiError } : {}) },
      target.recruiterId
    )
  }

  /** CV text from the application's resume, else the seeker's most recent active RESUME. */
  private async loadCv(application: { resumeUrl: string | null; userId: string | null }) {
    if (!this.cvText) return { text: null, note: "CV reading is unavailable" }
    let source = application.resumeUrl
    if (!source && application.userId) {
      const doc = await this.prisma.document.findFirst({
        where: { userId: application.userId, type: DocType.RESUME, active: true },
        orderBy: { createdAt: "desc" },
        select: { url: true },
      })
      source = doc?.url ?? null
    }
    if (!source) return { text: null, note: "No CV attached" }
    return this.cvText.extract(source)
  }

  /** Conversational assistant using the configured active model. Falls back to canned tips. */
  async chat(message: string, history: ChatTurn[], role: ChatRole): Promise<string> {
    const systemPrompt = CHAT_SYSTEM_PROMPTS[role] || CHAT_SYSTEM_PROMPTS.SEEKER
    try {
      const resolved = await this.resolveModel()
      if (!resolved) return this.getFallbackResponse(message, role)
      const adapter = this.factory.getAdapter(resolved.model)
      return await adapter.chat(
        resolved.model,
        systemPrompt,
        0.7,
        history.slice(-MAX_CHAT_HISTORY),
        message
      )
    } catch (err) {
      this.logger.warn(`AI chat failed, using fallback: ${(err as Error)?.message || err}`)
      return this.getFallbackResponse(message, role)
    }
  }

  private getFallbackResponse(message: string, role: ChatRole): string {
    const lm = message.toLowerCase()
    if (role === "SEEKER") {
      if (lm.includes("resume") || lm.includes("cv")) {
        return '**Resume Tips:**\n• Tailor each resume to the job description\n• Use action verbs and quantify achievements (e.g., "Increased sales by 30%")\n• Keep it to 1-2 pages\n• Add relevant keywords from the job posting\n• Include a strong summary at the top'
      }
      if (lm.includes("interview")) {
        return "**Interview Preparation:**\n• Research the company thoroughly\n• Practice the STAR method (Situation, Task, Action, Result)\n• Prepare 5-7 relevant questions to ask\n• Review your portfolio and past projects\n• Do a mock interview with a friend or record yourself"
      }
      if (lm.includes("salary") || lm.includes("pay")) {
        return "**Salary Negotiation:**\n• Research market rates on Glassdoor, Levels.fyi, or LinkedIn Salary\n• Always negotiate — 70% of employers expect it\n• State a specific number, not a range\n• Consider the full package: equity, benefits, remote flexibility\n• Never accept on the spot; ask for time to review"
      }
      return "I'm your Hyrr AI career assistant! Ask me about resumes, interviews, salary negotiation, cover letters, or career advice."
    }
    if (role === "ADMIN") {
      return "The AI assistant is temporarily unavailable. Check the AI settings (active model and API keys) and try again shortly."
    }
    if (lm.includes("job description") || lm.includes("jd")) {
      return "**Writing Effective Job Descriptions:**\n• Lead with impact, not just tasks\n• Be specific about required vs nice-to-have skills\n• Include salary range (increases applications by 30%)\n• Highlight company culture and benefits\n• Keep it under 700 words for best conversion"
    }
    if (lm.includes("interview") || lm.includes("question")) {
      return '**Interview Question Ideas:**\n• "Tell me about a time you handled a challenging project deadline"\n• "How do you prioritize when working on multiple projects?"\n• "Describe your ideal work environment"\n• "What\'s your approach to learning new technologies?"\n• "How do you handle disagreements with teammates?"'
    }
    return "I'm your Hyrr AI recruiting assistant! Ask me about candidate evaluation, job descriptions, interview questions, or talent acquisition strategies."
  }

  /**
   * AI-ranked job suggestions for a seeker. Cached per user (~1h) and limited to a few LLM calls:
   * jobs are pre-ranked by skill overlap and only the top N are sent to the model.
   */
  async getFeaturedJobsForSeeker(userId: string): Promise<any[]> {
    const cacheKey = `ai:featured-jobs:${userId}`
    const cached = await this.cache.get<any[]>(cacheKey)
    if (cached) return cached

    const profile = await this.prisma.seekerProfile.findUnique({
      where: { userId },
      include: { interests: true, experiences: true, educations: true },
    })
    if (!profile) return []

    const interestIds = profile.interests.map((i) => i.id)
    const preFiltered = await this.prisma.job.findMany({
      where: {
        status: JobStatus.ACTIVE,
        OR: [{ categoryId: { in: interestIds } }, { remote: profile.preferredType === "Remote" }],
      },
      include: { company: true, category: true },
      take: FEATURED_CANDIDATE_POOL,
      orderBy: { createdAt: "desc" },
    })

    if (preFiltered.length === 0) {
      const featured = await this.prisma.job.findMany({
        where: { status: JobStatus.ACTIVE, featured: true },
        include: { company: true, category: true },
        take: FEATURED_RESULT_COUNT,
      })
      await this.cache.set(cacheKey, featured, FEATURED_CACHE_TTL_SECONDS)
      return featured
    }

    // Cheap local pre-rank by skill overlap so only the most promising jobs hit the LLM.
    const seekerSkills = new Set(profile.skills.map((s) => s.toLowerCase()))
    const ranked = preFiltered
      .map((job) => ({
        job,
        overlap: job.skills.filter((s) => seekerSkills.has(s.toLowerCase())).length,
      }))
      .sort((a, b) => b.overlap - a.overlap)
      .map((r) => r.job)

    const maxCalls = Math.max(0, Number(process.env.AI_FEATURED_MAX_CALLS || 5))
    const toScore = ranked.slice(0, Math.min(maxCalls, FEATURED_RESULT_COUNT))
    const unscored = ranked.slice(toScore.length)

    const settings = await this.getSettings()
    const resolved = resolveActiveModel(settings.activeModel)
    if (!resolved) {
      // AI disabled: skill-overlap ranking only.
      const result = ranked
        .slice(0, FEATURED_RESULT_COUNT)
        .map((job) => ({ ...job, aiMatchScore: null, aiMatchSummary: null }))
      await this.cache.set(cacheKey, result, FEATURED_FAILURE_TTL_SECONDS)
      return result
    }
    const adapter = this.factory.getAdapter(resolved.model)
    const candidateData = {
      title: profile.title,
      skills: profile.skills,
      bio: profile.bio,
      experiences: profile.experiences,
      educations: profile.educations,
    }

    const scored = await Promise.all(
      toScore.map(async (job) => {
        try {
          const result = await adapter.generateMatch(
            resolved.model,
            settings.systemPrompt,
            settings.temperature,
            candidateData,
            {
              title: job.title,
              description: job.description,
              requirements: job.requirements,
              skills: job.skills,
            }
          )
          return { ...job, aiMatchScore: result.score, aiMatchSummary: result.summary }
        } catch {
          return { ...job, aiMatchScore: null, aiMatchSummary: null }
        }
      })
    )

    const anyScored = scored.some((job) => job.aiMatchScore !== null)
    const result = [
      ...scored.sort((a, b) => (b.aiMatchScore ?? -1) - (a.aiMatchScore ?? -1)),
      ...unscored.map((job) => ({ ...job, aiMatchScore: null, aiMatchSummary: null })),
    ].slice(0, FEATURED_RESULT_COUNT)

    await this.cache.set(
      cacheKey,
      result,
      anyScored ? FEATURED_CACHE_TTL_SECONDS : FEATURED_FAILURE_TTL_SECONDS
    )
    return result
  }

  async getSettings() {
    const allowed = getAllowedModels()
    let settings = await this.prisma.systemSetting.findUnique({ where: { id: "global-settings" } })
    if (!settings) {
      settings = await this.prisma.systemSetting.create({
        data: {
          id: "global-settings",
          activeModel: defaultActiveModel(),
          temperature: 0.2,
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
        },
      })
    } else if (!allowed.includes(settings.activeModel)) {
      // Retired/unknown model ids (e.g. gemini-1.5-*) fall back to the configured default.
      settings = await this.prisma.systemSetting.update({
        where: { id: "global-settings" },
        data: { activeModel: defaultActiveModel() },
      })
    }
    return settings
  }

  /** GET /ai/settings: stored settings plus what is actually used at runtime. */
  async getSettingsView() {
    const settings = await this.getSettings()
    const resolved = resolveActiveModel(settings.activeModel)
    return {
      ...settings,
      availableModels: getAllowedModels(),
      resolvedModel: resolved?.model ?? null,
      provider: resolved?.provider ?? null,
      configuredProviders: configuredProviders(),
    }
  }

  async updateSettings(data: {
    activeModel?: string
    temperature?: number
    systemPrompt?: string
  }) {
    const allowed = getAllowedModels()
    if (data.activeModel !== undefined && !allowed.includes(data.activeModel)) {
      throw new BadRequestException(`activeModel must be one of: ${allowed.join(", ")}`)
    }
    const update: { activeModel?: string; temperature?: number; systemPrompt?: string } = {}
    if (data.activeModel !== undefined) update.activeModel = data.activeModel
    if (data.temperature !== undefined) update.temperature = data.temperature
    if (data.systemPrompt !== undefined) update.systemPrompt = data.systemPrompt

    // Model/prompt changes invalidate cached recommendations.
    await this.cache.delByPattern("ai:featured-jobs:*")
    return this.prisma.systemSetting.upsert({
      where: { id: "global-settings" },
      update,
      create: {
        id: "global-settings",
        activeModel: update.activeModel || defaultActiveModel(),
        temperature: update.temperature ?? 0.2,
        systemPrompt: update.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      },
    })
  }
}

/** Short, recruiter-safe description of an AI failure (details stay in the server log). */
export function userSafeAiError(err: any): string {
  const status = Number(err?.status ?? err?.response?.status)
  const name = String(err?.name || "")
  const message = String(err?.message || "")
  if (name === "AbortError" || name === "TimeoutError" || /timed? ?out|aborted/i.test(message))
    return "The AI model took too long to respond. Please try again."
  if (status === 401 || status === 403 || /api key|unauthori[sz]ed|authentication/i.test(message))
    return "The AI provider rejected the configured API key."
  // OpenAI reports an empty balance as a 429 too; it won't fix itself by retrying.
  if (
    /insufficient_quota|credit_balance|no credits|exceeded your current quota|billing/i.test(
      `${message} ${err?.code ?? ""} ${err?.error?.code ?? ""} ${err?.error?.type ?? ""}`
    )
  )
    return "The AI provider account has no credits left. Add billing credits to the provider account, then retry."
  if (status === 429 || /rate limit|quota/i.test(message))
    return "The AI provider is rate limiting requests. Please try again shortly."
  if (status === 404 || /model.*(not found|does not exist)/i.test(message))
    return "The configured AI model is not available."
  if (/json|schema|score|summary|parse/i.test(message))
    return "The AI returned an unreadable analysis. Please try again."
  return "AI analysis failed. Please try again."
}
