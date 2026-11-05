import { OpenAIEmbeddings } from "@langchain/openai"
import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit } from "@nestjs/common"
import { EmbeddingKind, JobStatus } from "@prisma/client"
import { apiKeyFor } from "../ai/ai.models"
import { CacheService } from "../cache/cache.service"
import { matchingCachePattern } from "../matching/matching-cache"
import { PrismaService } from "../prisma/prisma.service"
import { QueueService } from "../queue/queue.service"
import {
  contentHash,
  cosineSimilarity,
  jobEmbeddingText,
  profileEmbeddingText,
} from "./embedding-text"

export const DEFAULT_EMBEDDINGS_MODEL = "text-embedding-3-small"
/** Delay before an embed job runs, so bursts of edits collapse into one (jobId dedupe). */
export const EMBED_DELAY_MS = 2000
export const EMBED_ATTEMPTS = 3
/** ACTIVE jobs without an embedding enqueued on boot. */
export const BACKFILL_LIMIT = 500
/** Job vectors kept in memory for similarity requests (≈6 KB each for 1536 dims). */
const VECTOR_CACHE_MAX = 2000
const EMBED_TIMEOUT_MS = 20_000

export type EmbedOutcome = "embedded" | "unchanged" | "skipped" | "removed"

type EmbedJobData = { jobId: string }
type EmbedProfileData = { userId: string }

/** True when embeddings are configured: a real OpenAI key and EMBEDDINGS_ENABLED isn't "false". */
export function embeddingsEnabled(): boolean {
  if ((process.env.EMBEDDINGS_ENABLED || "").trim().toLowerCase() === "false") return false
  return !!apiKeyFor("openai")
}

export function embeddingsModel(): string {
  return process.env.EMBEDDINGS_MODEL?.trim() || DEFAULT_EMBEDDINGS_MODEL
}

/**
 * Semantic job ↔ profile similarity with OpenAI embeddings (optional).
 * Vectors are computed in the `ai-scoring` queue (never in a request), stored in `Embedding`
 * and skipped when the content hash and model are unchanged.
 */
@Injectable()
export class EmbeddingsService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(EmbeddingsService.name)
  private embedder: { key: string; client: OpenAIEmbeddings } | null = null
  private readonly jobVectors = new Map<
    string,
    { model: string; hash: string; vector: Float32Array }
  >()

  constructor(
    private prisma: PrismaService,
    private queue: QueueService,
    private cache: CacheService
  ) {}

  isEnabled(): boolean {
    return embeddingsEnabled()
  }

  onModuleInit() {
    this.queue.process<EmbedJobData>("ai-scoring", "embed-job", (data) => this.embedJob(data.jobId))
    this.queue.process<EmbedProfileData>("ai-scoring", "embed-profile", (data) =>
      this.embedProfile(data.userId)
    )
  }

  onApplicationBootstrap() {
    this.backfillSoon().catch((err: any) =>
      this.logger.warn(`Embedding backfill failed: ${err?.message ?? err}`)
    )
  }

  async embedJobSoon(jobId: string): Promise<void> {
    if (!this.isEnabled()) return
    await this.queue.add<EmbedJobData>(
      "ai-scoring",
      "embed-job",
      { jobId },
      { jobId: `embed-job-${jobId}`, delayMs: EMBED_DELAY_MS, attempts: EMBED_ATTEMPTS }
    )
  }

  async embedProfileSoon(userId: string): Promise<void> {
    if (!this.isEnabled()) return
    await this.queue.add<EmbedProfileData>(
      "ai-scoring",
      "embed-profile",
      { userId },
      { jobId: `embed-profile-${userId}`, delayMs: EMBED_DELAY_MS, attempts: EMBED_ATTEMPTS }
    )
  }

  /** Enqueues embeds for ACTIVE jobs without a current-model embedding (newest first, max 500). */
  async backfillSoon(): Promise<number> {
    if (!this.isEnabled()) return 0
    const jobs = await this.prisma.job.findMany({
      where: { status: JobStatus.ACTIVE },
      select: { id: true },
      orderBy: { createdAt: "desc" },
      take: BACKFILL_LIMIT * 4,
    })
    if (!jobs.length) return 0
    const existing = await this.prisma.embedding.findMany({
      where: {
        kind: EmbeddingKind.JOB,
        model: embeddingsModel(),
        refId: { in: jobs.map((j) => j.id) },
      },
      select: { refId: true },
    })
    const have = new Set(existing.map((e) => e.refId))
    const missing = jobs.filter((j) => !have.has(j.id)).slice(0, BACKFILL_LIMIT)
    for (const job of missing) await this.embedJobSoon(job.id)
    if (missing.length) this.logger.log(`Queued ${missing.length} job embedding(s) for backfill`)
    return missing.length
  }

  /** Queue processor: embeds an ACTIVE job (drafts/closed jobs keep any existing vector). */
  async embedJob(jobId: string): Promise<EmbedOutcome> {
    if (!this.isEnabled()) return "skipped"
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { title: true, skills: true, requirements: true, description: true, status: true },
    })
    if (!job) return this.remove(EmbeddingKind.JOB, jobId)
    if (job.status !== JobStatus.ACTIVE) return "skipped"
    return this.upsert(EmbeddingKind.JOB, jobId, jobEmbeddingText(job))
  }

  /** Queue processor: embeds a seeker profile and drops their cached match lists when it changed. */
  async embedProfile(userId: string): Promise<EmbedOutcome> {
    if (!this.isEnabled()) return "skipped"
    const profile = await this.prisma.seekerProfile.findUnique({
      where: { userId },
      select: {
        title: true,
        bio: true,
        skills: true,
        experiences: { select: { role: true, company: true, desc: true } },
        educations: { select: { degree: true, school: true } },
      },
    })
    const outcome = profile
      ? await this.upsert(EmbeddingKind.PROFILE, userId, profileEmbeddingText(profile))
      : await this.remove(EmbeddingKind.PROFILE, userId)
    if (outcome === "embedded" || outcome === "removed")
      await this.cache.delByPattern(matchingCachePattern(userId))
    return outcome
  }

  /**
   * Cosine similarity (0..1) between the seeker's profile and each job. Empty when embeddings are
   * disabled or the profile has no current embedding yet (one is then queued).
   */
  async similarities(userId: string, jobIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>()
    if (!this.isEnabled() || !jobIds.length) return result
    const model = embeddingsModel()
    const profile = await this.prisma.embedding.findUnique({
      where: { kind_refId: { kind: EmbeddingKind.PROFILE, refId: userId } },
      select: { model: true, vector: true },
    })
    if (!profile || profile.model !== model || !profile.vector.length) {
      await this.embedProfileSoon(userId)
      return result
    }

    const metas = await this.prisma.embedding.findMany({
      where: { kind: EmbeddingKind.JOB, model, refId: { in: jobIds } },
      select: { refId: true, contentHash: true },
    })
    const stale = metas.filter((m) => {
      const cached = this.jobVectors.get(m.refId)
      return !cached || cached.hash !== m.contentHash || cached.model !== model
    })
    if (stale.length) {
      const rows = await this.prisma.embedding.findMany({
        where: { kind: EmbeddingKind.JOB, model, refId: { in: stale.map((m) => m.refId) } },
        select: { refId: true, contentHash: true, vector: true },
      })
      for (const row of rows) this.rememberJobVector(row.refId, model, row.contentHash, row.vector)
    }

    for (const meta of metas) {
      const cached = this.jobVectors.get(meta.refId)
      if (!cached) continue
      const sim = cosineSimilarity(profile.vector, cached.vector)
      if (sim !== null) result.set(meta.refId, sim)
    }
    return result
  }

  private rememberJobVector(jobId: string, model: string, hash: string, vector: number[]) {
    this.jobVectors.delete(jobId)
    this.jobVectors.set(jobId, { model, hash, vector: Float32Array.from(vector) })
    while (this.jobVectors.size > VECTOR_CACHE_MAX) {
      const oldest = this.jobVectors.keys().next().value
      if (oldest === undefined) break
      this.jobVectors.delete(oldest)
    }
  }

  private async upsert(kind: EmbeddingKind, refId: string, text: string): Promise<EmbedOutcome> {
    if (!text.trim()) return this.remove(kind, refId)
    const model = embeddingsModel()
    const hash = contentHash(text)
    const existing = await this.prisma.embedding.findUnique({
      where: { kind_refId: { kind, refId } },
      select: { model: true, contentHash: true },
    })
    if (existing && existing.model === model && existing.contentHash === hash) return "unchanged"

    let vector: number[]
    try {
      vector = await this.client(model).embedQuery(text)
    } catch (err: any) {
      // Rethrown so the queue retries (attempts 3, exponential backoff).
      this.logger.warn(`Embedding ${kind} ${refId} failed: ${err?.message ?? err}`)
      throw err
    }
    if (!Array.isArray(vector) || !vector.length) throw new Error("Empty embedding returned")

    await this.prisma.embedding.upsert({
      where: { kind_refId: { kind, refId } },
      create: { kind, refId, model, contentHash: hash, vector },
      update: { model, contentHash: hash, vector },
    })
    if (kind === EmbeddingKind.JOB) this.jobVectors.delete(refId)
    this.logger.log(`Embedded ${kind} ${refId} (${vector.length} dims, ${model})`)
    return "embedded"
  }

  private async remove(kind: EmbeddingKind, refId: string): Promise<EmbedOutcome> {
    const { count } = await this.prisma.embedding.deleteMany({ where: { kind, refId } })
    if (kind === EmbeddingKind.JOB) this.jobVectors.delete(refId)
    return count ? "removed" : "skipped"
  }

  /** OpenAI client, rebuilt when the model or key changes. OPENAI_BASE_URL is a test hook. */
  private client(model: string): OpenAIEmbeddings {
    const apiKey = apiKeyFor("openai")
    if (!apiKey) throw new Error("OpenAI is not configured")
    const baseURL = process.env.OPENAI_BASE_URL?.trim() || undefined
    const key = `${model}|${baseURL ?? ""}|${apiKey}`
    if (this.embedder?.key !== key) {
      this.embedder = {
        key,
        client: new OpenAIEmbeddings({
          model,
          apiKey,
          maxRetries: 1, // the queue owns retries
          timeout: EMBED_TIMEOUT_MS,
          ...(baseURL ? { configuration: { baseURL } } : {}),
        }),
      }
    }
    return this.embedder.client
  }
}
