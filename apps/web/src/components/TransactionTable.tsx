import { ALL_CATEGORIES, ASSIGNABLE_CATEGORIES, type CategoryId, type Transaction } from '@expense/shared';
import { useMemo, useState, type Dispatch } from 'react';
import { CATEGORY_COLOR, categoryLabel, describeRule } from '../lib/categories';
import { formatDate, formatMoney } from '../lib/format';
import type { AnalysisAction, AnalysisState } from '../state/analysis';

export type SourceFilter = 'all' | 'rule' | 'ai' | 'manual' | 'review';

const SOURCE_FILTERS: { id: SourceFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'rule', label: 'Rules' },
  { id: 'ai', label: 'AI' },
  { id: 'manual', label: 'You' },
  { id: 'review', label: 'Needs review' },
];

const PAGE = 50;

/** Unsorted rows, plus answers the AI itself was unsure about. */
export function needsReview(tx: Transaction): boolean {
  return tx.source === 'none' || (tx.source === 'ai' && tx.confidence < 0.7);
}

interface Props {
  transactions: Transaction[];
  currency: string;
  category: CategoryId | null;
  onCategory: (c: CategoryId | null) => void;
  source: SourceFilter;
  onSource: (s: SourceFilter) => void;
  originals: AnalysisState['originals'];
  suggestion: AnalysisState['suggestion'];
  dispatch: Dispatch<AnalysisAction>;
}

export function TransactionTable(props: Props) {
  const { transactions, currency, category, source, suggestion, dispatch } = props;
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: 'date' | 'amount'; desc: boolean }>({ key: 'date', desc: true });
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    const q = query.trim().toUpperCase();
    const filtered = transactions.filter(
      (t) =>
        (!category || t.category === category) &&
        (source === 'all' || (source === 'review' ? needsReview(t) : t.source === source)) &&
        (!q || t.description.toUpperCase().includes(q) || t.merchant.includes(q)),
    );
    const dir = sort.desc ? -1 : 1;
    return filtered.sort((a, b) =>
      sort.key === 'date' ? dir * a.date.localeCompare(b.date) || a.id.localeCompare(b.id) : dir * (a.amount - b.amount),
    );
  }, [transactions, category, source, query, sort]);

  const toggleSort = (key: 'date' | 'amount') =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key === 'date' }));

  return (
    <section id="transactions" className="card mt-4 scroll-mt-4 p-5 sm:p-6" aria-labelledby="tx-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="tx-title" className="font-semibold">
          Transactions <span className="font-normal text-ink-faint">({rows.length})</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search description"
            aria-label="Search transactions"
            className="w-44 rounded-lg border border-line bg-page px-3 py-1.5 text-sm placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <select
            value={category ?? ''}
            onChange={(e) => props.onCategory((e.target.value || null) as CategoryId | null)}
            aria-label="Filter by category"
            className="rounded-lg border border-line bg-page px-2 py-1.5 text-sm"
          >
            <option value="">All categories</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by who decided">
        {SOURCE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={source === f.id}
            onClick={() => props.onSource(f.id)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              source === f.id ? 'border-accent bg-accent/10 text-ink' : 'border-line text-ink-muted hover:text-ink'
            }`}
          >
            {f.label}
            {f.id === 'review' && ` (${transactions.filter(needsReview).length})`}
          </button>
        ))}
      </div>

      {suggestion && (
        <div role="status" className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          <span className="flex-1">
            Also set {suggestion.ids.length} other “{suggestion.merchant}” transaction{suggestion.ids.length === 1 ? '' : 's'} to{' '}
            <strong>{categoryLabel(suggestion.category)}</strong>?
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'recategorize', ids: suggestion.ids, category: suggestion.category })}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink"
          >
            Apply to all
          </button>
          <button type="button" onClick={() => dispatch({ type: 'dismissSuggestion' })} className="text-xs text-ink-muted hover:text-ink">
            No thanks
          </button>
        </div>
      )}

      <div className="relative -mx-5 mt-4 overflow-x-auto sm:-mx-6">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-faint">
              <th scope="col" className="py-2 pr-3 pl-5 font-medium sm:pl-6">
                <SortButton label="Date" active={sort.key === 'date'} desc={sort.desc} onClick={() => toggleSort('date')} />
              </th>
              <th scope="col" className="px-3 py-2 font-medium">Description</th>
              <th scope="col" className="px-3 py-2 font-medium">Category</th>
              <th scope="col" className="px-3 py-2 font-medium">Decided by</th>
              <th scope="col" className="py-2 pr-5 pl-3 text-right font-medium sm:pr-6">
                <SortButton label="Amount" active={sort.key === 'amount'} desc={sort.desc} onClick={() => toggleSort('amount')} />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((tx) => (
              <Row key={tx.id} tx={tx} currency={currency} changed={tx.id in props.originals} dispatch={dispatch} />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink-muted sm:px-6">No transactions match these filters.</p>}
      </div>

      {rows.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="btn-ghost mt-4 w-full">
          Show {Math.min(PAGE, rows.length - limit)} more of {rows.length - limit}
        </button>
      )}
    </section>
  );
}

function SortButton({ label, active, desc, onClick }: { label: string; active: boolean; desc: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 hover:text-ink ${active ? 'text-ink-muted' : ''}`}>
      {label}
      <span aria-hidden="true">{active ? (desc ? '↓' : '↑') : '↕'}</span>
      <span className="sr-only">{active ? (desc ? ', sorted descending' : ', sorted ascending') : ', not sorted'}</span>
    </button>
  );
}

function Row({ tx, currency, changed, dispatch }: { tx: Transaction; currency: string; changed: boolean; dispatch: Dispatch<AnalysisAction> }) {
  return (
    <tr className="border-b border-line/60 last:border-0 hover:bg-raised/60">
      <td className="tabular py-2.5 pr-3 pl-5 whitespace-nowrap text-ink-muted sm:pl-6">{formatDate(tx.date)}</td>
      <td className="max-w-[260px] px-3 py-2.5">
        <span className="block truncate font-medium">
          {tx.merchant}
          {tx.recurring && (
            <span className="ml-2 rounded bg-raised px-1.5 py-0.5 align-middle text-[10px] font-normal text-ink-muted" title="Charged monthly, same amount">
              monthly
            </span>
          )}
        </span>
        <span className="block truncate text-xs text-ink-faint" title={tx.description}>
          {tx.description}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 shrink-0 rounded-sm ${tx.category === 'uncategorized' ? 'hatched' : ''}`}
            style={{ backgroundColor: CATEGORY_COLOR[tx.category] }}
          />
          <select
            aria-label={`Category for ${tx.merchant}`}
            value={tx.category}
            onChange={(e) => dispatch({ type: 'recategorize', ids: [tx.id], category: e.target.value as CategoryId, suggest: true })}
            className={`rounded-md border bg-page py-1 pr-1 pl-1.5 text-sm ${
              tx.category === 'uncategorized' ? 'border-dashed border-ink-faint text-ink-muted' : 'border-line'
            }`}
          >
            {tx.category === 'uncategorized' && <option value="uncategorized">Choose…</option>}
            {ASSIGNABLE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </span>
      </td>
      <td className="max-w-[240px] px-3 py-2.5">
        <SourceBadge tx={tx} changed={changed} />
      </td>
      <td className={`tabular py-2.5 pr-5 pl-3 text-right whitespace-nowrap sm:pr-6 ${tx.amount > 0 ? 'text-good' : ''}`}>
        {formatMoney(tx.amount, currency, { sign: tx.amount > 0 })}
      </td>
    </tr>
  );
}

function SourceBadge({ tx, changed }: { tx: Transaction; changed: boolean }) {
  const styles = {
    rule: 'border-accent/50 text-accent',
    ai: 'border-ai/50 text-ai',
    manual: 'border-ink/40 text-ink',
    none: 'border-dashed border-ink-faint text-ink-muted',
  } as const;
  const label = { rule: 'Rule', ai: 'AI', manual: 'You', none: 'Not sorted' }[tx.source];
  const detail =
    tx.source === 'rule'
      ? describeRule(tx.ruleId)
      : tx.source === 'ai'
        ? `${tx.aiReason ?? ''}${tx.confidence < 0.7 ? ' (unsure)' : ''}`
        : tx.source === 'manual' && changed
          ? 'Changed by you'
          : tx.source === 'none'
            ? 'No rule matched'
            : '';
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles[tx.source]}`}>{label}</span>
      <span className="truncate text-xs text-ink-faint" title={detail}>
        {detail}
      </span>
    </span>
  );
}
