import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env BEFORE any NestJS/Prisma module initializes.
// When run via `npm run start:dev --workspace=hyrr.backend` from the
// monorepo root, CWD is the repo root — not hyrr.backend/ — so we
// resolve the path relative to this file's directory.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation globally for DTOs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Cookie parser for reading secure refresh token cookies
  app.use(cookieParser());

  // Enable CORS with support for credentials
  app.enableCors({
    origin: [
      'http://localhost:5173', // Recruiter app
      'http://localhost:5174', // Seeker app
      'http://localhost:5175', // Admin app
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global API route prefix
  app.setGlobalPrefix('api');

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Hyrr API')
    .setDescription('Unified API Documentation for Hyrr Recruiter, Seeker, and Admin dashboards')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api`);
  console.log(`Swagger docs are available on: http://localhost:${port}/api/docs`);
}
bootstrap();
