import { describe, expect, it } from 'vitest';
import { tx } from '../test/fixtures';
import { largestSpending, spendingByCategory, spendingOverTime, totals } from './stats';

describe('totals', () => {
  it('separates spending, income and transfers', () => {
    const result = totals([
      tx({ amount: -100, category: 'groceries', date: '2026-06-02' }),
      tx({ amount: 2000, category: 'income', date: '2026-06-01' }),
      tx({ amount: -500, category: 'transfers', date: '2026-06-05' }),
    ]);
    expect(result).toEqual({ spending: 100, income: 2000, net: 1900, count: 3, from: '2026-06-01', to: '2026-06-05' });
  });

  it('subtracts refunds from spending', () => {
    expect(totals([tx({ amount: -80, category: 'shopping' }), tx({ amount: 30, category: 'shopping' })]).spending).toBe(50);
  });
});

describe('spendingByCategory', () => {
  it('sums per category, largest first', () => {
    const result = spendingByCategory([
      tx({ amount: -10, category: 'dining' }),
      tx({ amount: -60, category: 'groceries' }),
      tx({ amount: -15, category: 'dining' }),
      tx({ amount: 1000, category: 'income' }),
    ]);
    expect(result).toEqual([
      { category: 'groceries', amount: 60, count: 1 },
      { category: 'dining', amount: 25, count: 2 },
    ]);
  });

  it('does not let unsorted money in hide unsorted spending', () => {
    const result = spendingByCategory([
      tx({ amount: -40, category: 'uncategorized', source: 'none' }),
      tx({ amount: 640, category: 'uncategorized', source: 'none' }),
    ]);
    expect(result).toEqual([{ category: 'uncategorized', amount: 40, count: 1 }]);
  });
});

describe('spendingOverTime', () => {
  it('buckets by Monday-start weeks and keeps empty weeks', () => {
    const { unit, periods } = spendingOverTime([
      tx({ amount: -10, date: '2026-06-03' }), // Wed, week of Jun 1
      tx({ amount: -5, date: '2026-06-07' }), // Sun, still week of Jun 1
      tx({ amount: -20, date: '2026-06-17' }), // week of Jun 15
    ]);
    expect(unit).toBe('week');
    expect(periods).toEqual([
      { start: '2026-06-01', amount: 15 },
      { start: '2026-06-08', amount: 0 },
      { start: '2026-06-15', amount: 20 },
    ]);
  });

  it('switches to months for long statements', () => {
    const { unit, periods } = spendingOverTime([tx({ amount: -10, date: '2026-01-15' }), tx({ amount: -10, date: '2026-07-02' })]);
    expect(unit).toBe('month');
    expect(periods).toHaveLength(7);
  });
});

describe('largestSpending', () => {
  it('returns the biggest payments, ignoring transfers', () => {
    const result = largestSpending(
      [tx({ amount: -500, category: 'transfers' }), tx({ amount: -90 }), tx({ amount: -300 }), tx({ amount: 50 })],
      2,
    );
    expect(result.map((t) => t.amount)).toEqual([-300, -90]);
  });
});
