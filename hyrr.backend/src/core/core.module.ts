import { Global, Module } from "@nestjs/common"
import { AccessService } from "./access/access.service"
import { EmailDeliveryService } from "./delivery/email-delivery.service"
import { EmailService } from "./delivery/email.service"
import { LoggerService } from "./logger/logger.service"
import { RealtimeService } from "./realtime/realtime.service"

@Global()
@Module({
  providers: [LoggerService, AccessService, EmailService, EmailDeliveryService, RealtimeService],
  exports: [LoggerService, AccessService, EmailService, EmailDeliveryService, RealtimeService],
})
export class CoreModule {}
