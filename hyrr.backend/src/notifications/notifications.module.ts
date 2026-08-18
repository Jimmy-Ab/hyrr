import { forwardRef, Global, Module } from "@nestjs/common"
import { MessagesModule } from "../messages/messages.module"
import { NotificationsController } from "./notifications.controller"
import { NotificationsService } from "./notifications.service"

@Global()
@Module({
  imports: [forwardRef(() => MessagesModule)],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
