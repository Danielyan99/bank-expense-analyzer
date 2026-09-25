import type { Transaction } from '@expense/shared';
import { categoryLabel } from './categories';

const SOURCE_LABEL = { rule: 'Rule', ai: 'AI', manual: 'Manual', none: '' } as const;

export function toCsv(transactions: Transaction[]): string {
  const cell = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = ['Date', 'Description', 'Merchant', 'Amount', 'Category', 'Decided by'];
  const rows = transactions.map((t) =>
    [t.date, t.description, t.merchant, t.amount.toFixed(2), categoryLabel(t.category), SOURCE_LABEL[t.source]]
      .map(cell)
      .join(','),
  );
  return [header.join(','), ...rows].join('\n') + '\n';
}

export function downloadCsv(transactions: Transaction[], fileName: string): void {
  const blob = new Blob([toCsv(transactions)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.replace(/\.csv$/i, '') + '-categorized.csv';
  link.click();
  URL.revokeObjectURL(url);
}
