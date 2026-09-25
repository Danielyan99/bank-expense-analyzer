export interface AppConfig {
  port: number;
  anthropicApiKey: string | undefined;
  aiModel: string;
  corsOrigins: string[];
  /** Upload size limit in bytes. */
  maxUploadBytes: number;
  /** Requests per minute per IP for the analyze endpoints (each can trigger a Claude call). */
  rateLimitPerMinute: number;
}

function int(value: string | undefined, fallback: number, min: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) throw new Error(`Config value ${value} is below the minimum of ${min}`);
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: int(env.PORT, 3000, 1),
    anthropicApiKey: env.ANTHROPIC_API_KEY?.trim() || undefined,
    aiModel: env.AI_MODEL?.trim() || 'claude-opus-5',
    corsOrigins: (env.CORS_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    maxUploadBytes: int(env.MAX_UPLOAD_KB, 1024, 1) * 1024,
    rateLimitPerMinute: int(env.RATE_LIMIT_PER_MINUTE, 10, 1),
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
