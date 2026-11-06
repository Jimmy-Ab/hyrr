import { Module } from "@nestjs/common"
import { MaintenanceService } from "./maintenance.service"

/** Repeatable housekeeping jobs (PrismaModule and QueueModule are global). */
@Module({ providers: [MaintenanceService] })
export class MaintenanceModule {}
