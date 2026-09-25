import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { AiProvider, AiStatus, CategoryId, Transaction } from '@expense/shared';
import { AI_MODEL, type AiModel } from './ai/ai-model';
import { buildUserMessage, SYSTEM_PROMPT, type AiItem } from './ai/prompt';
import { redactForAi } from './merchant';

/** One AI call handles at most this many distinct merchants; the rest stay uncategorized. */
export const MAX_MERCHANTS_PER_CALL = 80;
const CACHE_LIMIT = 5_000;

const CONFIDENCE_SCORE = { high: 0.9, medium: 0.75, low: 0.55 } as const;

interface Verdict {
  category: CategoryId;
  confidence: number;
  reason: string;
}

export interface AiOutcome {
  status: AiStatus;
  provider?: AiProvider;
  model?: string;
  message?: string;
  merchantsSent: number;
}

/**
 * The AI step. Only transactions the rules could not settle reach this service, and each
 * distinct merchant is sent once. Only the (redacted) description and the money direction
 * leave the server: never amounts, dates or account details. The provider (Gemini or
 * Claude) is injected, so this class does not know or care which one answers.
 */
@Injectable()
export class AiCategorizerService {
  private readonly logger = new Logger(AiCategorizerService.name);
  /** "direction|merchant" -> verdict. Re-analyzing the sample statement costs no API calls. */
  private readonly cache = new Map<string, Verdict>();

  constructor(@Optional() @Inject(AI_MODEL) private readonly ai?: AiModel) {}

  get enabled(): boolean {
    return this.ai !== undefined;
  }

  get description(): string {
    return this.ai ? `${this.ai.provider} (${this.ai.model})` : 'disabled';
  }

  /** Fills in category/source on the given transactions (mutates them). */
  async categorize(transactions: Transaction[]): Promise<AiOutcome> {
    if (transactions.length === 0) return { status: 'not-needed', merchantsSent: 0 };
    if (!this.ai) {
      return {
        status: 'disabled',
        merchantsSent: 0,
        message: 'No AI key on this server, so the leftovers stay uncategorized.',
      };
    }

    const { provider, model } = this.ai;
    const groups = groupByMerchant(transactions);
    const uncached = [...groups.keys()].filter((key) => !this.cache.has(key));
    const toSend = uncached.slice(0, MAX_MERCHANTS_PER_CALL);

    let outcome: AiOutcome = { status: 'ok', provider, model, merchantsSent: toSend.length };
    if (toSend.length > 0) {
      try {
        const verdicts = await this.ask(toSend.map((key) => groups.get(key)![0]));
        toSend.forEach((key, i) => {
          const verdict = verdicts.get(i);
          if (verdict) this.remember(key, verdict);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error.';
        outcome = { status: 'error', provider, model, merchantsSent: toSend.length, message };
        this.logger.warn(`AI call failed: ${message}`);
      }
    }
    if (uncached.length > toSend.length) {
      outcome.message = `Only the first ${MAX_MERCHANTS_PER_CALL} unknown merchants were sent to the AI.`;
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
    const payload: AiItem[] = items.map((tx, id) => ({
      id,
      description: redactForAi(tx.description),
      direction: tx.amount < 0 ? 'money out' : 'money in',
      ...(tx.recurring ? { pattern: 'charged monthly, same amount' } : {}),
    }));

    const answer = await this.ai!.classify(SYSTEM_PROMPT, buildUserMessage(payload));

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
