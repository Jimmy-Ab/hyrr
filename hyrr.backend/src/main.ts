import * as dotenv from "dotenv"
import * as path from "path"

// Load .env BEFORE any NestJS/Prisma module initializes.
// When run via `npm run start:dev --workspace=hyrr.backend` from the
// monorepo root, CWD is the repo root — not hyrr.backend/ — so we
// resolve the path relative to this file's directory.
dotenv.config({ path: path.resolve(__dirname, "../.env") })

import { ValidationPipe } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { NestExpressApplication } from "@nestjs/platform-express"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { AppModule } from "./app.module"
import { jwtSecret } from "./auth/jwt.config"
import cookieParser = require("cookie-parser")

import { getAllowedOrigins } from "./core/config/origins"
import { AllExceptionsFilter } from "./core/filters/all-exceptions.filter"
import { createRateLimiter } from "./core/http/rate-limit"
import { LoggingInterceptor } from "./core/interceptors/logging.interceptor"

const STRICT_WINDOW_MS = 60_000

async function bootstrap() {
  // Fail fast on an unsafe JWT secret in production (throws), warn in development.
  jwtSecret()

  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // Only trust X-Forwarded-For when explicitly running behind a reverse proxy.
  if (process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1)
  }

  const strictLimit = Number(process.env.RATE_LIMIT_STRICT_PER_MINUTE || 10)
  app.use(
    createRateLimiter({
      windowMs: 60_000,
      defaultLimit: Number(process.env.RATE_LIMIT_PER_MINUTE || 120),
      rules: [
        {
          name: "auth",
          limit: strictLimit,
          windowMs: STRICT_WINDOW_MS,
          matches: (req) =>
            req.method === "POST" && /^\/api\/auth\/(login|register)\/?$/.test(req.path),
        },
        {
          name: "apply",
          limit: strictLimit,
          windowMs: STRICT_WINDOW_MS,
          matches: (req) =>
            req.method === "POST" && /^\/api\/applications\/jobs\/[^/]+\/apply\/?$/.test(req.path),
        },
        {
          name: "ai",
          limit: Number(process.env.RATE_LIMIT_AI_PER_MINUTE || strictLimit),
          windowMs: STRICT_WINDOW_MS,
          // AI chat/settings plus on-demand candidate analysis (each call costs LLM tokens)
          matches: (req) =>
            /^\/api\/ai\//.test(req.path) ||
            (req.method === "POST" && /^\/api\/applications\/[^/]+\/analyze\/?$/.test(req.path)),
        },
      ],
    })
  )

  // Global Centralized Error Filter & Logging Interceptor
  app.useGlobalFilters(new AllExceptionsFilter())
  app.useGlobalInterceptors(new LoggingInterceptor())

  // Enable validation globally for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  )

  // Cookie parser for reading secure refresh token cookies
  app.use(cookieParser())

  // Enable CORS with support for credentials
  app.enableCors({
    origin: getAllowedOrigins(),
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  })

  // Global API route prefix
  app.setGlobalPrefix("api")

  const port = process.env.PORT || 3000
  const swaggerEnabled =
    process.env.NODE_ENV !== "production" || process.env.ENABLE_SWAGGER === "true"
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle("Hyrr API")
      .setDescription("Unified API Documentation for Hyrr Recruiter, Seeker, and Admin dashboards")
      .setVersion("1.0")
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup("api/docs", app, document)
  }

  await app.listen(port)
  console.log(`Application is running on: http://localhost:${port}/api`)
  if (swaggerEnabled)
    console.log(`Swagger docs are available on: http://localhost:${port}/api/docs`)
}
bootstrap()
