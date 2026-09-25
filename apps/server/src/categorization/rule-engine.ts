import type { Transaction } from '@expense/shared';
import type { RawTransaction } from '../parsing/csv-statement.parser';
import { normalizeMerchant } from './merchant';
import { RULES, type Rule } from './rules';

/** Below this, a rule's guess is not trusted and the transaction goes to Claude instead. */
export const CONFIDENCE_THRESHOLD = 0.7;

/** Small recurring charges from an unknown merchant are almost always subscriptions. */
const SUBSCRIPTION_MAX_AMOUNT = 60;

export interface RuleEngineResult {
  transactions: Transaction[];
  /** Indexes of transactions the rules could not settle. */
  unresolved: number[];
}

export function matchRule(description: string, amount: number): Rule | undefined {
  const text = description.toUpperCase();
  const direction = amount < 0 ? 'out' : 'in';
  return RULES.find((r) => (!r.direction || r.direction === direction) && r.pattern.test(text));
}

export function categorizeWithRules(rows: RawTransaction[]): RuleEngineResult {
  const recurringMerchants = findRecurringMerchants(rows);
  const unresolved: number[] = [];

  const transactions = rows.map((row, index): Transaction => {
    const merchant = normalizeMerchant(row.description);
    const recurring = recurringMerchants.has(merchant);
    const base = {
      id: `t${index + 1}`,
      date: row.date,
      description: row.description,
      merchant,
      amount: row.amount,
      ...(recurring ? { recurring } : {}),
    };

    const matched = matchRule(row.description, row.amount);
    if (matched && matched.confidence >= CONFIDENCE_THRESHOLD) {
      return { ...base, category: matched.category, source: 'rule', confidence: matched.confidence, ruleId: matched.id };
    }

    // Signal-based rule: an unknown merchant charging a small, steady amount every month.
    if (recurring && row.amount < 0 && Math.abs(row.amount) <= SUBSCRIPTION_MAX_AMOUNT) {
      return { ...base, category: 'subscriptions', source: 'rule', confidence: 0.75, ruleId: 'signal:recurring' };
    }

    unresolved.push(index);
    return { ...base, category: 'uncategorized', source: 'none', confidence: 0 };
  });

  return { transactions, unresolved };
}

/**
 * A merchant is "recurring" when it charges at least 3 times, roughly a month apart
 * (25-35 days), with amounts within 10% of each other. This is how a subscription or a
 * rent payment looks, whatever the merchant is called.
 */
export function findRecurringMerchants(rows: RawTransaction[]): Set<string> {
  const byMerchant = new Map<string, RawTransaction[]>();
  for (const row of rows) {
    if (row.amount >= 0) continue;
    const key = normalizeMerchant(row.description);
    const list = byMerchant.get(key) ?? [];
    list.push(row);
    byMerchant.set(key, list);
  }

  const recurring = new Set<string>();
  for (const [merchant, list] of byMerchant) {
    if (list.length < 3) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const gaps = sorted.slice(1).map((row, i) => daysBetween(sorted[i].date, row.date));
    const monthly = gaps.every((g) => g >= 25 && g <= 35);
    const amounts = sorted.map((r) => Math.abs(r.amount));
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const steady = amounts.every((a) => Math.abs(a - mean) <= mean * 0.1);
    if (monthly && steady) recurring.add(merchant);
  }
  return recurring;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}
