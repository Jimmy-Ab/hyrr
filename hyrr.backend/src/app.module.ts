import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JobsModule } from './jobs/jobs.module';
import { ApplicationsModule } from './applications/applications.module';
import { MessagesModule } from './messages/messages.module';
import { DocumentsModule } from './documents/documents.module';
import { CalendarModule } from './calendar/calendar.module';
import { AiModule } from './ai/ai.module';
import { ProfileModule } from './profile/profile.module';
import { CacheModule } from './cache/cache.module';

import { CoreModule } from './core/core.module';
import { UploadsModule } from './uploads/uploads.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `${__dirname}/../.env`,
        `${__dirname}/../../.env`,
      ],
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
    AiModule,
    ProfileModule,
  ],
})
export class AppModule {}
