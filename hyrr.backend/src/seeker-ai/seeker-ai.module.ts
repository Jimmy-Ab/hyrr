import { Module } from "@nestjs/common"
import { AiModule } from "../ai/ai.module"
import { SeekerAiController } from "./seeker-ai.controller"
import { SeekerAiService } from "./seeker-ai.service"
import { SkillAssessmentsService } from "./skill-assessments.service"

@Module({
  imports: [AiModule],
  controllers: [SeekerAiController],
  providers: [SeekerAiService, SkillAssessmentsService],
  exports: [SeekerAiService, SkillAssessmentsService],
})
export class SeekerAiModule {}
