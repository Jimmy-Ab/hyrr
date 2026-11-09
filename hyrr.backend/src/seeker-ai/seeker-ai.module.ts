import { Module } from "@nestjs/common"
import { AiModule } from "../ai/ai.module"
import { SeekerAiController } from "./seeker-ai.controller"
import { SeekerAiService } from "./seeker-ai.service"

@Module({
  imports: [AiModule],
  controllers: [SeekerAiController],
  providers: [SeekerAiService],
  exports: [SeekerAiService],
})
export class SeekerAiModule {}
