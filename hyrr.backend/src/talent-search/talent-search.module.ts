import { Module } from "@nestjs/common"
import { ApplicationsModule } from "../applications/applications.module"
import { MessagesModule } from "../messages/messages.module"
import { SeekerAiModule } from "../seeker-ai/seeker-ai.module"
import { TalentSearchController } from "./talent-search.controller"
import { TalentSearchService } from "./talent-search.service"

@Module({
  imports: [ApplicationsModule, MessagesModule, SeekerAiModule],
  controllers: [TalentSearchController],
  providers: [TalentSearchService],
})
export class TalentSearchModule {}
