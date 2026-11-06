import { HttpStatus, Injectable } from "@nestjs/common"
import { JobStatus, Prisma } from "@prisma/client"
import { AccessService, Actor } from "../core/access/access.service"
import { AppException, NotFoundAppException } from "../core/exceptions/app-exception"
import { PrismaService } from "../prisma/prisma.service"
import { ScreeningQuestionInputDto } from "./dtos/questions.dto"

export const QUESTION_SELECT = {
  id: true,
  question: true,
  required: true,
  position: true,
} satisfies Prisma.ScreeningQuestionSelect

export type AnswerInput = { questionId: string; answer: string }

type Db = Pick<Prisma.TransactionClient, "screeningQuestion" | "screeningAnswer">

const isRecruiterRole = (role?: string) => role === "RECRUITER" || role === "ADMIN"

/** R1: per-job screening questions and the answers stored with an application. */
@Injectable()
export class ScreeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService
  ) {}

  private listFor(db: Db, jobId: string) {
    return db.screeningQuestion.findMany({
      where: { jobId },
      select: QUESTION_SELECT,
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    })
  }

  /** Public for ACTIVE jobs; recruiters with view access see the questions of any of their jobs. */
  async list(jobId: string, actor?: Actor | null) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId }, select: { status: true } })
    if (!job) throw new NotFoundAppException("Job not found", "JOB_NOT_FOUND")
    if (job.status !== JobStatus.ACTIVE) {
      if (!actor || !isRecruiterRole(actor.role))
        throw new NotFoundAppException("Job not found", "JOB_NOT_FOUND")
      await this.access.jobForView(actor, jobId)
    }
    return this.listFor(this.prisma, jobId)
  }

  /**
   * Replaces the job's question set: known ids are updated in place (their answers survive),
   * questions missing from the payload are deleted (answers cascade), the rest are created.
   * Unknown or repeated ids are treated as new questions. Order = array order.
   */
  async replace(jobId: string, actor: Actor, questions: ScreeningQuestionInputDto[]) {
    await this.access.jobForManagement(actor, jobId)
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.screeningQuestion.findMany({
        where: { jobId },
        select: { id: true },
      })
      const existingIds = new Set(existing.map((q) => q.id))
      const kept = new Set<string>()
      const plan = questions.map((q, position) => {
        const keep = !!q.id && existingIds.has(q.id) && !kept.has(q.id)
        if (keep) kept.add(q.id!)
        return { ...q, id: keep ? q.id : undefined, position }
      })
      const removed = [...existingIds].filter((id) => !kept.has(id))
      if (removed.length) await tx.screeningQuestion.deleteMany({ where: { id: { in: removed } } })
      for (const q of plan) {
        const data = { question: q.question, required: q.required, position: q.position }
        if (q.id) await tx.screeningQuestion.update({ where: { id: q.id }, data })
        else await tx.screeningQuestion.create({ data: { ...data, jobId } })
      }
      return this.listFor(tx, jobId)
    })
  }

  /**
   * Validates apply-time answers against the job's questions: every required question needs a
   * non-blank answer (400 SCREENING_ANSWERS_REQUIRED, details = missing ids). Answers to unknown
   * questions are dropped. Returns the answers to store.
   */
  async validateAnswers(jobId: string, answers: AnswerInput[] = []): Promise<AnswerInput[]> {
    const questions = await this.prisma.screeningQuestion.findMany({
      where: { jobId },
      select: { id: true, required: true },
    })
    if (!questions.length) return []
    const byId = new Map<string, string>()
    for (const a of answers) {
      const text = (a.answer ?? "").trim()
      if (text && !byId.has(a.questionId)) byId.set(a.questionId, text)
    }
    const missing = questions.filter((q) => q.required && !byId.has(q.id)).map((q) => q.id)
    if (missing.length)
      throw new AppException(
        "Please answer all required screening questions",
        HttpStatus.BAD_REQUEST,
        "SCREENING_ANSWERS_REQUIRED",
        missing
      )
    return questions
      .filter((q) => byId.has(q.id))
      .map((q) => ({ questionId: q.id, answer: byId.get(q.id)! }))
  }

  /** Stores validated answers (inside the apply transaction). */
  async saveAnswers(db: Db, applicationId: string, answers: AnswerInput[]) {
    if (!answers.length) return
    await db.screeningAnswer.deleteMany({ where: { applicationId } })
    await db.screeningAnswer.createMany({
      data: answers.map((a) => ({ applicationId, questionId: a.questionId, answer: a.answer })),
    })
  }
}
