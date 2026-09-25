import type { CategoryId, Transaction } from '@expense/shared';
import { CATEGORY_COLOR, categoryLabel } from '../lib/categories';
import { formatDate, formatMoney } from '../lib/format';

export function LargestList({
  transactions,
  currency,
  category,
}: {
  transactions: Transaction[];
  currency: string;
  category: CategoryId | null;
}) {
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="largest-title">
      <h2 id="largest-title" className="font-semibold">
        Largest payments{category ? ` · ${categoryLabel(category)}` : ''}
      </h2>
      {transactions.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">Nothing here.</p>
      ) : (
        <ol className="mt-3 divide-y divide-line">
          {transactions.map((tx) => (
            <li key={tx.id} className="flex items-center gap-3 py-2.5">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-sm ${tx.category === 'uncategorized' ? 'hatched' : ''}`}
                style={{ backgroundColor: CATEGORY_COLOR[tx.category] }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{tx.merchant}</span>
                <span className="block text-xs text-ink-faint">
                  {formatDate(tx.date)} · {categoryLabel(tx.category)}
                </span>
              </span>
              <span className="tabular text-sm font-medium">{formatMoney(-tx.amount, currency)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
