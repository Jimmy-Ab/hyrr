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
import cookieParser = require('cookie-parser');

import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';
import { LoggingInterceptor } from './core/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Lightweight process-local abuse protection. Use a shared Redis store when the API is scaled horizontally.
  const requests = new Map<string, { count: number; resetAt: number }>();
  app.use((req: any, res: any, next: any) => {
    if (req.method === 'OPTIONS') return next();
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = requests.get(key);
    const current = !bucket || bucket.resetAt <= now ? { count: 0, resetAt: now + 60_000 } : bucket;
    current.count += 1;
    requests.set(key, current);
    if (current.count > Number(process.env.RATE_LIMIT_PER_MINUTE || 120)) {
      return res.status(429).json({ success: false, message: 'Too many requests. Please try again shortly.' });
    }
    next();
  });

  // Global Centralized Error Filter & Logging Interceptor
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Enable validation globally for DTOs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Cookie parser for reading secure refresh token cookies
  app.use(cookieParser());

  // Enable CORS with support for credentials
  app.enableCors({
    origin: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:5175').split(','),
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
