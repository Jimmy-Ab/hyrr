import { Logger } from "@nestjs/common"
import type { Job, JobsOptions } from "bullmq"
import { Queue, Worker } from "bullmq"
import Redis from "ioredis"
import { redisOptions } from "../core/redis/redis-options"
import type { InlineDriver } from "./inline.driver"
import {
  concurrencyFor,
  emptyCounts,
  HandlerRegistry,
  QUEUE_NAMES,
  QueueDriver,
  QueueName,
  QueueStatus,
  REMOVE_ON_COMPLETE,
  REMOVE_ON_FAIL,
  REPEAT_OPTS,
  ResolvedJobOpts,
} from "./queue.types"

export const QUEUE_PREFIX = "hyrr"
/** An enqueue that takes longer than this falls back to running in-process. */
const ADD_TIMEOUT_MS = 5000
const CLOSE_TIMEOUT_MS = 5000
const STATUS_TIMEOUT_MS = 2000

const withTimeout = <T>(promise: Promise<T>, ms: number, what: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })

/**
 * Completed e-mail jobs are dropped at once: their payload holds one-time links (reset, verify)
 * that should not sit in Redis. Failed ones are kept for inspection like every other queue.
 */
const removeOnCompleteFor = (queue: QueueName): number | boolean =>
  queue === "email" ? true : REMOVE_ON_COMPLETE

/**
 * BullMQ driver: one Queue + one Worker per queue name (prefix `hyrr`). Producers share one
 * fail-fast connection; an enqueue that fails or times out runs in-process instead (logged), so
 * a Redis outage never loses side effects. Repeatables are upserted by name, so restarts and
 * extra replicas never duplicate them.
 */
export class BullmqDriver implements QueueDriver {
  private readonly connection: Redis
  private readonly queues = new Map<QueueName, Queue>()
  private readonly workers: Worker[] = []
  private lastConnectionError = 0

  constructor(
    private readonly handlers: HandlerRegistry,
    private readonly logger: Logger,
    private readonly fallback: InlineDriver
  ) {
    // Producer connection: fail fast while Redis is unreachable (the caller falls back in-process).
    this.connection = new Redis(
      redisOptions({ maxRetriesPerRequest: null, enableOfflineQueue: false })
    )
    this.connection.on("error", (err) => this.connectionError(err))
  }

  async add(queue: QueueName, name: string, data: unknown, opts: ResolvedJobOpts): Promise<void> {
    const jobOpts: JobsOptions = {
      attempts: opts.attempts,
      backoff: { type: "exponential", delay: opts.backoffMs },
      removeOnComplete: removeOnCompleteFor(queue),
      removeOnFail: REMOVE_ON_FAIL,
      ...(opts.delayMs > 0 ? { delay: opts.delayMs } : {}),
      // BullMQ custom job ids may not contain ":"; deduplication ids may, and they only block
      // while the previous job has not completed or failed (no retention side effect).
      ...(opts.jobId ? { deduplication: { id: opts.jobId } } : {}),
    }
    // Redis known to be down: run in-process right away instead of waiting for the timeout.
    if (this.connection.status !== "ready" && this.connection.status !== "connecting") {
      await this.fallback.add(queue, name, data, opts)
      return
    }
    try {
      await withTimeout(this.queue(queue).add(name, data, jobOpts), ADD_TIMEOUT_MS, "enqueue")
    } catch (err: any) {
      this.logger.error(
        `Enqueue ${queue}:${name} failed (${err?.message || err}); running it in-process`
      )
      await this.fallback.add(queue, name, data, opts)
    }
  }

  repeat(queue: QueueName, name: string, cron: string, data: unknown): void {
    this.queue(queue)
      .upsertJobScheduler(
        name,
        { pattern: cron, tz: "UTC" },
        {
          name,
          data: data ?? {},
          opts: {
            attempts: REPEAT_OPTS.attempts,
            removeOnComplete: REMOVE_ON_COMPLETE,
            removeOnFail: REMOVE_ON_FAIL,
          },
        }
      )
      .then(() => this.logger.log(`Repeatable ${queue}:${name} scheduled (${cron} UTC)`))
      .catch((err: any) =>
        this.logger.error(`Could not schedule ${queue}:${name}: ${err?.message || err}`)
      )
  }

  startWorkers(): void {
    if (this.workers.length) return
    for (const queue of QUEUE_NAMES) {
      const worker = new Worker(
        queue,
        async (job: Job) => {
          const handler = this.handlers.get(queue, job.name)
          if (!handler) throw new Error(`No handler registered for ${queue}:${job.name}`)
          return handler(job.data)
        },
        {
          connection: redisOptions({ maxRetriesPerRequest: null }),
          prefix: QUEUE_PREFIX,
          concurrency: concurrencyFor(queue),
        }
      )
      worker.on("failed", (job: Job | undefined, err: Error) => {
        if (!job) return
        const attempts = job.opts.attempts ?? 1
        const reason = err?.message || String(err)
        if (job.attemptsMade >= attempts) {
          this.logger.error(
            `Job ${queue}:${job.name} (${job.id}) failed permanently after ${job.attemptsMade} attempt(s): ${reason}`
          )
        } else {
          this.logger.warn(
            `Job ${queue}:${job.name} (${job.id}) failed (attempt ${job.attemptsMade}/${attempts}), will retry: ${reason}`
          )
        }
      })
      worker.on("error", (err: Error) => this.connectionError(err))
      this.workers.push(worker)
    }
    this.logger.log(`Queue workers started (${QUEUE_NAMES.length} queues)`)
  }

  async status(): Promise<QueueStatus> {
    const queues = emptyCounts()
    await Promise.all(
      QUEUE_NAMES.map(async (queue) => {
        try {
          const counts = await withTimeout(
            this.queue(queue).getJobCounts("waiting", "delayed", "failed"),
            STATUS_TIMEOUT_MS,
            "status"
          )
          queues[queue] = {
            waiting: (counts.waiting ?? 0) + (counts.delayed ?? 0),
            failed: counts.failed ?? 0,
          }
        } catch {
          queues[queue] = {}
        }
      })
    )
    return { driver: "bullmq", queues }
  }

  /** Graceful when Redis is up; bounded (then forced) when it is unreachable, so shutdown never hangs. */
  async close(): Promise<void> {
    const redisUp = this.connection.status === "ready"
    const closing = Promise.allSettled([
      ...this.workers.map((w) => w.close(!redisUp)),
      ...[...this.queues.values()].map((q) => q.close()),
    ])
    const results = await withTimeout(closing, CLOSE_TIMEOUT_MS, "queue close").catch(
      (err: any) => {
        this.logger.warn(`Queue close: ${err?.message || err}; forcing disconnect`)
        return []
      }
    )
    for (const result of results)
      if (result.status === "rejected")
        this.logger.warn(`Queue close failed: ${result.reason?.message || result.reason}`)
    if (redisUp) await this.connection.quit().catch(() => this.connection.disconnect())
    else this.connection.disconnect()
    await this.fallback.close()
  }

  private queue(name: QueueName): Queue {
    let queue = this.queues.get(name)
    if (!queue) {
      queue = new Queue(name, { connection: this.connection, prefix: QUEUE_PREFIX })
      queue.on("error", (err: Error) => this.connectionError(err))
      this.queues.set(name, queue)
    }
    return queue
  }

  /** Redis connection errors repeat on every reconnect: log at most one every 30 s. */
  private connectionError(err: Error) {
    const now = Date.now()
    if (now - this.lastConnectionError < 30_000) return
    this.lastConnectionError = now
    this.logger.warn(`Queue Redis error: ${err?.message || err}`)
  }
}
