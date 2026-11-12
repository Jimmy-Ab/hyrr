import { Module } from "@nestjs/common"
import { MessagesModule } from "../messages/messages.module"
import { CalendarController } from "./calendar.controller"
import { CalendarService } from "./calendar.service"
import { InterviewInvitesService } from "./interview-invites.service"

@Module({
  imports: [MessagesModule],
  controllers: [CalendarController],
  providers: [CalendarService, InterviewInvitesService],
  exports: [CalendarService],
})
export class CalendarModule {}
