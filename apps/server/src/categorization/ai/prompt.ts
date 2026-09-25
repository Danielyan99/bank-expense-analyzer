import { ASSIGNABLE_CATEGORIES, CATEGORY_INFO } from '@expense/shared';
import { z } from 'zod';

/**
 * The prompt and answer schema are shared by every provider, so switching models
 * never changes what is asked or what counts as a valid answer.
 */
export const AiAnswer = z.object({
  results: z.array(
    z.object({
      id: z.number().int().min(0).max(999),
      category: z.enum(['unknown', ...ASSIGNABLE_CATEGORIES] as [string, ...string[]]),
      confidence: z.enum(['high', 'medium', 'low']),
      reason: z.string(),
    }),
  ),
});

export type AiAnswer = z.infer<typeof AiAnswer>;

export const SYSTEM_PROMPT = [
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
  "merchant's category). Payments to or from a person's name are usually transfers.",
  'For each item return its id, a category, your confidence, and a reason of at most 10 words.',
].join('\n');

export interface AiItem {
  id: number;
  description: string;
  direction: 'money in' | 'money out';
  pattern?: string;
}

export function buildUserMessage(items: AiItem[]): string {
  return `Categorize these transactions:\n${items.map((item) => JSON.stringify(item)).join('\n')}`;
}
