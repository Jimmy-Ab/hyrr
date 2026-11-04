import { Injectable, Logger } from "@nestjs/common"
import { Cron } from "@nestjs/schedule"
import { JobsService } from "./jobs.service"

/**
 * Every 15 minutes: clears `featured` on jobs whose paid window (`featuredUntil`) has ended.
 * ScheduleModule.forRoot() is registered once by SeekerToolsModule.
 */
@Injectable()
export class FeaturedJobsScheduler {
  private readonly logger = new Logger(FeaturedJobsScheduler.name)
  private running = false

  constructor(private readonly jobs: JobsService) {}

  @Cron("*/15 * * * *", { name: "featured-jobs-expiry", timeZone: "UTC" })
  async expire() {
    if (this.running) return
    this.running = true
    try {
      const count = await this.jobs.expireFeatured()
      if (count) this.logger.log(`Featured window ended for ${count} job(s)`)
    } catch (err) {
      this.logger.error(`Featured expiry failed: ${(err as Error)?.message}`)
    } finally {
      this.running = false
    }
  }
}
