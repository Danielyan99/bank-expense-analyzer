import type { CategoryId } from '@expense/shared';
import { CATEGORY_COLOR, categoryLabel } from '../lib/categories';
import { formatMoney, formatPercent } from '../lib/format';
import type { CategorySpend } from '../lib/stats';

interface Props {
  data: CategorySpend[];
  total: number;
  currency: string;
  selected: CategoryId | null;
  onSelect: (category: CategoryId | null) => void;
}

/**
 * Horizontal bars in plain HTML rather than a chart library: every row is a real button
 * (keyboard and screen-reader friendly) that filters the rest of the dashboard.
 */
export function CategoryChart({ data, total, currency, selected, onSelect }: Props) {
  const max = data[0]?.amount ?? 0;
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="by-category-title">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="by-category-title" className="font-semibold">
          Spending by category
        </h2>
        {selected ? (
          <button type="button" onClick={() => onSelect(null)} className="text-xs text-accent hover:underline">
            Show all
          </button>
        ) : (
          <span className="text-xs text-ink-faint">Click a category to filter</span>
        )}
      </div>

      {data.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">No spending in this statement.</p>
      ) : (
        <ul className="mt-5 space-y-1">
          {data.map((row) => {
            const active = selected === row.category;
            const dimmed = selected !== null && !active;
            return (
              <li key={row.category}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect(active ? null : row.category)}
                  className={`group grid w-full grid-cols-[8.5rem_1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-raised sm:grid-cols-[9.5rem_1fr_auto] ${
                    active ? 'bg-raised' : ''
                  } ${dimmed ? 'opacity-45' : ''}`}
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span
                      aria-hidden="true"
                      className={`h-2.5 w-2.5 shrink-0 rounded-sm ${row.category === 'uncategorized' ? 'hatched' : ''}`}
                      style={{ backgroundColor: CATEGORY_COLOR[row.category] }}
                    />
                    <span className="truncate">{categoryLabel(row.category)}</span>
                  </span>
                  <span className="h-4" aria-hidden="true">
                    <span
                      className={`block h-full rounded-r ${row.category === 'uncategorized' ? 'hatched' : ''}`}
                      style={{
                        width: `${Math.max(1.5, (row.amount / max) * 100)}%`,
                        backgroundColor: CATEGORY_COLOR[row.category],
                      }}
                    />
                  </span>
                  <span className="tabular w-24 text-right text-sm">
                    {formatMoney(row.amount, currency)}
                    <span className="block text-xs text-ink-faint">
                      {formatPercent(row.amount, total)} · {row.count} tx
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
