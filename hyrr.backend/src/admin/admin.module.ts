import { Module } from "@nestjs/common"
import { AiModule } from "../ai/ai.module"
import { HealthService } from "../health/health.service"
import { AdminCompaniesService } from "./admin-companies.service"
import { AdminModerationService } from "./admin-moderation.service"
import { AdminMoneyService } from "./admin-money.service"
import { AdminStatsService } from "./admin-stats.service"
import { AdminSystemService } from "./admin-system.service"
import { AdminUsersService } from "./admin-users.service"
import { AdminController } from "./admin.controller"
import { AdminGuard } from "./admin.guard"
import { AuditService } from "./audit.service"

/**
 * Admin console API (`/api/admin/*`). Prisma, cache, queue, search, billing, notifications and the
 * core services are global modules; HealthService is provided here for the dashboard health line.
 */
@Module({
  imports: [AiModule],
  controllers: [AdminController],
  providers: [
    AdminGuard,
    AuditService,
    AdminStatsService,
    AdminModerationService,
    AdminUsersService,
    AdminCompaniesService,
    AdminMoneyService,
    AdminSystemService,
    HealthService,
  ],
  exports: [AuditService],
})
export class AdminModule {}
