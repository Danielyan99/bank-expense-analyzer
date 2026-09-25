import type { AnalysisResult } from '@expense/shared';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Landing } from './components/Landing';
import { analyzeFile, analyzeSample, wakeServer } from './lib/api';

// The dashboard pulls in the chart library; the landing page should not wait for it.
const Dashboard = lazy(() => import('./components/Dashboard').then((m) => ({ default: m.Dashboard })));
const preloadDashboard = () => void import('./components/Dashboard');

export type ServerStatus = 'waking' | 'ready' | 'unreachable';

export function App() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [server, setServer] = useState<{ status: ServerStatus; ai: boolean }>({ status: 'waking', ai: false });

  useEffect(() => {
    let cancelled = false;
    preloadDashboard();
    wakeServer()
      .then(({ ai }) => !cancelled && setServer({ status: 'ready', ai }))
      .catch(() => !cancelled && setServer({ status: 'unreachable', ai: false }));
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(job: () => Promise<AnalysisResult>) {
    setLoading(true);
    setError(null);
    try {
      const next = await job();
      setResult(next);
      setServer((s) => ({ ...s, status: 'ready' }));
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Header onHome={result ? () => setResult(null) : undefined} />
      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {result ? (
          <Suspense fallback={<p className="pt-12 text-sm text-ink-muted">Loading the dashboard…</p>}>
            {/* key: a new file starts with fresh state (filters, manual edits). */}
            <Dashboard key={result.fileName + result.transactions.length} result={result} onNewFile={() => setResult(null)} />
          </Suspense>
        ) : (
          <Landing
            loading={loading}
            error={error}
            server={server}
            onSample={() => run(analyzeSample)}
            onFile={(file) => run(() => analyzeFile(file))}
          />
        )}
      </main>
    </div>
  );
}
