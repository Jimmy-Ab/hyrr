import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { Injectable } from "@nestjs/common"
import { BaseLLMAdapter } from "./base.adapter"

@Injectable()
export class GeminiAdapter extends BaseLLMAdapter {
  protected createModel(model: string, temperature: number, timeoutMs: number) {
    return new ChatGoogleGenerativeAI({
      model,
      temperature,
      maxRetries: 1,
      apiKey: process.env.GOOGLE_AI_API_KEY,
    })
  }
}
