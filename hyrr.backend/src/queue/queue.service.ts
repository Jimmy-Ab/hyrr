import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
} from "@nestjs/common"
import { SchedulerRegistry } from "@nestjs/schedule"
import { InlineDriver } from "./inline.driver"
import {
  HandlerRegistry,
  JobHandler,
  JobOpts,
  QueueDriver,
  queueDriverName,
  QueueName,
  QueueStatus,
  resolveOpts,
  workerEnabled,
} from "./queue.types"

export type { JobOpts, QueueName, QueueStatus } from "./queue.types"

/**
 * Background jobs. Driver `bullmq` when Redis is configured (REDIS_HOST) and QUEUE_DRIVER is not
 * "inline"; otherwise `inline` (in-process, same retry semantics). Owning services register
 * handlers with `process()` and repeatables with `repeat()` in their `onModuleInit`; workers start
 * on application bootstrap unless QUEUE_WORKER=false (enqueue-only API replica).
 */
@Injectable()
export class QueueService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name)
  private readonly handlers = new HandlerRegistry()
  private current?: QueueDriver

  constructor(@Optional() private readonly scheduler?: SchedulerRegistry) {}

  /** Chosen lazily so `.env` (ConfigModule) is loaded before the first use. */
  private get driver(): QueueDriver {
    if (this.current) return this.current
    const inline = new InlineDriver(this.handlers, this.logger, this.scheduler)
    if (queueDriverName() === "bullmq") {
      // Loaded only when used, so the inline path (and unit tests) never load BullMQ.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { BullmqDriver } = require("./bullmq.driver") as typeof import("./bullmq.driver")
      this.current = new BullmqDriver(this.handlers, this.logger, inline)
      this.logger.log(
        `Queue driver: bullmq${workerEnabled() ? "" : " (enqueue only, QUEUE_WORKER=false)"}`
      )
    } else {
      this.current = inline
      this.logger.log("Queue driver: inline (in-process)")
    }
    return this.current
  }

  /** Enqueue a job. Never throws: failures are logged (BullMQ falls back to in-process). */
  async add<T>(queue: QueueName, name: string, data: T, opts?: JobOpts): Promise<void> {
    try {
      await this.driver.add(queue, name, data, resolveOpts(opts))
    } catch (err: any) {
      this.logger.error(`Could not enqueue ${queue}:${name}: ${err?.message || err}`)
    }
  }

  /** Register the handler of `queue:name`. A thrown error / rejection triggers the retries. */
  process<T>(queue: QueueName, name: string, handler: (data: T) => Promise<unknown>): void {
    this.handlers.set(queue, name, handler as JobHandler)
  }

  /** Repeatable job on a UTC cron pattern, upserted by name (no duplicates across restarts). */
  repeat(queue: QueueName, name: string, cron: string, data?: unknown): void {
    try {
      this.driver.repeat(queue, name, cron, data ?? {})
    } catch (err: any) {
      this.logger.error(`Could not schedule ${queue}:${name} (${cron}): ${err?.message || err}`)
    }
  }

  status(): QueueStatus | Promise<QueueStatus> {
    return this.driver.status()
  }

  onApplicationBootstrap() {
    if (workerEnabled()) this.driver.startWorkers()
  }

  async onModuleDestroy() {
    await this.current?.close()
  }
}
