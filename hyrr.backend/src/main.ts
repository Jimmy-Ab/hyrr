// Must stay the first import: loads .env and initialises Sentry (when SENTRY_DSN is set) before
// any NestJS/Prisma module is loaded. The .env path is resolved relative to this file because
// `npm run start:dev --workspace=hyrr.backend` runs with the monorepo root as CWD.
import "./instrument"

import { ValidationPipe } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { NestExpressApplication } from "@nestjs/platform-express"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import helmet from "helmet"
import Redis from "ioredis"
import { AppModule } from "./app.module"
import { jwtSecret } from "./auth/jwt.config"
import cookieParser = require("cookie-parser")

import { getAllowedOrigins } from "./core/config/origins"
import { AllExceptionsFilter } from "./core/filters/all-exceptions.filter"
import {
  createRateLimiter,
  RateLimitStore,
  RedisRateLimitStore,
  STRICT_AUTH_PATH,
} from "./core/http/rate-limit"
import { isHealthPath, requestIdMiddleware } from "./core/http/request-id"
import { LoggingInterceptor } from "./core/interceptors/logging.interceptor"
import { RedisIoAdapter } from "./core/realtime/redis-io.adapter"
import { isRedisConfigured, redisOptions } from "./core/redis/redis-options"
import { validationException } from "./core/validation/validation-errors"

const STRICT_WINDOW_MS = 60_000
const BILLING_WEBHOOK_PATH = /^\/api\/billing\/webhooks\//
/** Admin console: its own per-IP bucket (RATE_LIMIT_ADMIN_PER_MINUTE, default 300/min). */
const ADMIN_PATH = /^\/api\/admin(\/|$)/

/**
 * Shared rate-limit counters when Redis is configured. The client never queues commands while
 * disconnected: the store sees `status !== "ready"` and fails open to in-memory limits.
 */
function redisRateLimitStore(): RateLimitStore | undefined {
  if (!isRedisConfigured()) return undefined
  const client = new Redis(
    redisOptions({
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 500, 5_000),
    })
  )
  client.on("error", () => {
    /* logged (throttled) by the store when a request falls back */
  })
  return new RedisRateLimitStore(client)
}

async function bootstrap() {
  // Fail fast on an unsafe JWT secret in production (throws), warn in development.
  jwtSecret()

  // rawBody: payment webhooks (Stripe/Chapa) verify signatures over the exact request bytes;
  // Nest keeps them on `req.rawBody` next to the parsed JSON body.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true })
  app.enableShutdownHooks()
  // Safety net: a client stuck reconnecting to an unreachable Redis must never block shutdown.
  for (const signal of ["SIGTERM", "SIGINT"] as const)
    process.once(signal, () => setTimeout(() => process.exit(0), 8_000).unref())

  // Only trust X-Forwarded-For when explicitly running behind a reverse proxy.
  if (process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1)
  }

  app.use(requestIdMiddleware)

  // Security headers. The API serves JSON + uploads consumed cross-origin by the SPAs, so
  // resources may be embedded cross-origin; Swagger UI (dev) gets a relaxed CSP.
  const apiHelmet = helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } })
  const docsHelmet = helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
  app.use((req: any, res: any, next: any) =>
    (/^\/api\/docs(\/|-json|$)/.test(req.path) ? docsHelmet : apiHelmet)(req, res, next)
  )

  const strictLimit = Number(process.env.RATE_LIMIT_STRICT_PER_MINUTE || 10)
  const rateLimitStore = redisRateLimitStore()
  // Admin routes are counted only by the admin limiter below.
  app.use(
    createRateLimiter({
      store: rateLimitStore,
      skip: (req) => !ADMIN_PATH.test(req.path),
      windowMs: 60_000,
      defaultLimit: Number(process.env.RATE_LIMIT_ADMIN_PER_MINUTE || 300),
      rules: [],
    })
  )
  app.use(
    createRateLimiter({
      // Health probes and provider webhooks (signature-verified; providers retry on 429).
      store: rateLimitStore,
      skip: (req) =>
        isHealthPath(req.path) || BILLING_WEBHOOK_PATH.test(req.path) || ADMIN_PATH.test(req.path),
      windowMs: 60_000,
      defaultLimit: Number(process.env.RATE_LIMIT_PER_MINUTE || 120),
      rules: [
        {
          name: "auth",
          limit: strictLimit,
          windowMs: STRICT_WINDOW_MS,
          matches: (req) => req.method === "POST" && STRICT_AUTH_PATH.test(req.path),
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
            /^\/api\/(ai\/|profile\/import-cv\/?$)/.test(req.path) ||
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
      // 400 VALIDATION_FAILED + per-field `fields` map for inline form errors.
      exceptionFactory: validationException,
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

  // Socket.io: fan out room emits across instances through Redis when configured.
  if (isRedisConfigured()) {
    const ioAdapter = new RedisIoAdapter(app)
    await ioAdapter.connectToRedis()
    app.useWebSocketAdapter(ioAdapter)
  }

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
