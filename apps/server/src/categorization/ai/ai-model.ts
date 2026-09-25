import type { AiProvider } from '@expense/shared';
import type { AiAnswer } from './prompt';

/** One provider (Gemini, Claude, ...) behind a single method. */
export interface AiModel {
  readonly provider: AiProvider;
  readonly model: string;
  /** Sends the prompt and returns an answer already validated against the AiAnswer schema. */
  classify(system: string, user: string): Promise<AiAnswer>;
}

/** A failure the UI can show as-is ("rate-limited", "key rejected", ...). */
export class AiModelError extends Error {}

export const AI_MODEL = Symbol('AI_MODEL');
