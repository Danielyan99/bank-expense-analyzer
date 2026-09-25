import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { AiModelError, type AiModel } from './ai-model';
import { AiAnswer } from './prompt';

/** Anthropic Claude. Optional: used only when AI_PROVIDER=claude and ANTHROPIC_API_KEY are set. */
export class ClaudeModel implements AiModel {
  readonly provider = 'claude' as const;
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
  }

  async classify(system: string, user: string): Promise<AiAnswer> {
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 8_000,
        output_config: { effort: 'low', format: zodOutputFormat(AiAnswer) },
        system,
        messages: [{ role: 'user', content: user }],
      });
      if (response.stop_reason === 'refusal') throw new AiModelError('Claude declined this request.');
      if (response.stop_reason === 'max_tokens') throw new AiModelError('Claude ran out of output tokens.');
      if (!response.parsed_output) throw new AiModelError('Claude returned an answer that did not match the schema.');
      return response.parsed_output;
    } catch (error) {
      throw toModelError(error);
    }
  }
}

function toModelError(error: unknown): Error {
  if (error instanceof AiModelError) return error;
  if (error instanceof Anthropic.AuthenticationError) return new AiModelError('The Claude API key was rejected.');
  if (error instanceof Anthropic.RateLimitError) return new AiModelError('Claude is rate-limited right now. Try again in a minute.');
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new AiModelError('Claude took too long to answer.');
  if (error instanceof Anthropic.APIError) return new AiModelError(`Claude API error ${error.status ?? ''}`.trim() + '.');
  return error instanceof Error ? error : new AiModelError('Unknown error.');
}
