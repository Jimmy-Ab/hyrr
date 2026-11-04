import { Module } from "@nestjs/common"
import { MessagesModule } from "../messages/messages.module"
import { UploadsModule } from "../uploads/uploads.module"
import { ClaudeAdapter } from "./adapters/claude.adapter"
import { GeminiAdapter } from "./adapters/gemini.adapter"
import { OpenAIAdapter } from "./adapters/openai.adapter"
import { AiController } from "./ai.controller"
import { AiFactory } from "./ai.factory"
import { AiService } from "./ai.service"

@Module({
  imports: [MessagesModule, UploadsModule],
  controllers: [AiController],
  providers: [AiService, AiFactory, GeminiAdapter, OpenAIAdapter, ClaudeAdapter],
  exports: [AiService],
})
export class AiModule {}
