import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { AiModule } from "./ai/ai.module"
import { ApplicationsModule } from "./applications/applications.module"
import { AuthModule } from "./auth/auth.module"
import { CacheModule } from "./cache/cache.module"
import { CalendarModule } from "./calendar/calendar.module"
import { DashboardModule } from "./dashboard/dashboard.module"
import { DocumentsModule } from "./documents/documents.module"
import { JobsModule } from "./jobs/jobs.module"
import { MessagesModule } from "./messages/messages.module"
import { PrismaModule } from "./prisma/prisma.module"
import { ProfileModule } from "./profile/profile.module"
import { SettingsModule } from "./settings/settings.module"
import { TalentModule } from "./talent/talent.module"

import { CoreModule } from "./core/core.module"
import { NotificationsModule } from "./notifications/notifications.module"
import { UploadsModule } from "./uploads/uploads.module"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`${__dirname}/../.env`, `${__dirname}/../../.env`],
    }),
    CoreModule,
    UploadsModule,
    NotificationsModule,
    CacheModule,
    PrismaModule,
    AuthModule,
    JobsModule,
    ApplicationsModule,
    MessagesModule,
    DocumentsModule,
    CalendarModule,
    DashboardModule,
    AiModule,
    ProfileModule,
    SettingsModule,
    TalentModule,
  ],
})
export class AppModule {}
