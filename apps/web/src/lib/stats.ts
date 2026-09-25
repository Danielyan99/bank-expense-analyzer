import { isSpendingCategory, SPENDING_CATEGORIES, type CategoryId, type Transaction } from '@expense/shared';

/** Categories that are never spending: money coming in, or money moving between own accounts. */
const NOT_SPENDING: ReadonlySet<CategoryId> = new Set(['income', 'transfers']);

/**
 * Money out counts as spending unless it is a transfer. Money in counts only as a refund
 * within a real spending category; unsorted money in is not allowed to hide unsorted spending.
 */
export function isSpending(tx: Transaction): boolean {
  if (NOT_SPENDING.has(tx.category)) return false;
  return tx.amount < 0 || isSpendingCategory(tx.category);
}

export interface Totals {
  /** Positive number: money out, minus refunds, excluding transfers. */
  spending: number;
  income: number;
  net: number;
  count: number;
  from: string | null;
  to: string | null;
}

export function totals(transactions: Transaction[]): Totals {
  let spending = 0;
  let income = 0;
  for (const tx of transactions) {
    if (tx.category === 'income') income += tx.amount;
    else if (isSpending(tx)) spending -= tx.amount;
  }
  const dates = transactions.map((t) => t.date).sort();
  return {
    spending: round(spending),
    income: round(income),
    net: round(income - spending),
    count: transactions.length,
    from: dates[0] ?? null,
    to: dates.at(-1) ?? null,
  };
}

export interface CategorySpend {
  category: CategoryId;
  amount: number;
  count: number;
}

/**
 * Spending per category, largest first. A refund (money in with a spending category)
 * lowers that category's total, as it does on a real bank statement.
 */
export function spendingByCategory(transactions: Transaction[]): CategorySpend[] {
  const map = new Map<CategoryId, CategorySpend>();
  for (const tx of transactions) {
    if (!isSpending(tx)) continue;
    const entry = map.get(tx.category) ?? { category: tx.category, amount: 0, count: 0 };
    entry.amount -= tx.amount;
    entry.count++;
    map.set(tx.category, entry);
  }
  return [...map.values()]
    .map((e) => ({ ...e, amount: round(e.amount) }))
    .filter((e) => e.amount > 0)
    .sort((a, b) => b.amount - a.amount || rank(a.category) - rank(b.category));
}

export interface PeriodSpend {
  /** ISO date of the period start (Monday for weeks, the 1st for months). */
  start: string;
  amount: number;
}

/** Weekly buckets for statements up to ~4 months, monthly beyond that. Empty periods are kept as 0. */
export function spendingOverTime(transactions: Transaction[]): { unit: 'week' | 'month'; periods: PeriodSpend[] } {
  const spend = transactions.filter(isSpending);
  if (spend.length === 0) return { unit: 'week', periods: [] };
  const dates = spend.map((t) => t.date).sort();
  const days = (Date.parse(dates.at(-1)!) - Date.parse(dates[0])) / 86_400_000;
  const unit = days > 125 ? 'month' : 'week';
  const bucket = unit === 'week' ? weekStart : monthStart;

  const sums = new Map<string, number>();
  for (let d = bucket(dates[0]); d <= dates.at(-1)!; d = next(d, unit)) sums.set(d, 0);
  for (const tx of spend) {
    const key = bucket(tx.date);
    sums.set(key, (sums.get(key) ?? 0) - tx.amount);
  }
  return { unit, periods: [...sums].map(([start, amount]) => ({ start, amount: round(Math.max(0, amount)) })) };
}

export function largestSpending(transactions: Transaction[], limit = 5): Transaction[] {
  return transactions
    .filter((t) => t.amount < 0 && isSpending(t))
    .sort((a, b) => a.amount - b.amount)
    .slice(0, limit);
}

function weekStart(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function next(iso: string, unit: 'week' | 'month'): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (unit === 'week') date.setUTCDate(date.getUTCDate() + 7);
  else date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function rank(id: CategoryId): number {
  const i = (SPENDING_CATEGORIES as readonly string[]).indexOf(id);
  return i === -1 ? 99 : i;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
