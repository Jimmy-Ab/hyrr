import { Injectable } from "@nestjs/common"
import { ClaudeAdapter } from "./adapters/claude.adapter"
import { GeminiAdapter } from "./adapters/gemini.adapter"
import { OpenAIAdapter } from "./adapters/openai.adapter"
import { providerFor } from "./ai.models"
import { LLMAdapter } from "./interfaces/llm-adapter.interface"

@Injectable()
export class AiFactory {
  constructor(
    private gemini: GeminiAdapter,
    private openai: OpenAIAdapter,
    private claude: ClaudeAdapter
  ) {}

  getAdapter(modelName: string): LLMAdapter {
    switch (providerFor(modelName)) {
      case "claude":
        return this.claude
      case "openai":
        return this.openai
      default:
        return this.gemini
    }
  }
}
