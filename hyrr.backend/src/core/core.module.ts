import { Global, Module } from "@nestjs/common"
import { AccessService } from "./access/access.service"
import { EmailDeliveryService } from "./delivery/email-delivery.service"
import { EmailService } from "./delivery/email.service"
import { LoggerService } from "./logger/logger.service"

@Global()
@Module({
  providers: [LoggerService, AccessService, EmailService, EmailDeliveryService],
  exports: [LoggerService, AccessService, EmailService, EmailDeliveryService],
})
export class CoreModule {}
