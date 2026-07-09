import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiFactory } from './ai.factory';
import { GeminiAdapter } from './adapters/gemini.adapter';
import { OpenAIAdapter } from './adapters/openai.adapter';
import { ClaudeAdapter } from './adapters/claude.adapter';

@Module({
  controllers: [AiController],
  providers: [AiService, AiFactory, GeminiAdapter, OpenAIAdapter, ClaudeAdapter],
  exports: [AiService],
})
export class AiModule {}
