import { ChatAnthropic } from "@langchain/anthropic"
import { Injectable } from "@nestjs/common"
import { BaseLLMAdapter } from "./base.adapter"

@Injectable()
export class ClaudeAdapter extends BaseLLMAdapter {
  protected createModel(model: string, temperature: number, timeoutMs: number) {
    return new ChatAnthropic({
      model,
      temperature,
      maxRetries: 1,
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
}
