import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ASSIGNABLE_CATEGORIES, CATEGORY_INFO, type AiStatus, type CategoryId, type Transaction } from '@expense/shared';
import { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { redactForAi } from './merchant';

/** One Claude call handles at most this many distinct merchants; the rest stay uncategorized. */
export const MAX_MERCHANTS_PER_CALL = 80;
const CACHE_LIMIT = 5_000;

const CONFIDENCE_SCORE = { high: 0.9, medium: 0.75, low: 0.55 } as const;

const AiAnswer = z.object({
  results: z.array(
    z.object({
      id: z.number().int(),
      category: z.enum(['unknown', ...ASSIGNABLE_CATEGORIES] as [string, ...string[]]),
      confidence: z.enum(['high', 'medium', 'low']),
      reason: z.string(),
    }),
  ),
});

interface Verdict {
  category: CategoryId;
  confidence: number;
  reason: string;
}

export interface AiOutcome {
  status: AiStatus;
  model?: string;
  message?: string;
  merchantsSent: number;
}

const SYSTEM_PROMPT = [
  'You categorize bank transactions for a personal spending dashboard.',
  'A rule engine has already handled every transaction it recognised. You only see the leftovers:',
  'unusual merchants, cryptic descriptions, local businesses. Use what the name suggests (words like',
  '"coffee", "dental", "florist", a person\'s name, a known brand) and the money direction.',
  '',
  'Categories:',
  ...ASSIGNABLE_CATEGORIES.map((id) => `- ${id}: ${CATEGORY_INFO[id].label} (${CATEGORY_INFO[id].hint})`),
  '- unknown: use this when the description gives no real clue. A wrong guess is worse than "unknown".',
  '',
  'Money in is usually income or transfers, unless it is clearly a refund from a merchant (then use the',
  'merchant\'s category). Payments to or from a person\'s name are usually transfers.',
  'For each item return its id, a category, your confidence, and a reason of at most 10 words.',
].join('\n');

/**
 * The AI step. Only transactions the rules could not settle reach this service, and each
 * distinct merchant is sent once. Only the (redacted) description and the money direction
 * leave the server: never amounts, dates or account details.
 */
@Injectable()
export class AiCategorizerService {
  private readonly logger = new Logger(AiCategorizerService.name);
  private readonly client: Anthropic | undefined;
  /** "direction|merchant" -> verdict. Re-analyzing the sample statement costs no API calls. */
  private readonly cache = new Map<string, Verdict>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.client = config.anthropicApiKey
      ? new Anthropic({ apiKey: config.anthropicApiKey, timeout: 60_000, maxRetries: 1 })
      : undefined;
  }

  get enabled(): boolean {
    return this.client !== undefined;
  }

  /** Fills in category/source on the given transactions (mutates them). */
  async categorize(transactions: Transaction[]): Promise<AiOutcome> {
    if (transactions.length === 0) return { status: 'not-needed', merchantsSent: 0 };
    if (!this.client) {
      return {
        status: 'disabled',
        merchantsSent: 0,
        message: 'No Claude API key on this server, so the leftovers stay uncategorized.',
      };
    }

    const groups = groupByMerchant(transactions);
    const uncached = [...groups.keys()].filter((key) => !this.cache.has(key));
    const toSend = uncached.slice(0, MAX_MERCHANTS_PER_CALL);

    let outcome: AiOutcome = { status: 'ok', model: this.config.aiModel, merchantsSent: toSend.length };
    if (toSend.length > 0) {
      try {
        const verdicts = await this.ask(toSend.map((key) => groups.get(key)![0]));
        toSend.forEach((key, i) => {
          const verdict = verdicts.get(i);
          if (verdict) this.remember(key, verdict);
        });
      } catch (error) {
        outcome = { status: 'error', model: this.config.aiModel, merchantsSent: toSend.length, message: describe(error) };
        this.logger.warn(`Claude call failed: ${outcome.message}`);
      }
    }
    if (uncached.length > toSend.length) {
      outcome.message = `Only the first ${MAX_MERCHANTS_PER_CALL} unknown merchants were sent to Claude.`;
    }

    for (const [key, group] of groups) {
      const verdict = this.cache.get(key);
      if (!verdict || verdict.category === 'uncategorized') continue;
      for (const tx of group) {
        tx.category = verdict.category;
        tx.source = 'ai';
        tx.confidence = verdict.confidence;
        tx.aiReason = verdict.reason;
      }
    }
    return outcome;
  }

  private async ask(items: Transaction[]): Promise<Map<number, Verdict>> {
    const lines = items.map((tx, id) =>
      JSON.stringify({
        id,
        description: redactForAi(tx.description),
        direction: tx.amount < 0 ? 'money out' : 'money in',
        ...(tx.recurring ? { pattern: 'charged monthly, same amount' } : {}),
      }),
    );

    const response = await this.client!.messages.parse({
      model: this.config.aiModel,
      max_tokens: 8_000,
      output_config: { effort: 'low', format: zodOutputFormat(AiAnswer) },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Categorize these transactions:\n${lines.join('\n')}` }],
    });

    if (response.stop_reason === 'refusal') throw new Error('Claude declined this request.');
    if (response.stop_reason === 'max_tokens') throw new Error('Claude ran out of output tokens.');
    const answer = response.parsed_output;
    if (!answer) throw new Error('Claude returned an answer that did not match the schema.');

    const verdicts = new Map<number, Verdict>();
    for (const r of answer.results) {
      if (r.id < 0 || r.id >= items.length) continue;
      verdicts.set(r.id, {
        category: r.category === 'unknown' ? 'uncategorized' : (r.category as CategoryId),
        confidence: CONFIDENCE_SCORE[r.confidence],
        reason: r.reason.slice(0, 120),
      });
    }
    return verdicts;
  }

  private remember(key: string, verdict: Verdict): void {
    if (this.cache.size >= CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, verdict);
  }
}

/**
 * Groups by merchant and money direction: money from a merchant (a refund) and money to it
 * can belong to different categories. The key doubles as the cache key.
 */
function groupByMerchant(transactions: Transaction[]): Map<string, Transaction[]> {
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const key = `${tx.amount < 0 ? 'out' : 'in'}|${tx.merchant}`;
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }
  return groups;
}

function describe(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return 'The Claude API key was rejected.';
  if (error instanceof Anthropic.RateLimitError) return 'Claude is rate-limited right now. Try again in a minute.';
  if (error instanceof Anthropic.APIConnectionTimeoutError) return 'Claude took too long to answer.';
  if (error instanceof Anthropic.APIError) return `Claude API error ${error.status ?? ''}`.trim() + '.';
  return error instanceof Error ? error.message : 'Unknown error.';
}
