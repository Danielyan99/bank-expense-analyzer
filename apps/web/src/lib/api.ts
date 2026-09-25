import type { AnalysisResult } from '@expense/shared';
import { SERVER_URL } from '../config';

export class ApiError extends Error {}

async function handle(response: Response): Promise<AnalysisResult> {
  if (response.ok) return (await response.json()) as AnalysisResult;
  let message = `The server answered ${response.status}.`;
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (body.message) message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
  } catch {
    // Not JSON: keep the generic message.
  }
  if (response.status === 413) message = 'The file is too large. The limit is 1 MB.';
  if (response.status === 429) message = 'Too many requests. Please wait a minute and try again.';
  throw new ApiError(message);
}

async function send(path: string, init: RequestInit): Promise<AnalysisResult> {
  let response: Response;
  try {
    response = await fetch(`${SERVER_URL}${path}`, { method: 'POST', ...init });
  } catch {
    throw new ApiError('Could not reach the server. It may still be waking up; try again in a few seconds.');
  }
  return handle(response);
}

export function analyzeSample(): Promise<AnalysisResult> {
  return send('/api/statements/sample', {});
}

export function analyzeFile(file: File): Promise<AnalysisResult> {
  const body = new FormData();
  body.append('file', file);
  return send('/api/statements/analyze', { body });
}

/**
 * The API runs on a free host that sleeps when idle. Ping it as soon as the page opens,
 * so it is usually awake by the time someone clicks a button.
 */
export async function wakeServer(): Promise<{ ai: boolean }> {
  const response = await fetch(`${SERVER_URL}/health`);
  const body = (await response.json()) as { ai?: string };
  return { ai: body.ai === 'enabled' };
}
