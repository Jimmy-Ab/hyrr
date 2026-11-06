import { Module } from "@nestjs/common"
import { MessagesModule } from "../messages/messages.module"
import { NotificationsModule } from "../notifications/notifications.module"
import { PipelineModule } from "../pipeline/pipeline.module"
import { FeaturedJobsScheduler } from "./featured-jobs.scheduler"
import { JobsController } from "./jobs.controller"
import { JobsService } from "./jobs.service"

@Module({
  imports: [NotificationsModule, MessagesModule, PipelineModule],
  controllers: [JobsController],
  providers: [JobsService, FeaturedJobsScheduler],
  exports: [JobsService],
})
export class JobsModule {}
