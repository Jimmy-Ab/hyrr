import { Global, Module } from "@nestjs/common"
import { ScheduleModule } from "@nestjs/schedule"
import { MessagesModule } from "../messages/messages.module"
import { AlertsScheduler } from "./alerts.scheduler"
import { AlertsService } from "./alerts.service"
import { SavedSearchesService } from "./saved-searches.service"
import { AlertsController, SavedSearchesController } from "./seeker-tools.controller"

/**
 * Job alerts (CRUD, INSTANT fan-out, DAILY/WEEKLY digests) and saved searches.
 * Global so JobsService can call `AlertsService.onJobPublished` without a module import.
 * Registers the app-wide ScheduleModule (cron) — do not register it a second time.
 */
@Global()
@Module({
  imports: [ScheduleModule.forRoot(), MessagesModule],
  controllers: [AlertsController, SavedSearchesController],
  providers: [AlertsService, AlertsScheduler, SavedSearchesService],
  exports: [AlertsService],
})
export class SeekerToolsModule {}
