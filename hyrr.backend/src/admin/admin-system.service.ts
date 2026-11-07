import { Injectable } from "@nestjs/common"
import { apiKeyFor, resolveActiveModel } from "../ai/ai.models"
import { StripeProvider } from "../billing/providers/stripe.provider"
import { isRedisConfigured } from "../core/redis/redis-options"
import { embeddingsEnabled } from "../embeddings/embeddings.service"
import { PrismaService } from "../prisma/prisma.service"

const present = (name: string) => !!process.env[name]?.trim()

/** Which integrations are configured. Presence only: never returns a key or secret value. */
@Injectable()
export class AdminSystemService {
  constructor(private readonly prisma: PrismaService) {}

  async system() {
    const setting = await this.prisma.systemSetting
      .findUnique({ where: { id: "global-settings" }, select: { activeModel: true } })
      .catch(() => null)
    const chapaKey = process.env.CHAPA_SECRET_KEY?.trim()
    const storageDriver = (process.env.STORAGE_DRIVER || "local").trim().toLowerCase()
    return {
      ai: {
        providers: {
          openai: !!apiKeyFor("openai"),
          anthropic: !!apiKeyFor("claude"),
          google: !!apiKeyFor("gemini"),
        },
        activeModel: resolveActiveModel(setting?.activeModel)?.model ?? null,
        embeddings: embeddingsEnabled(),
      },
      email: present("SMTP_HOST"),
      payments: {
        stripe: new StripeProvider().isConfigured(),
        chapa: !!chapaKey && !chapaKey.endsWith("..."),
      },
      storage:
        storageDriver === "s3" && present("S3_BUCKET") ? ("s3" as const) : ("local" as const),
      search: present("MEILI_HOST") ? ("meili" as const) : ("postgres" as const),
      queues: isRedisConfigured() ? ("bullmq" as const) : ("inline" as const),
      captcha: present("TURNSTILE_SECRET_KEY"),
      sentry: present("SENTRY_DSN"),
    }
  }
}
