import { useRef, useState, type DragEvent } from 'react';
import type { ServerStatus } from '../App';
import { sourceUrl } from '../config';

interface Props {
  loading: boolean;
  error: string | null;
  server: { status: ServerStatus; ai: boolean };
  onSample: () => void;
  onFile: (file: File) => void;
}

export function Landing({ loading, error, server, onSample, onFile }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !loading) onFile(file);
  }

  return (
    <div className="pt-12 sm:pt-20">
      <section className="max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Bank statement analyzer</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Where did the money go?
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-muted text-pretty">
          Upload a bank statement CSV and get a spending dashboard. Plain rules categorize every transaction they
          recognise. <span className="text-ink">An LLM only sees the leftovers the rules can&apos;t place</span>, and
          every row shows which of the two decided.
        </p>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-[1fr_1.15fr]">
        <div className="card flex flex-col justify-between p-6">
          <div>
            <h2 className="text-lg font-semibold">Try it with sample data</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Three months of a made-up checking account: 200 transactions, with noisy descriptions and some local
              merchants no rule list knows.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSample}
              disabled={loading}
              className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
            >
              Analyze the sample statement
            </button>
            <a href="/sample-statement.csv" download className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
              Download the CSV
            </a>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          className={`card flex flex-col items-center justify-center border-dashed p-6 text-center transition ${
            dragging ? 'border-accent bg-raised' : ''
          }`}
        >
          <p className="text-lg font-semibold">Or use your own CSV</p>
          <p className="mt-2 max-w-sm text-sm text-ink-muted">
            Drop a file here, or{' '}
            <button
              type="button"
              disabled={loading}
              onClick={() => input.current?.click()}
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              choose one
            </button>
            . Most bank exports work: one Amount column or Debit/Credit columns, any common date format.
          </p>
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="Upload a CSV bank statement"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = '';
            }}
          />
          <p className="mt-4 max-w-sm rounded-lg bg-raised px-3 py-2 text-xs leading-relaxed text-ink-muted">
            This is a portfolio demo: please use the sample, not your real statement. Nothing is stored. Files are
            processed in memory and dropped. Only merchant descriptions (with long numbers masked) go to the AI: Google Gemini's free tier, where Google may use requests to improve its products.
          </p>
        </div>
      </section>

      <div aria-live="polite" className="mt-6 min-h-6">
        {loading && <Progress aiEnabled={server.ai} />}
        {error && !loading && (
          <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        {!loading && !error && server.status === 'waking' && (
          <p className="text-sm text-ink-faint">Waking the server (free hosting sleeps when idle; up to ~30 s)…</p>
        )}
      </div>

      <HowItWorks />
    </div>
  );
}

function Progress({ aiEnabled }: { aiEnabled: boolean }) {
  const steps = ['Reading the CSV', 'Applying rules', aiEnabled ? 'Asking the AI about the leftovers' : 'Finishing up'];
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-3">
          <span className="animate-step" style={{ animationDelay: `${i * 0.3}s` }}>
            {step}
          </span>
          {i < steps.length - 1 && <span aria-hidden="true">→</span>}
        </li>
      ))}
    </ol>
  );
}

const STEPS = [
  {
    title: 'Parse',
    body: 'Finds the header row, the date format (DD/MM or MM/DD) and the sign convention, whatever your bank uses.',
    file: 'apps/server/src/parsing/csv-statement.parser.ts',
  },
  {
    title: 'Rules first',
    body: '360+ merchant names, keywords and money-flow patterns, plus a recurring-charge detector. Usually 80–90% of rows.',
    file: 'apps/server/src/categorization/rules.ts',
  },
  {
    title: 'AI for the rest',
    body: 'Only unknown merchants, each sent once, in one call with a strict JSON schema. Gemini in this demo, Claude also supported. "Unknown" is allowed.',
    file: 'apps/server/src/categorization/ai-categorizer.service.ts',
  },
];

function HowItWorks() {
  return (
    <section className="mt-16" aria-labelledby="how-title">
      <h2 id="how-title" className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-faint">
        How it works
      </h2>
      <ol className="mt-4 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="card p-5">
            <p className="font-mono text-xs text-ink-faint">0{i + 1}</p>
            <h3 className="mt-2 font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.body}</p>
            <a
              href={sourceUrl(step.file)}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block font-mono text-xs text-ink-faint hover:text-accent"
            >
              {step.file.split('/').pop()} ↗
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
