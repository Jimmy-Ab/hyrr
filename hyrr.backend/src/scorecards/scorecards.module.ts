import { Module } from "@nestjs/common"
import { MessagesModule } from "../messages/messages.module"
import { ScorecardsController } from "./scorecards.controller"
import { ScorecardsService } from "./scorecards.service"

@Module({
  imports: [MessagesModule],
  controllers: [ScorecardsController],
  providers: [ScorecardsService],
})
export class ScorecardsModule {}
