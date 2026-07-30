import { Injectable } from "@nestjs/common"
import { ClaudeAdapter } from "./adapters/claude.adapter"
import { GeminiAdapter } from "./adapters/gemini.adapter"
import { OpenAIAdapter } from "./adapters/openai.adapter"
import { LLMAdapter } from "./interfaces/llm-adapter.interface"

@Injectable()
export class AiFactory {
  constructor(
    private gemini: GeminiAdapter,
    private openai: OpenAIAdapter,
    private claude: ClaudeAdapter
  ) {}

  getAdapter(modelName: string): LLMAdapter {
    if (modelName.startsWith("gemini")) return this.gemini
    if (modelName.startsWith("gpt")) return this.openai
    if (modelName.startsWith("claude")) return this.claude
    // Default fallback
    return this.gemini
  }
}
