import { CATEGORY_INFO, type CategoryId } from '@expense/shared';

/**
 * One colour per spending category. These are the eight dark-mode steps of a palette
 * validated for colour-blind separation on the card surface (#121821); each category keeps
 * its colour everywhere (chart, table, list), and a text label always sits next to it.
 * Neutral buckets are greys, so they never compete with real spending.
 */
export const CATEGORY_COLOR: Record<CategoryId, string> = {
  housing: '#3987e5',
  dining: '#d95926',
  groceries: '#199e70',
  transport: '#c98500',
  shopping: '#d55181',
  health: '#008300',
  subscriptions: '#9085e9',
  leisure: '#e66767',
  income: '#8b9aab',
  transfers: '#5b6b7c',
  other: '#6f7a86',
  uncategorized: '#3a4552',
};

export function categoryLabel(id: CategoryId): string {
  return CATEGORY_INFO[id].label;
}

/** Plain-English version of a rule id such as "merchant:NETFLIX" or "signal:recurring". */
export function describeRule(ruleId: string | undefined): string {
  if (!ruleId) return 'Rule';
  const [kind, value] = ruleId.split(/:(.*)/s);
  switch (kind) {
    case 'merchant':
      return `Known merchant: ${value}`;
    case 'keyword':
      return `Keyword: ${value}`;
    case 'signal':
      return 'Same small amount charged every month';
    case 'pattern':
      return `Pattern: ${value.replace(/-/g, ' ')}`;
    default:
      return ruleId;
  }
}
