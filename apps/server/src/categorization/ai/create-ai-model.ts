import type { AppConfig } from '../../config/configuration';
import type { AiModel } from './ai-model';
import { ClaudeModel } from './claude.model';
import { GeminiModel } from './gemini.model';

/** Picks the provider from config. Returns undefined when no key is set: the app then runs on rules only. */
export function createAiModel(config: AppConfig): AiModel | undefined {
  const { ai } = config;
  if (ai.provider === 'gemini' && ai.geminiApiKey) return new GeminiModel(ai.geminiApiKey, ai.model);
  if (ai.provider === 'claude' && ai.anthropicApiKey) return new ClaudeModel(ai.anthropicApiKey, ai.model);
  return undefined;
}
