import type { AnalysisResult, CategoryId } from '@expense/shared';
import { useMemo, useReducer, useState } from 'react';
import { downloadCsv } from '../lib/export-csv';
import { formatDate } from '../lib/format';
import { largestSpending, spendingByCategory, spendingOverTime, totals } from '../lib/stats';
import { analysisReducer, initAnalysis } from '../state/analysis';
import { CategoryChart } from './CategoryChart';
import { KpiTiles } from './KpiTiles';
import { LargestList } from './LargestList';
import { PipelineCard } from './PipelineCard';
import { TimeChart } from './TimeChart';
import { TransactionTable, type SourceFilter } from './TransactionTable';

export function Dashboard({ result, onNewFile }: { result: AnalysisResult; onNewFile: () => void }) {
  const [state, dispatch] = useReducer(analysisReducer, result, initAnalysis);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [source, setSource] = useState<SourceFilter>('all');

  const { transactions } = state;
  const sum = useMemo(() => totals(transactions), [transactions]);
  const byCategory = useMemo(() => spendingByCategory(transactions), [transactions]);
  const inCategory = useMemo(
    () => (category ? transactions.filter((t) => t.category === category) : transactions),
    [transactions, category],
  );
  const overTime = useMemo(() => spendingOverTime(inCategory), [inCategory]);
  const largest = useMemo(() => largestSpending(inCategory), [inCategory]);
  const manualCount = Object.keys(state.originals).length;

  function reviewLeftovers() {
    setCategory(null);
    setSource('review');
    document.getElementById('transactions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-ink-faint">{result.fileName}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {sum.from && sum.to ? `${formatDate(sum.from, true)} – ${formatDate(sum.to, true)}` : 'Your statement'}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {manualCount > 0 && (
            <button type="button" onClick={() => dispatch({ type: 'resetAll' })} className="btn-ghost">
              Undo my {manualCount} change{manualCount === 1 ? '' : 's'}
            </button>
          )}
          <button type="button" onClick={() => downloadCsv(transactions, result.fileName)} className="btn-ghost">
            Export CSV
          </button>
          <button type="button" onClick={onNewFile} className="btn-ghost">
            New file
          </button>
        </div>
      </div>

      <PipelineCard result={result} transactions={transactions} manualCount={manualCount} onReview={reviewLeftovers} />
      <KpiTiles totals={sum} currency={result.currency} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <CategoryChart data={byCategory} total={sum.spending} currency={result.currency} selected={category} onSelect={setCategory} />
        <div className="grid min-w-0 grid-cols-1 gap-4">
          <TimeChart data={overTime} currency={result.currency} category={category} />
          <LargestList transactions={largest} currency={result.currency} category={category} />
        </div>
      </div>

      <TransactionTable
        transactions={transactions}
        currency={result.currency}
        category={category}
        onCategory={setCategory}
        source={source}
        onSource={setSource}
        originals={state.originals}
        suggestion={state.suggestion}
        dispatch={dispatch}
      />
    </div>
  );
}
