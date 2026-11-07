import { Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common"
import { EmploymentType } from "@prisma/client"
import { PUBLIC_JOB_WHERE } from "../jobs/public-job"
import { PrismaService } from "../prisma/prisma.service"
import { QueueService } from "../queue/queue.service"
import {
  JOB_DOCUMENT_SELECT,
  JobDocumentSource,
  JOBS_INDEX_SETTINGS,
  toJobDocument,
} from "./job-document"
import { MeiliClient, meiliQuote } from "./meili.client"

export type SearchJobsParams = {
  q: string
  type?: EmploymentType
  categorySlug?: string
  remote?: boolean
  limit: number
  offset: number
}

export type SearchHealth = "ok" | "disabled" | "error"

const INDEX_JOB = "index-job"
const INDEX_DELAY_MS = 500
const REINDEX_BATCH = 500

/**
 * Optional Meilisearch job index. Disabled unless MEILI_HOST is set; every public method
 * degrades to "disabled"/null so callers fall back to Postgres.
 */
@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name)
  private readonly client: MeiliClient | null
  readonly indexUid: string
  /** Resolves once the index exists with its settings (or the attempt failed). */
  private bootstrapPromise: Promise<void> | null = null

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly queue?: QueueService,
    @Optional() client?: MeiliClient
  ) {
    const host = process.env.MEILI_HOST?.trim()
    this.indexUid = process.env.MEILI_JOBS_INDEX?.trim() || "jobs"
    this.client =
      client ??
      (host
        ? new MeiliClient(
            host,
            process.env.MEILI_MASTER_KEY?.trim() || undefined,
            Number.parseInt(process.env.MEILI_TIMEOUT_MS || "", 10) || 2000
          )
        : null)
  }

  isEnabled(): boolean {
    return this.client !== null
  }

  onModuleInit() {
    this.queue?.process<{ jobId: string }>("search", INDEX_JOB, ({ jobId }) => this.syncJob(jobId))
    // Never blocks boot: Meili being down only means search falls back to Postgres.
    if (this.isEnabled()) this.bootstrapPromise = this.bootstrap()
  }

  /** Test/ops hook: wait for the boot-time index setup. */
  ready(): Promise<void> {
    return this.bootstrapPromise ?? Promise.resolve()
  }

  private async bootstrap(): Promise<void> {
    const client = this.client!
    try {
      let count = await client.documentCount(this.indexUid)
      if (count === null) {
        const task = await client.createIndex(this.indexUid, "id")
        await client.waitForTask(task.taskUid).catch((err: any) => {
          // A concurrent instance may have created it first.
          if (err?.code !== "index_already_exists") throw err
        })
        count = 0
      }
      const settings = await client.updateSettings(this.indexUid, JOBS_INDEX_SETTINGS)
      await client.waitForTask(settings.taskUid)
      this.logger.log(`Meilisearch index "${this.indexUid}" ready (${count} documents)`)
      if (count === 0) {
        const indexed = await this.reindexAll()
        this.logger.log(`Indexed ${indexed} active jobs into "${this.indexUid}"`)
      }
    } catch (err: any) {
      this.logger.warn(`Meilisearch setup failed (search falls back to Postgres): ${err?.message}`)
    }
  }

  async health(): Promise<SearchHealth> {
    if (!this.client) return "disabled"
    try {
      return (await this.client.health()) ? "ok" : "error"
    } catch {
      return "error"
    }
  }

  /** Debounced (re)index of one job: upserted when ACTIVE, removed otherwise. */
  indexJobSoon(jobId: string): void {
    if (!this.client || !jobId) return
    if (this.queue) {
      // Fire-and-forget by contract: QueueService.add never rejects, but stay defensive.
      void this.queue
        .add(
          "search",
          INDEX_JOB,
          { jobId },
          { jobId: `search-${jobId}`, delayMs: INDEX_DELAY_MS, attempts: 3 }
        )
        .catch((err: any) =>
          this.logger.warn(`Could not enqueue index of ${jobId}: ${err?.message}`)
        )
      return
    }
    setTimeout(() => {
      this.syncJob(jobId).catch((err: any) =>
        this.logger.warn(`Search index of job ${jobId} failed: ${err?.message}`)
      )
    }, INDEX_DELAY_MS).unref?.()
  }

  /** Same processor: a missing (deleted) job is removed from the index. */
  removeJobSoon(jobId: string): void {
    this.indexJobSoon(jobId)
  }

  /** Queue processor. Throws on Meili errors so the queue retries. */
  async syncJob(jobId: string): Promise<"indexed" | "removed" | "skipped"> {
    if (!this.client) return "skipped"
    // Only publicly visible jobs live in the index (ACTIVE and company not suspended).
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, ...PUBLIC_JOB_WHERE },
      select: JOB_DOCUMENT_SELECT,
    })
    if (job) {
      await this.client.addDocuments(this.indexUid, [toJobDocument(job)])
      return "indexed"
    }
    await this.client.deleteDocument(this.indexUid, jobId)
    return "removed"
  }

  /**
   * Ids in Meili relevance order with currently featured jobs first, or null when search is
   * disabled or Meili failed (the caller then uses Postgres).
   */
  async searchJobs(params: SearchJobsParams): Promise<{ ids: string[]; total: number } | null> {
    if (!this.client) return null
    const q = params.q.trim()
    const limit = Math.max(0, params.limit)
    const offset = Math.max(0, params.offset)
    const base: string[] = []
    if (params.type) base.push(`type = ${meiliQuote(params.type)}`)
    if (params.remote) base.push("remote = true")
    if (params.categorySlug) base.push(`categorySlug = ${meiliQuote(params.categorySlug)}`)
    const now = Math.floor(Date.now() / 1000)
    const query = (filter: string, lim: number, off: number) =>
      this.client!.search<{ id: string }>(this.indexUid, {
        q,
        filter: [...base, filter],
        limit: lim,
        offset: off,
        attributesToRetrieve: ["id"],
      })
    const totalOf = (res: { estimatedTotalHits?: number; totalHits?: number }) =>
      res.totalHits ?? res.estimatedTotalHits ?? 0
    try {
      // Featured block first, then everything else; both in relevance order.
      const featured = await query(`featuredUntilTs > ${now}`, limit, offset)
      const featuredTotal = totalOf(featured)
      const ids = featured.hits.map((h) => h.id)
      const remaining = limit - ids.length
      const restOffset = Math.max(0, offset - featuredTotal)
      // The second query is also needed for the total when the page is filled by featured jobs.
      const rest = await query(`featuredUntilTs <= ${now}`, Math.max(remaining, 0), restOffset)
      if (remaining > 0) ids.push(...rest.hits.map((h) => h.id))
      return { ids, total: featuredTotal + totalOf(rest) }
    } catch (err: any) {
      this.logger.warn(`Meilisearch query failed, falling back to Postgres: ${err?.message}`)
      return null
    }
  }

  /** Re-sends every ACTIVE job in batches; returns how many were sent. */
  async reindexAll(): Promise<number> {
    if (!this.client) return 0
    let cursor: string | undefined
    let total = 0
    let lastTask: number | undefined
    for (;;) {
      const batch: JobDocumentSource[] = await this.prisma.job.findMany({
        where: PUBLIC_JOB_WHERE,
        select: JOB_DOCUMENT_SELECT,
        orderBy: { id: "asc" },
        take: REINDEX_BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      })
      if (!batch.length) break
      const task = await this.client.addDocuments(this.indexUid, batch.map(toJobDocument))
      lastTask = task?.taskUid
      total += batch.length
      cursor = batch[batch.length - 1].id
      if (batch.length < REINDEX_BATCH) break
    }
    if (lastTask !== undefined) await this.client.waitForTask(lastTask, 120_000)
    return total
  }
}
