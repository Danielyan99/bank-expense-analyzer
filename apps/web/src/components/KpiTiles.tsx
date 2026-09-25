import { formatMoney } from '../lib/format';
import type { Totals } from '../lib/stats';

export function KpiTiles({ totals, currency }: { totals: Totals; currency: string }) {
  const tiles = [
    { label: 'Spent', value: formatMoney(totals.spending, currency), note: 'excluding transfers' },
    { label: 'Income', value: formatMoney(totals.income, currency), note: 'salary, payouts, interest' },
    {
      label: 'Net',
      value: formatMoney(totals.net, currency, { sign: true }),
      note: totals.net >= 0 ? 'more in than out' : 'more out than in',
      tone: totals.net >= 0 ? 'text-good' : 'text-danger',
    },
    { label: 'Transactions', value: String(totals.count), note: 'after parsing' },
  ];
  return (
    <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="card p-5">
          <dt className="text-xs text-ink-muted">{t.label}</dt>
          <dd className={`mt-1.5 text-2xl font-semibold tracking-tight ${t.tone ?? ''}`}>{t.value}</dd>
          <dd className="mt-1 text-xs text-ink-faint">{t.note}</dd>
        </div>
      ))}
    </dl>
  );
}
