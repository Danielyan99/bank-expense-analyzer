import { LINKS } from '../config';

export function Header({ onHome }: { onHome?: () => void }) {
  const logo = (
    <span className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="h-7 w-7" />
      <span className="text-[15px] font-semibold tracking-tight">Ledgerlens</span>
    </span>
  );
  return (
    <header className="border-b border-line/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        {onHome ? (
          <button type="button" onClick={onHome} className="rounded-md" aria-label="Ledgerlens, back to start">
            {logo}
          </button>
        ) : (
          logo
        )}
        <nav className="flex items-center gap-4 text-sm text-ink-muted">
          <a href={LINKS.github} target="_blank" rel="noreferrer" className="hover:text-ink">
            GitHub
          </a>
          <a href={LINKS.portfolio} target="_blank" rel="noreferrer" className="hover:text-ink">
            Portfolio
          </a>
        </nav>
      </div>
    </header>
  );
}
