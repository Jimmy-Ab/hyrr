import { Injectable, Logger } from "@nestjs/common"
import { Cron } from "@nestjs/schedule"
import { AlertsService } from "./alerts.service"

/** ALERT_DIGESTS_ENABLED=false turns the DAILY / WEEKLY digest crons off (default on). */
export function digestsEnabled(): boolean {
  return (process.env.ALERT_DIGESTS_ENABLED ?? "true").trim().toLowerCase() !== "false"
}

@Injectable()
export class AlertsScheduler {
  private readonly logger = new Logger(AlertsScheduler.name)
  private running = new Set<string>()

  constructor(private readonly alerts: AlertsService) {}

  @Cron("0 8 * * *", { name: "job-alert-digest-daily", timeZone: "UTC" })
  daily() {
    return this.run("DAILY")
  }

  @Cron("0 8 * * 1", { name: "job-alert-digest-weekly", timeZone: "UTC" })
  weekly() {
    return this.run("WEEKLY")
  }

  async run(frequency: "DAILY" | "WEEKLY") {
    if (!digestsEnabled() || this.running.has(frequency)) return
    this.running.add(frequency)
    try {
      const result = await this.alerts.runDigest(frequency)
      this.logger.log(
        `${frequency} job alert digest: ${result.alerts} alerts checked, ${result.users} users notified`
      )
    } catch (err) {
      this.logger.error(`${frequency} job alert digest failed: ${(err as Error)?.message}`)
    } finally {
      this.running.delete(frequency)
    }
  }
}
