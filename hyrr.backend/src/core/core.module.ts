import { Module, Global } from '@nestjs/common';
import { LoggerService } from './logger/logger.service';
import { AccessService } from './access/access.service';
import { EmailDeliveryService } from './delivery/email-delivery.service';

@Global()
@Module({
  providers: [LoggerService, AccessService, EmailDeliveryService],
  exports: [LoggerService, AccessService, EmailDeliveryService],
})
export class CoreModule {}
