import type { AnalysisResult, Transaction } from '@expense/shared';
import type { ReactNode } from 'react';
import { formatDuration, formatPercent } from '../lib/format';

interface Props {
  result: AnalysisResult;
  transactions: Transaction[];
  manualCount: number;
  onReview: () => void;
}

const AI_NOTE: Record<AnalysisResult['pipeline']['aiStatus'], string> = {
  ok: '',
  'not-needed': 'The rules settled everything, so Claude was not called.',
  disabled: 'Claude is switched off on this server, so the leftovers are yours to sort.',
  error: 'The Claude call failed, so the leftovers stay uncategorized.',
};

/**
 * The point of the project in one card: how many transactions each step decided.
 * The segmented bar uses the source, not the category, and every segment is also labelled.
 */
export function PipelineCard({ result, transactions, manualCount, onReview }: Props) {
  const { pipeline, parse } = result;
  const total = transactions.length;
  const now = {
    rule: transactions.filter((t) => t.source === 'rule').length,
    ai: transactions.filter((t) => t.source === 'ai').length,
    manual: transactions.filter((t) => t.source === 'manual').length,
    none: transactions.filter((t) => t.source === 'none').length,
  };
  const segments = [
    { key: 'rule', label: 'Rules', count: now.rule, className: 'bg-accent' },
    { key: 'ai', label: 'Claude', count: now.ai, className: 'bg-ai' },
    { key: 'manual', label: 'You', count: now.manual, className: 'bg-ink' },
    { key: 'none', label: 'Not sorted', count: now.none, className: 'hatched bg-raised' },
  ].filter((s) => s.count > 0);

  const note = pipeline.aiMessage ?? AI_NOTE[pipeline.aiStatus];

  return (
    <section className="card mt-6 p-5 sm:p-6" aria-labelledby="pipeline-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pipeline-title" className="font-semibold">
          Who categorized what
        </h2>
        <p className="font-mono text-xs text-ink-faint">
          parse {formatDuration(pipeline.durationMs.parse)} · rules {formatDuration(pipeline.durationMs.rules)}
          {pipeline.merchantsSentToAi > 0 && ` · Claude ${formatDuration(pipeline.durationMs.ai)}`}
        </p>
      </div>

      <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={segments.map((s) => `${s.label}: ${s.count}`).join(', ')}>
        {segments.map((s) => (
          <div key={s.key} className={s.className} style={{ flexGrow: s.count }} />
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Stat label="Rules" swatch="bg-accent" value={now.rule} total={total} hint={`of ${total} transactions`} />
        <Stat
          label="Claude"
          swatch="bg-ai"
          value={now.ai}
          total={total}
          hint={
            pipeline.merchantsSentToAi > 0
              ? `${pipeline.merchantsSentToAi} merchant${pipeline.merchantsSentToAi === 1 ? '' : 's'} sent, once each`
              : pipeline.aiStatus === 'disabled'
                ? 'switched off here'
                : pipeline.aiStatus === 'ok' && pipeline.byAi > 0
                  ? 'answers cached, no new call'
                  : 'no call needed'
          }
        />
        <Stat label="You" swatch="bg-ink" value={manualCount} total={total} hint="manual changes" />
        <Stat label="Not sorted" swatch="hatched bg-raised" value={now.none} total={total} hint="need a decision">
          {now.none > 0 && (
            <button type="button" onClick={onReview} className="ml-1 text-accent underline-offset-4 hover:underline">
              Review
            </button>
          )}
        </Stat>
      </dl>

      {(note || parse.warnings.length > 0) && (
        <ul className="mt-4 space-y-1 border-t border-line pt-3 text-xs text-ink-muted">
          {note && <li>{note}</li>}
          {parse.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-faint">
        Read columns “{parse.columns.date}”, “{parse.columns.description}”, “{parse.columns.amount}” · dates as{' '}
        {parse.dateFormat}
        {pipeline.aiModel && pipeline.merchantsSentToAi > 0 && ` · model ${pipeline.aiModel}`}
      </p>
    </section>
  );
}

function Stat(props: { label: string; swatch: string; value: number; total: number; hint: string; children?: ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-xs text-ink-muted">
        <span className={`h-2.5 w-2.5 rounded-sm ${props.swatch}`} aria-hidden="true" />
        {props.label}
      </dt>
      <dd className="mt-1">
        <span className="tabular text-xl font-semibold">{props.value}</span>
        <span className="ml-1.5 text-sm text-ink-faint">{formatPercent(props.value, props.total)}</span>
        <span className="block text-xs text-ink-faint">
          {props.hint}
          {props.children}
        </span>
      </dd>
    </div>
  );
}
