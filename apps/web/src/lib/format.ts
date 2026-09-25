const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(value: number, currency: string, options: { compact?: boolean; sign?: boolean } = {}): string {
  const key = `${currency}|${options.compact}|${options.sign}`;
  let formatter = moneyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: options.compact ? 'compact' : 'standard',
      maximumFractionDigits: options.compact ? 1 : 2,
      minimumFractionDigits: options.compact ? 0 : 2,
      signDisplay: options.sign ? 'exceptZero' : 'auto',
    });
    moneyFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

/** "2026-06-01" -> "Jun 1". Dates are plain calendar dates, so format them in UTC. */
export function formatDate(iso: string, withYear = false): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}

export function formatPercent(part: number, whole: number): string {
  if (whole === 0) return '0%';
  return `${Math.round((part / whole) * 100)}%`;
}

export function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.max(1, Math.round(ms))} ms` : `${(ms / 1000).toFixed(1)} s`;
}
