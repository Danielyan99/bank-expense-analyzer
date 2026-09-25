import type { AnalysisResult, Transaction } from '@expense/shared';

let next = 0;

export function tx(partial: Partial<Transaction> & Pick<Transaction, 'amount'>): Transaction {
  next++;
  return {
    id: `t${next}`,
    date: '2026-06-01',
    description: `MERCHANT ${next}`,
    merchant: `MERCHANT ${next}`,
    category: 'shopping',
    source: 'rule',
    confidence: 0.95,
    ...partial,
  };
}

export function analysis(transactions: Transaction[]): AnalysisResult {
  return {
    fileName: 'test.csv',
    currency: 'USD',
    transactions,
    parse: {
      rowsRead: transactions.length,
      rowsSkipped: 0,
      columns: { date: 'Date', description: 'Description', amount: 'Amount' },
      dateFormat: 'YYYY-MM-DD',
      warnings: [],
    },
    pipeline: {
      byRules: transactions.filter((t) => t.source === 'rule').length,
      byAi: transactions.filter((t) => t.source === 'ai').length,
      unresolved: transactions.filter((t) => t.source === 'none').length,
      merchantsSentToAi: 1,
      aiStatus: 'ok',
      aiModel: 'claude-opus-5',
      durationMs: { parse: 2, rules: 3, ai: 1800 },
    },
  };
}
