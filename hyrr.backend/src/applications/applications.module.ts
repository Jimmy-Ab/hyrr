import { Module } from "@nestjs/common"
import { AiModule } from "../ai/ai.module"
import { MessagesModule } from "../messages/messages.module"
import { PipelineModule } from "../pipeline/pipeline.module"
import { UploadsModule } from "../uploads/uploads.module"
import { ApplicationsController } from "./applications.controller"
import { ApplicationsService } from "./applications.service"

@Module({
  imports: [AiModule, MessagesModule, UploadsModule, PipelineModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
