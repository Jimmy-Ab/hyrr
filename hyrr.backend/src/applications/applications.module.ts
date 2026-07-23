import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { AiModule } from '../ai/ai.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [AiModule, MessagesModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
