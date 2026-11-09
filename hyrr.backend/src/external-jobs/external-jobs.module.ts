import { Module } from "@nestjs/common"
import { ExternalJobsController } from "./external-jobs.controller"
import { ExternalJobsScheduler } from "./external-jobs.scheduler"
import { ExternalJobsService } from "./external-jobs.service"

@Module({
  controllers: [ExternalJobsController],
  providers: [ExternalJobsService, ExternalJobsScheduler],
  exports: [ExternalJobsService],
})
export class ExternalJobsModule {}
