import { Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common"
import { QueueService } from "../queue/queue.service"
import { ExternalJobsService, externalJobsEnabled } from "./external-jobs.service"

/** Every 6 hours (licensed APIs ask for few requests; Remotive allows a handful per day). */
export const EXTERNAL_JOBS_CRON = "0 */6 * * *"

@Injectable()
export class ExternalJobsScheduler implements OnModuleInit {
  private readonly logger = new Logger(ExternalJobsScheduler.name)

  constructor(
    private readonly external: ExternalJobsService,
    @Optional() private readonly queue?: QueueService
  ) {}

  onModuleInit() {
    if (!this.queue) return
    this.queue.process("external-jobs", "sync", () => this.external.sync())
    if (externalJobsEnabled()) {
      this.queue.repeat("external-jobs", "sync", EXTERNAL_JOBS_CRON)
      // First fill shortly after start.
      void this.queue.add("external-jobs", "sync", {}, { jobId: "external-jobs:boot", attempts: 1 })
    } else this.logger.log("Jobs from the web disabled (EXTERNAL_JOBS_ENABLED is not true)")
  }
}
