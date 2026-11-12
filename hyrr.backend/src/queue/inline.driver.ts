import { Logger } from "@nestjs/common"
import type { SchedulerRegistry } from "@nestjs/schedule"
import { CronJob } from "cron"
import {
  backoffDelay,
  emptyCounts,
  HandlerRegistry,
  QUEUE_NAMES,
  QueueDriver,
  QueueName,
  QueueStatus,
  REPEAT_OPTS,
  ResolvedJobOpts,
} from "./queue.types"

type Timer =
  { kind: "timeout"; handle: NodeJS.Timeout } | { kind: "immediate"; handle: NodeJS.Immediate }

/**
 * In-process driver (no Redis): jobs run on `setImmediate` / after their delay, with the same
 * attempts + exponential backoff as BullMQ. Jobs added before their handler is registered wait
 * in a buffer. `jobId` dedupes jobs that have not started yet. Repeatables are cron jobs (UTC).
 * Nothing survives a restart.
 */
export class InlineDriver implements QueueDriver {
  private readonly pending = new Set<string>()
  private readonly buffered = new Map<string, Array<() => void>>()
  private readonly timers = new Set<Timer>()
  private readonly crons = new Map<string, CronJob>()
  private readonly counts = emptyCounts()
  private closed = false

  constructor(
    private readonly handlers: HandlerRegistry,
    private readonly logger: Logger,
    private readonly scheduler?: SchedulerRegistry
  ) {
    for (const queue of QUEUE_NAMES) this.counts[queue] = { waiting: 0, failed: 0 }
    handlers.onRegister((queue, name) => this.flush(queue, name))
  }

  async add(queue: QueueName, name: string, data: unknown, opts: ResolvedJobOpts): Promise<void> {
    if (this.closed) {
      this.logger.warn(`Queue closed: dropped ${queue}:${name}`)
      return
    }
    const dedupeKey = opts.jobId ? `${queue}:${opts.jobId}` : null
    if (dedupeKey) {
      if (this.pending.has(dedupeKey)) return
      this.pending.add(dedupeKey)
    }
    this.counts[queue].waiting!++
    const start = () => {
      if (!this.handlers.get(queue, name)) {
        const key = `${queue}:${name}`
        const list = this.buffered.get(key) ?? []
        list.push(start)
        this.buffered.set(key, list)
        return
      }
      if (dedupeKey) this.pending.delete(dedupeKey)
      this.counts[queue].waiting!--
      this.attempt(queue, name, data, opts, 1)
    }
    this.later(opts.delayMs, start)
  }

  repeat(queue: QueueName, name: string, cron: string, data: unknown): void {
    const key = `queue:${queue}:${name}`
    this.removeCron(key)
    const job = CronJob.from({
      cronTime: cron,
      timeZone: "UTC",
      start: true,
      onTick: () => {
        void this.add(queue, name, data ?? {}, { ...REPEAT_OPTS, jobId: `repeat:${name}` })
      },
    })
    this.crons.set(key, job)
    try {
      this.scheduler?.addCronJob(key, job as any)
    } catch {
      // the registry is only for introspection
    }
  }

  startWorkers(): void {
    // Inline jobs always run in this process.
  }

  status(): QueueStatus {
    const queues = emptyCounts()
    for (const queue of QUEUE_NAMES) queues[queue] = { ...this.counts[queue] }
    return { driver: "inline", queues }
  }

  async close(): Promise<void> {
    this.closed = true
    for (const timer of this.timers) {
      if (timer.kind === "timeout") clearTimeout(timer.handle)
      else clearImmediate(timer.handle)
    }
    this.timers.clear()
    for (const key of [...this.crons.keys()]) this.removeCron(key)
    this.buffered.clear()
  }

  private attempt(
    queue: QueueName,
    name: string,
    data: unknown,
    opts: ResolvedJobOpts,
    attempt: number
  ) {
    if (this.closed) return
    const handler = this.handlers.get(queue, name)!
    Promise.resolve()
      .then(() => handler(data))
      .then(
        () => undefined,
        (err: any) => {
          const reason = err?.message || String(err)
          if (attempt < opts.attempts) {
            const delay = backoffDelay(opts.backoffMs, attempt)
            this.logger.warn(
              `Job ${queue}:${name} failed (attempt ${attempt}/${opts.attempts}), retrying in ${delay} ms: ${reason}`
            )
            this.later(delay, () => this.attempt(queue, name, data, opts, attempt + 1))
          } else {
            this.counts[queue].failed!++
            this.logger.error(
              `Job ${queue}:${name} failed permanently after ${opts.attempts} attempt(s): ${reason}`
            )
          }
        }
      )
  }

  private flush(queue: QueueName, name: string) {
    const key = `${queue}:${name}`
    const list = this.buffered.get(key)
    if (!list) return
    this.buffered.delete(key)
    for (const start of list) this.later(0, start)
  }

  private later(ms: number, fn: () => void) {
    if (this.closed) return
    if (ms > 0) {
      const timer: Timer = {
        kind: "timeout",
        handle: setTimeout(() => {
          this.timers.delete(timer)
          fn()
        }, ms),
      }
      this.timers.add(timer)
    } else {
      const timer: Timer = {
        kind: "immediate",
        handle: setImmediate(() => {
          this.timers.delete(timer)
          fn()
        }),
      }
      this.timers.add(timer)
    }
  }

  private removeCron(key: string) {
    const existing = this.crons.get(key)
    if (!existing) return
    void existing.stop()
    this.crons.delete(key)
    try {
      if (this.scheduler?.doesExist("cron", key)) this.scheduler.deleteCronJob(key)
    } catch {
      // ignore
    }
  }
}
