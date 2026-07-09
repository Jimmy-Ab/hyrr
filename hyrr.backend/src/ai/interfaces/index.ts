import { LLMAdapter, AIMatchResult } from './llm-adapter.interface';

export interface AIFeaturedResult {
  jobId: string;
  score: number;
  summary: string;
}

export { LLMAdapter, AIMatchResult };
