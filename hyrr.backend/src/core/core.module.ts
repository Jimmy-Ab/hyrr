import { Global, Module } from "@nestjs/common"
import { AccessService } from "./access/access.service"
import { EmailDeliveryService } from "./delivery/email-delivery.service"
import { LoggerService } from "./logger/logger.service"

@Global()
@Module({
  providers: [LoggerService, AccessService, EmailDeliveryService],
  exports: [LoggerService, AccessService, EmailDeliveryService],
})
export class CoreModule {}
