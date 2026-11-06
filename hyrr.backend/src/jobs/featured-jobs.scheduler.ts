import { Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common"
import { QueueService } from "../queue/queue.service"
import { JobsService } from "./jobs.service"

export const FEATURED_EXPIRY_CRON = "*/15 * * * *"

/** Repeatable `maintenance:featured-expiry` (every 15 min): clears `featured` once `featuredUntil` has passed. */
@Injectable()
export class FeaturedJobsScheduler implements OnModuleInit {
  private readonly logger = new Logger(FeaturedJobsScheduler.name)

  constructor(
    private readonly jobs: JobsService,
    @Optional() private readonly queue?: QueueService
  ) {}

  onModuleInit() {
    if (!this.queue) return
    this.queue.process("maintenance", "featured-expiry", () => this.expire())
    this.queue.repeat("maintenance", "featured-expiry", FEATURED_EXPIRY_CRON)
  }

  async expire(): Promise<number> {
    const count = await this.jobs.expireFeatured()
    if (count) this.logger.log(`Featured window ended for ${count} job(s)`)
    return count
  }
}
