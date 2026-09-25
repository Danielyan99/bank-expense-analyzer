const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

export type NumericOrder = 'DMY' | 'MDY';

export interface DateFormatGuess {
  /** Order used for "01/02/2026"-style dates. */
  order: NumericOrder;
  /** Human-readable label for the report, e.g. "DD/MM/YYYY". */
  label: string;
  /** True when no date in the file proved the order (every day and month was <= 12). */
  ambiguous: boolean;
}

const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})/;
const NUMERIC = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})\b/;
const DAY_MONTH_NAME = /^(\d{1,2})[\s\-]([a-z]{3,4})[a-z]*[\s\-,]+(\d{2}|\d{4})\b/i;
const MONTH_NAME_DAY = /^([a-z]{3,4})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{2}|\d{4})\b/i;

/**
 * Banks disagree on 03/04/2026: March 4 (US) or 3 April (most of the world)?
 * One file uses one convention, so look at every date: a first part above 12 proves DD/MM,
 * a second part above 12 proves MM/DD. If nothing proves it, assume DD/MM and say so.
 */
export function guessDateFormat(samples: string[]): DateFormatGuess {
  let firstOver12 = false;
  let secondOver12 = false;
  let numericSeen = false;
  let separator = '/';
  for (const sample of samples) {
    const m = sample.trim().match(NUMERIC);
    if (!m) continue;
    numericSeen = true;
    separator = sample.trim()[m[1].length];
    if (Number(m[1]) > 12) firstOver12 = true;
    if (Number(m[2]) > 12) secondOver12 = true;
  }
  if (!numericSeen) {
    const iso = samples.some((s) => ISO.test(s.trim()));
    return { order: 'DMY', label: iso ? 'YYYY-MM-DD' : 'D MMM YYYY', ambiguous: false };
  }
  const order: NumericOrder = secondOver12 && !firstOver12 ? 'MDY' : 'DMY';
  const label = order === 'MDY' ? `MM${separator}DD${separator}YYYY` : `DD${separator}MM${separator}YYYY`;
  return { order, label, ambiguous: !firstOver12 && !secondOver12 };
}

/** Returns an ISO date (YYYY-MM-DD) or null when the text is not a date. */
export function parseDate(raw: string | undefined, order: NumericOrder): string | null {
  if (!raw) return null;
  const text = raw.trim();
  let y: number;
  let m: number;
  let d: number;

  let match: RegExpMatchArray | null;
  if ((match = text.match(ISO))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = text.match(NUMERIC))) {
    const [a, b] = [Number(match[1]), Number(match[2])];
    [d, m] = order === 'MDY' ? [b, a] : [a, b];
    y = Number(match[3]);
  } else if ((match = text.match(DAY_MONTH_NAME))) {
    d = Number(match[1]);
    m = MONTHS[match[2].toLowerCase()] ?? 0;
    y = Number(match[3]);
  } else if ((match = text.match(MONTH_NAME_DAY))) {
    m = MONTHS[match[1].toLowerCase()] ?? 0;
    d = Number(match[2]);
    y = Number(match[3]);
  } else {
    return null;
  }

  if (y < 100) y += 2000;
  const date = new Date(Date.UTC(y, m - 1, d));
  // Rejects 31/02 and similar: Date would silently roll it into March.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}
