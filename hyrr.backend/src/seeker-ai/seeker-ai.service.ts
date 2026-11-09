import { HttpStatus, Injectable, Logger } from "@nestjs/common"
import { JobStatus } from "@prisma/client"
import { AiService } from "../ai/ai.service"
import { PricingService, type MomentumConfig } from "../billing/pricing.service"
import { WalletService } from "../billing/wallet.service"
import { AppException } from "../core/exceptions/app-exception"
import { PrismaService } from "../prisma/prisma.service"
import { TAILOR_SYSTEM_PROMPT, tailorSchema, type TailorResult } from "./schemas"

type CostKey = "resumeTailorCost" | "mockInterviewCost" | "negotiationAdviceCost"
const CV_MAX = 12_000

/** Seeker AI tools (CV tailoring, practice interviews, negotiation advice), paid in credits. */
@Injectable()
export class SeekerAiService {
  private readonly logger = new Logger(SeekerAiService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly wallet: WalletService,
    private readonly pricing: PricingService
  ) {}

  /**
   * Charges the tool's price, runs it, and refunds automatically when the AI fails.
   * Without an AI provider nothing is charged (503 AI_DISABLED).
   */
  async chargedRun<T>(
    userId: string,
    costKey: CostKey,
    referenceId: string,
    note: string,
    run: () => Promise<T>
  ) {
    if (!(await this.ai.resolveModel()))
      throw new AppException(
        "AI isn't available right now, so nothing was charged. Please try again later.",
        HttpStatus.SERVICE_UNAVAILABLE,
        "AI_DISABLED"
      )
    const cost = (await this.pricing.getConfig())[costKey as keyof MomentumConfig] as number
    if (cost > 0)
      await this.wallet.debit({
        userId,
        amount: cost,
        type: "AI_SEEKER_TOOL",
        referenceId,
        actorId: userId,
        note,
      })
    try {
      return { value: await run(), charged: cost }
    } catch (err) {
      if (cost > 0)
        await this.wallet
          .credit({
            userId,
            amount: cost,
            type: "REFUND",
            referenceId,
            actorId: userId,
            note: `Refund: ${note} (AI failed)`,
          })
          .catch((e) =>
            this.logger.error(`Refund failed for ${userId}/${referenceId}: ${e?.message}`)
          )
      throw err
    }
  }

  /** Candidate text for prompts: active CV (if readable) plus the structured profile. */
  async candidateText(userId: string) {
    const [profile, cv] = await Promise.all([
      this.prisma.seekerProfile.findUnique({
        where: { userId },
        select: {
          title: true,
          location: true,
          bio: true,
          skills: true,
          experiences: { select: { role: true, company: true, duration: true, desc: true } },
          educations: { select: { degree: true, school: true } },
        },
      }),
      this.ai.seekerCvText(userId).catch(() => ({ text: null })),
    ])
    const lines = profile
      ? [
          `Title: ${profile.title || "-"}`,
          `Location: ${profile.location || "-"}`,
          `Skills: ${profile.skills.join(", ") || "-"}`,
          profile.bio ? `About: ${profile.bio}` : "",
          ...profile.experiences.map(
            (e) =>
              `Experience: ${e.role} at ${e.company} (${e.duration})${e.desc ? ` — ${e.desc}` : ""}`
          ),
          ...profile.educations.map((e) => `Education: ${e.degree}, ${e.school}`),
        ].filter(Boolean)
      : []
    const cvText = (cv as { text: string | null }).text?.slice(0, CV_MAX) ?? null
    const thin =
      !cvText && (!profile || (profile.skills.length === 0 && profile.experiences.length === 0))
    return {
      text: [cvText ? `CV:\n${cvText}` : "", lines.length ? `Profile:\n${lines.join("\n")}` : ""]
        .filter(Boolean)
        .join("\n\n"),
      cvUsed: !!cvText,
      thin,
    }
  }

  async getTailoring(userId: string, jobId: string) {
    const row = await this.prisma.resumeTailoring.findUnique({
      where: { userId_jobId: { userId, jobId } },
    })
    return row
      ? { jobId, result: row.result as TailorResult, cvUsed: row.cvUsed, createdAt: row.updatedAt }
      : null
  }

  /** Compares the CV/profile with a Hyrr job. Saved per job: reopening is free, `rerun` charges again. */
  async tailor(userId: string, jobId: string, rerun = false) {
    if (!rerun) {
      const saved = await this.getTailoring(userId, jobId)
      if (saved) return { ...saved, charged: 0, cached: true }
    }
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        status: true,
        description: true,
        requirements: true,
        skills: true,
        location: true,
        company: { select: { name: true } },
      },
    })
    if (!job || job.status === JobStatus.DRAFT)
      throw new AppException("Job not found", HttpStatus.NOT_FOUND, "JOB_NOT_FOUND")
    const candidate = await this.candidateText(userId)
    if (candidate.thin)
      throw new AppException(
        "Upload your CV in Documents or add skills and experience to your profile first, so there's something to tailor.",
        HttpStatus.BAD_REQUEST,
        "PROFILE_TOO_THIN"
      )
    const prompt = [
      `JOB: ${job.title} at ${job.company?.name ?? "the company"} (${job.location})`,
      `Requirements: ${job.requirements.join("; ") || "-"}`,
      `Skills: ${job.skills.join(", ") || "-"}`,
      `Description:\n${job.description.replace(/<[^>]+>/g, " ").slice(0, 6000)}`,
      "",
      `CANDIDATE:\n${candidate.text}`,
    ].join("\n")
    const { value, charged } = await this.chargedRun(
      userId,
      "resumeTailorCost",
      job.id,
      `CV tailoring: ${job.title}`,
      () =>
        this.ai.structured<TailorResult>(TAILOR_SYSTEM_PROMPT, prompt, tailorSchema, "cv_tailoring")
    )
    const saved = await this.prisma.resumeTailoring.upsert({
      where: { userId_jobId: { userId, jobId } },
      create: {
        userId,
        jobId,
        result: value.result as any,
        model: value.model,
        cvUsed: candidate.cvUsed,
      },
      update: { result: value.result as any, model: value.model, cvUsed: candidate.cvUsed },
    })
    return {
      jobId,
      result: value.result,
      cvUsed: candidate.cvUsed,
      createdAt: saved.updatedAt,
      charged,
      cached: false,
    }
  }
}
