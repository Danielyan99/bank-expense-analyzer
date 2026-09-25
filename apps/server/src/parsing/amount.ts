const CURRENCY_SYMBOLS: Record<string, string> = { $: 'USD', '€': 'EUR', '£': 'GBP', '֏': 'AMD', '₽': 'RUB' };
const CURRENCY_CODE = /\b(USD|EUR|GBP|AMD|RUB|CHF|CAD|AUD)\b/i;

/**
 * Parses a bank amount into a signed number. Handles the formats banks actually export:
 * "1,234.56", "1.234,56", "-12.50", "(12.50)", "12.50-", "$12.50", "12.50 DR", "12.50 CR".
 * Returns null when the cell holds no number at all (empty debit/credit cells are common).
 */
export function parseAmount(raw: string | undefined): number | null {
  if (raw == null) return null;
  let text = raw.trim();
  if (!text) return null;

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (/\bDR\b/i.test(text)) negative = true;
  text = text.replace(/\b(CR|DR)\b/gi, '');
  if (/^\s*[-−–]/.test(text) || /[-−–]\s*$/.test(text)) negative = true;

  // Keep digits and separators only (drops currency symbols, codes, signs and spaces).
  let digits = text.replace(/[^\d.,]/g, '');
  if (!/\d/.test(digits)) return null;

  const lastDot = digits.lastIndexOf('.');
  const lastComma = digits.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    // Both present: whichever comes last is the decimal separator.
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    digits = digits.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma !== -1) {
    // Only commas: "12,50" is a decimal, "1,250" or "1,250,000" is thousands.
    const afterComma = digits.length - lastComma - 1;
    const commaCount = digits.split(',').length - 1;
    digits = commaCount === 1 && afterComma !== 3 ? digits.replace(',', '.') : digits.split(',').join('');
  } else if (lastDot !== -1 && digits.split('.').length > 2) {
    // "1.250.000": dots as thousands separators.
    digits = digits.split('.').join('');
  }

  const value = Number.parseFloat(digits);
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 100) / 100;
  return negative ? -rounded : rounded;
}

/** Best guess of the file's currency from symbols or ISO codes in amount cells. Defaults to USD. */
export function detectCurrency(samples: string[]): string {
  const counts = new Map<string, number>();
  for (const sample of samples) {
    const symbol = [...sample].find((ch) => ch in CURRENCY_SYMBOLS);
    const code = symbol ? CURRENCY_SYMBOLS[symbol] : sample.match(CURRENCY_CODE)?.[1]?.toUpperCase();
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  let best = 'USD';
  let bestCount = 0;
  for (const [code, count] of counts) {
    if (count > bestCount) [best, bestCount] = [code, count];
  }
  return best;
}
