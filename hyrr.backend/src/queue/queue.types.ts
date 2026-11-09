import { isRedisConfigured } from "../core/redis/redis-options"

export const QUEUE_NAMES = [
  "email",
  "ai-scoring",
  "alerts",
  "maintenance",
  "search",
  "external-jobs",
] as const
export type QueueName = (typeof QUEUE_NAMES)[number]

export type JobOpts = {
  /** Total tries including the first one (default 3). */
  attempts?: number
  /** Base delay of the exponential backoff between tries (default 5000 ms). */
  backoffMs?: number
  delayMs?: number
  /** Dedupe key: a job with the same key that is still pending is not added again. */
  jobId?: string
}

export type QueueCounts = { waiting?: number; failed?: number }
export type QueueStatus = {
  driver: "bullmq" | "inline"
  queues: Record<QueueName, QueueCounts>
}

export type JobHandler<T = any> = (data: T) => Promise<unknown>

export type ResolvedJobOpts = {
  attempts: number
  backoffMs: number
  delayMs: number
  jobId?: string
}

export const DEFAULT_ATTEMPTS = 3
export const DEFAULT_BACKOFF_MS = 5000
/** Retention of finished jobs in Redis (BullMQ driver). */
export const REMOVE_ON_COMPLETE = 1000
export const REMOVE_ON_FAIL = 5000
/** Repeatable (cron) runs are not retried: the next tick runs again. */
export const REPEAT_OPTS: ResolvedJobOpts = {
  attempts: 1,
  backoffMs: DEFAULT_BACKOFF_MS,
  delayMs: 0,
}

export function resolveOpts(opts: JobOpts = {}): ResolvedJobOpts {
  const attempts = Math.max(1, Math.floor(Number(opts.attempts ?? DEFAULT_ATTEMPTS)) || 1)
  const backoffMs = Math.max(0, Number(opts.backoffMs ?? DEFAULT_BACKOFF_MS) || 0)
  const delayMs = Math.max(0, Number(opts.delayMs ?? 0) || 0)
  return { attempts, backoffMs, delayMs, ...(opts.jobId ? { jobId: String(opts.jobId) } : {}) }
}

/** Exponential backoff, same formula as BullMQ: `backoffMs * 2^(failedAttempt - 1)`. */
export function backoffDelay(backoffMs: number, failedAttempt: number): number {
  return backoffMs * 2 ** Math.max(0, failedAttempt - 1)
}

/** `QUEUE_CONCURRENCY_<NAME>` (e.g. QUEUE_CONCURRENCY_AI_SCORING); ai-scoring 2, others 5. */
export function concurrencyFor(queue: QueueName): number {
  const raw = process.env[`QUEUE_CONCURRENCY_${queue.toUpperCase().replace(/-/g, "_")}`]
  const parsed = Number.parseInt(raw || "", 10)
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  return queue === "ai-scoring" ? 2 : 5
}

/** `bullmq` when Redis is configured and QUEUE_DRIVER is not "inline"; otherwise `inline`. */
export function queueDriverName(): "bullmq" | "inline" {
  const forced = process.env.QUEUE_DRIVER?.trim().toLowerCase()
  return isRedisConfigured() && forced !== "inline" ? "bullmq" : "inline"
}

/** QUEUE_WORKER=false: this instance only enqueues (API-only replica). Default true. */
export function workerEnabled(): boolean {
  return (process.env.QUEUE_WORKER ?? "true").trim().toLowerCase() !== "false"
}

export const emptyCounts = (): Record<QueueName, QueueCounts> =>
  Object.fromEntries(QUEUE_NAMES.map((q) => [q, {}])) as Record<QueueName, QueueCounts>

/** Handlers registered with `QueueService.process`, shared by the drivers. */
export class HandlerRegistry {
  private readonly handlers = new Map<string, JobHandler>()
  private readonly listeners: Array<(queue: QueueName, name: string) => void> = []

  set(queue: QueueName, name: string, handler: JobHandler) {
    this.handlers.set(`${queue}:${name}`, handler)
    for (const listener of this.listeners) listener(queue, name)
  }

  get(queue: QueueName, name: string): JobHandler | undefined {
    return this.handlers.get(`${queue}:${name}`)
  }

  onRegister(listener: (queue: QueueName, name: string) => void) {
    this.listeners.push(listener)
  }
}

export interface QueueDriver {
  add(queue: QueueName, name: string, data: unknown, opts: ResolvedJobOpts): Promise<void>
  repeat(queue: QueueName, name: string, cron: string, data: unknown): void
  startWorkers(): void
  status(): QueueStatus | Promise<QueueStatus>
  close(): Promise<void>
}
