import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { AdminModule } from "./admin/admin.module"
import { AiModule } from "./ai/ai.module"
import { ApplicationsModule } from "./applications/applications.module"
import { AuthModule } from "./auth/auth.module"
import { BillingModule } from "./billing/billing.module"
import { CacheModule } from "./cache/cache.module"
import { CalendarModule } from "./calendar/calendar.module"
import { DashboardModule } from "./dashboard/dashboard.module"
import { DocumentsModule } from "./documents/documents.module"
import { EmbeddingsModule } from "./embeddings/embeddings.module"
import { JobsModule } from "./jobs/jobs.module"
import { MaintenanceModule } from "./maintenance/maintenance.module"
import { MatchingModule } from "./matching/matching.module"
import { MessagesModule } from "./messages/messages.module"
import { PipelineModule } from "./pipeline/pipeline.module"
import { PrismaModule } from "./prisma/prisma.module"
import { ProfileModule } from "./profile/profile.module"
import { QueueModule } from "./queue/queue.module"
import { SearchModule } from "./search/search.module"
import { SeekerToolsModule } from "./seeker-tools/seeker-tools.module"
import { SettingsModule } from "./settings/settings.module"
import { TalentModule } from "./talent/talent.module"
import { TeamModule } from "./team/team.module"

import { CoreModule } from "./core/core.module"
import { SecurityModule } from "./core/security/security.module"
import { VerificationModule } from "./core/verification/verification.module"
import { HealthModule } from "./health/health.module"
import { NotificationsModule } from "./notifications/notifications.module"
import { UploadsModule } from "./uploads/uploads.module"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`${__dirname}/../.env`, `${__dirname}/../../.env`],
    }),
    CoreModule,
    SecurityModule,
    VerificationModule,
    HealthModule,
    UploadsModule,
    NotificationsModule,
    CacheModule,
    PrismaModule,
    QueueModule,
    MaintenanceModule,
    BillingModule,
    AuthModule,
    SearchModule,
    JobsModule,
    ApplicationsModule,
    PipelineModule,
    MessagesModule,
    DocumentsModule,
    CalendarModule,
    DashboardModule,
    AiModule,
    ProfileModule,
    MatchingModule,
    EmbeddingsModule,
    SeekerToolsModule,
    SettingsModule,
    TalentModule,
    TeamModule,
    AdminModule,
  ],
})
export class AppModule {}
