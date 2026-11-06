import { ChatOpenAI } from "@langchain/openai"
import { Injectable } from "@nestjs/common"
import { BaseLLMAdapter } from "./base.adapter"

@Injectable()
export class OpenAIAdapter extends BaseLLMAdapter {
  protected createModel(model: string, temperature: number, timeoutMs: number) {
    return new ChatOpenAI({
      model,
      temperature,
      maxRetries: 1,
      timeout: timeoutMs,
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
}
