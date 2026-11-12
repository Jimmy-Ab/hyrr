import { Injectable, Logger, Optional } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { ClaudeAdapter } from "./adapters/claude.adapter"
import { GeminiAdapter } from "./adapters/gemini.adapter"
import { OpenAIAdapter } from "./adapters/openai.adapter"
import { estimateCost, estimateTokens, featureOf } from "./ai-usage"
import { providerFor } from "./ai.models"
import { LLMAdapter } from "./interfaces/llm-adapter.interface"

@Injectable()
export class AiFactory {
  constructor(
    private gemini: GeminiAdapter,
    private openai: OpenAIAdapter,
    private claude: ClaudeAdapter,
    @Optional() private prisma?: PrismaService
  ) {}

  private readonly logger = new Logger(AiFactory.name)

  private raw(modelName: string): LLMAdapter {
    switch (providerFor(modelName)) {
      case "claude":
        return this.claude
      case "openai":
        return this.openai
      default:
        return this.gemini
    }
  }

  /** The provider adapter, wrapped so every call is timed and logged to AiUsage (best effort). */
  getAdapter(modelName: string): LLMAdapter {
    const adapter = this.raw(modelName)
    if (!this.prisma) return adapter
    const provider = providerFor(modelName)
    return new Proxy(adapter, {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver)
        if (typeof value !== "function" || typeof prop !== "string") return value
        return async (...args: unknown[]) => {
          const started = Date.now()
          const inputTokens = estimateTokens(
            args.filter((a) => typeof a === "string" || typeof a === "object")
          )
          let ok = false
          let output: unknown = null
          try {
            output = await value.apply(target, args)
            ok = true
            return output
          } finally {
            const outputTokens = ok ? estimateTokens(output) : 0
            await this.prisma!.aiUsage.create({
              data: {
                provider,
                model: modelName,
                feature: featureOf(prop, args),
                ok,
                latencyMs: Date.now() - started,
                inputTokens,
                outputTokens,
                costUsd: estimateCost(modelName, inputTokens, outputTokens),
              },
            }).catch((err: any) => this.logger.warn(`AI usage log failed: ${err?.message}`))
          }
        }
      },
    })
  }
}
