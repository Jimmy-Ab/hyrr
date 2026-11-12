import { Global, Module } from "@nestjs/common"
import { ScheduleModule } from "@nestjs/schedule"
import { MessagesModule } from "../messages/messages.module"
import { AlertsScheduler } from "./alerts.scheduler"
import { AlertsService } from "./alerts.service"
import { ExternalApplicationsService } from "./external-applications.service"
import { SavedSearchesService } from "./saved-searches.service"
import {
  AlertsController,
  ExternalApplicationsController,
  SavedSearchesController,
} from "./seeker-tools.controller"

/**
 * Job alerts (CRUD, INSTANT fan-out, DAILY/WEEKLY digests) and saved searches.
 * Global so JobsService can call `AlertsService.onJobPublished` without a module import.
 * Registers the app-wide ScheduleModule (cron) — do not register it a second time.
 */
@Global()
@Module({
  imports: [ScheduleModule.forRoot(), MessagesModule],
  controllers: [AlertsController, SavedSearchesController, ExternalApplicationsController],
  providers: [AlertsService, AlertsScheduler, SavedSearchesService, ExternalApplicationsService],
  exports: [AlertsService],
})
export class SeekerToolsModule {}
