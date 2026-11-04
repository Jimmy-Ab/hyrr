import { Module } from "@nestjs/common"
import { MessagesModule } from "../messages/messages.module"
import { NotificationsModule } from "../notifications/notifications.module"
import { JobsController } from "./jobs.controller"
import { JobsService } from "./jobs.service"

@Module({
  imports: [NotificationsModule, MessagesModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
