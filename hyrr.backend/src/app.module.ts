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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `${__dirname}/../.env`,       // dist/ → hyrr.backend/.env
        `${__dirname}/../../.env`,    // fallback: monorepo root .env
      ],
    }),
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
