import { Injectable } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { LLMAdapter, AIMatchResult } from '../interfaces/llm-adapter.interface';

@Injectable()
export class GeminiAdapter implements LLMAdapter {
  async generateMatch(
    systemPrompt: string,
    temperature: number,
    candidateData: Record<string, any>,
    jobData: Record<string, any>,
  ): Promise<AIMatchResult> {
    const model = new ChatGoogleGenerativeAI({
      model: 'gemini-1.5-pro',
      temperature,
      apiKey: process.env.GOOGLE_AI_API_KEY,
    });

    // If this is a plain chat invocation (message field set, no title)
    if (candidateData.message && !jobData.title) {
      const response = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(candidateData.message),
      ]);
      return { score: 0, summary: (response.content as string) || '' };
    }

    const userContent = this.buildPrompt(candidateData, jobData);
    const response = await model.invoke([
      new SystemMessage(systemPrompt + '\n\nRespond ONLY with a JSON object: {"score": number, "summary": "string"}'),
      new HumanMessage(userContent),
    ]);

    return this.parseResponse(response.content as string);
  }

  private buildPrompt(candidateData: Record<string, any>, jobData: Record<string, any>): string {
    return `
Job Title: ${jobData.title}
Job Requirements: ${(jobData.requirements || []).join(', ')}
Required Skills: ${(jobData.skills || []).join(', ')}
Job Description: ${jobData.description}

Candidate Title: ${candidateData.title}
Candidate Skills: ${(candidateData.skills || []).join(', ')}
Candidate Bio: ${candidateData.bio || ''}
Work Experience: ${JSON.stringify(candidateData.experiences || [])}
Education: ${JSON.stringify(candidateData.educations || [])}
    `.trim();
  }

  private parseResponse(raw: string): AIMatchResult {
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
        summary: String(parsed.summary || ''),
      };
    } catch {
      return { score: 0, summary: raw || 'Failed to parse AI response.' };
    }
  }
}
