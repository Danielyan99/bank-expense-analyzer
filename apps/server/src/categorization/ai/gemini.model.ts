import { ApiError, GoogleGenAI, ThinkingLevel } from '@google/genai';
import { z } from 'zod';
import { AiModelError, type AiModel } from './ai-model';
import { AiAnswer } from './prompt';

// Gemini accepts a subset of JSON Schema; drop the "$schema" marker it does not list as supported.
const ANSWER_JSON_SCHEMA: Record<string, unknown> = { ...z.toJSONSchema(AiAnswer, { target: 'draft-7' }) };
delete ANSWER_JSON_SCHEMA.$schema;

/** Google Gemini. The free tier is enough for this demo. */
export class GeminiModel implements AiModel {
  readonly provider = 'gemini' as const;
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    this.client = new GoogleGenAI({ apiKey, httpOptions: { timeout: 40_000 } });
  }

  async classify(system: string, user: string): Promise<AiAnswer> {
    let text: string | undefined;
    try {
      text = await this.request(system, user);
    } catch (error) {
      // Google's free tier sometimes answers 5xx under load; one retry usually succeeds.
      if (!(error instanceof ApiError && error.status >= 500)) throw toModelError(error);
      try {
        text = await this.request(system, user);
      } catch (retryError) {
        throw toModelError(retryError);
      }
    }
    return parseAnswer(text);
  }

  private async request(system: string, user: string): Promise<string | undefined> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: user,
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
        responseJsonSchema: ANSWER_JSON_SCHEMA,
        temperature: 0,
        // Sorting merchant names needs little reasoning; long thinking made requests time out.
        ...(this.model.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
      },
    });
    if (response.promptFeedback?.blockReason) throw new AiModelError('Gemini declined this request.');
    if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') throw new AiModelError('Gemini ran out of output tokens.');
    return response.text;
  }
}

export function parseAnswer(text: string | undefined): AiAnswer {
  if (!text) throw new AiModelError('The model returned an empty answer.');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AiModelError('The model returned invalid JSON.');
  }
  const parsed = AiAnswer.safeParse(json);
  if (!parsed.success) throw new AiModelError('The model returned an answer that did not match the schema.');
  return parsed.data;
}

function toModelError(error: unknown): Error {
  if (error instanceof AiModelError) return error;
  if (error instanceof ApiError) {
    if (error.status === 429) return new AiModelError('The free AI quota is used up for now. Try again later.');
    if (error.status === 400 || error.status === 401 || error.status === 403) {
      return new AiModelError(`Gemini rejected the request (${error.status}). Check the API key and model name.`);
    }
    return new AiModelError(`Gemini API error ${error.status}.`);
  }
  if (error instanceof Error && /timeout|timed out|abort/i.test(error.message)) {
    return new AiModelError('Gemini took too long to answer.');
  }
  return error instanceof Error ? error : new AiModelError('Unknown error.');
}
