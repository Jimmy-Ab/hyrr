import { Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common"
import { QueueService } from "../queue/queue.service"
import { AlertsService } from "./alerts.service"

/** ALERT_DIGESTS_ENABLED=false turns the DAILY / WEEKLY digests off (default on). */
export function digestsEnabled(): boolean {
  return (process.env.ALERT_DIGESTS_ENABLED ?? "true").trim().toLowerCase() !== "false"
}

export const DIGEST_DAILY_CRON = "0 8 * * *"
export const DIGEST_WEEKLY_CRON = "0 8 * * 1"

/**
 * Registers the `alerts` queue: `instant { jobId }` (INSTANT fan-out) and the repeatable
 * `digest-daily` / `digest-weekly` jobs (08:00 UTC; weekly on Mondays).
 */
@Injectable()
export class AlertsScheduler implements OnModuleInit {
  private readonly logger = new Logger(AlertsScheduler.name)
  private running = new Set<string>()

  constructor(
    private readonly alerts: AlertsService,
    @Optional() private readonly queue?: QueueService
  ) {}

  onModuleInit() {
    if (!this.queue) return
    this.queue.process<{ jobId: string }>("alerts", "instant", ({ jobId }) =>
      this.alerts.sendInstant(jobId)
    )
    this.queue.process("alerts", "digest-daily", () => this.daily())
    this.queue.process("alerts", "digest-weekly", () => this.weekly())
    if (digestsEnabled()) {
      this.queue.repeat("alerts", "digest-daily", DIGEST_DAILY_CRON)
      this.queue.repeat("alerts", "digest-weekly", DIGEST_WEEKLY_CRON)
    } else {
      this.logger.log("Job alert digests disabled (ALERT_DIGESTS_ENABLED=false)")
    }
  }

  daily() {
    return this.run("DAILY")
  }

  weekly() {
    return this.run("WEEKLY")
  }

  /** Skipped when digests are disabled (also for a repeatable left in Redis by an earlier run). */
  async run(frequency: "DAILY" | "WEEKLY") {
    if (!digestsEnabled() || this.running.has(frequency)) return
    this.running.add(frequency)
    try {
      const result = await this.alerts.runDigest(frequency)
      this.logger.log(
        `${frequency} job alert digest: ${result.alerts} alerts checked, ${result.users} users notified`
      )
    } catch (err: any) {
      this.logger.error(`${frequency} job alert digest failed: ${err?.message}`)
    } finally {
      this.running.delete(frequency)
    }
  }
}
