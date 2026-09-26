import type { AiProvider } from '@expense/shared';

export interface AppConfig {
  port: number;
  ai: {
    provider: AiProvider;
    model: string;
    geminiApiKey: string | undefined;
    anthropicApiKey: string | undefined;
  };
  corsOrigins: string[];
  /** Upload size limit in bytes. */
  maxUploadBytes: number;
  /** Requests per minute per IP for the analyze endpoints (each can trigger an AI call). */
  rateLimitPerMinute: number;
}

const DEFAULT_MODEL: Record<AiProvider, string> = {
  gemini: 'gemini-3.5-flash',
  claude: 'claude-opus-5',
};

function int(value: string | undefined, fallback: number, min: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) throw new Error(`Config value ${value} is below the minimum of ${min}`);
  return parsed;
}

function pickProvider(env: NodeJS.ProcessEnv): AiProvider {
  const explicit = env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === 'gemini' || explicit === 'claude') return explicit;
  if (explicit) throw new Error(`AI_PROVIDER must be "gemini" or "claude", got "${explicit}"`);
  // Not set: use whichever key exists, Gemini (free tier) first.
  return !env.GEMINI_API_KEY?.trim() && env.ANTHROPIC_API_KEY?.trim() ? 'claude' : 'gemini';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const provider = pickProvider(env);
  return {
    port: int(env.PORT, 3000, 1),
    ai: {
      provider,
      model: env.AI_MODEL?.trim() || DEFAULT_MODEL[provider],
      geminiApiKey: env.GEMINI_API_KEY?.trim() || undefined,
      anthropicApiKey: env.ANTHROPIC_API_KEY?.trim() || undefined,
    },
    // Browsers send the origin without a trailing slash; forgive one pasted from the address bar.
    corsOrigins: (env.CORS_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean),
    maxUploadBytes: int(env.MAX_UPLOAD_KB, 1024, 1) * 1024,
    rateLimitPerMinute: int(env.RATE_LIMIT_PER_MINUTE, 10, 1),
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
