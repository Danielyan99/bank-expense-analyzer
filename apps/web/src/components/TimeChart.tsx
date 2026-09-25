import type { CategoryId } from '@expense/shared';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CATEGORY_COLOR, categoryLabel } from '../lib/categories';
import { formatDate, formatMoney } from '../lib/format';
import type { PeriodSpend } from '../lib/stats';

interface Props {
  data: { unit: 'week' | 'month'; periods: PeriodSpend[] };
  currency: string;
  category: CategoryId | null;
}

const ACCENT = '#5ce1c6';

export function TimeChart({ data, currency, category }: Props) {
  const color = category ? CATEGORY_COLOR[category] : ACCENT;
  const average = data.periods.length
    ? data.periods.reduce((sum, p) => sum + p.amount, 0) / data.periods.length
    : 0;
  const label = (start: string) =>
    data.unit === 'week' ? formatDate(start) : new Date(`${start}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="over-time-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="over-time-title" className="font-semibold">
          {category ? `${categoryLabel(category)} per ${data.unit}` : `Spending per ${data.unit}`}
        </h2>
        <span className="text-xs text-ink-faint">
          average {formatMoney(average, currency, { compact: true })} / {data.unit}
        </span>
      </div>
      <div className="mt-4 h-48" role="img" aria-label={`Bar chart of spending per ${data.unit}. Average ${formatMoney(average, currency)}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.periods} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="#222c38" />
            <XAxis
              dataKey="start"
              tickFormatter={label}
              tick={{ fill: '#6b7a8b', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#2e3a48' }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              width={48}
              tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })}
              tick={{ fill: '#6b7a8b', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as PeriodSpend | undefined;
                if (!active || !point) return null;
                return (
                  <div className="rounded-lg border border-line bg-raised px-3 py-2 text-xs shadow-lg">
                    <p className="text-ink-muted">
                      {data.unit === 'week' ? `Week of ${formatDate(point.start, true)}` : label(point.start)}
                    </p>
                    <p className="tabular mt-0.5 text-sm font-semibold text-ink">{formatMoney(point.amount, currency)}</p>
                  </div>
                );
              }}
            />
            <ReferenceLine y={average} stroke="#6b7a8b" strokeDasharray="0" strokeWidth={1} ifOverflow="extendDomain" />
            <Bar dataKey="amount" fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
