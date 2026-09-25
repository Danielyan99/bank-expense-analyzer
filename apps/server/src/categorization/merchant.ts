/**
 * Bank descriptions carry noise around the merchant name: payment-method prefixes, card
 * numbers, reference codes, dates, city/state suffixes. Strip it so "POS 4821 STARBUCKS #1234
 * SEATTLE WA 03/14" and "STARBUCKS STORE 552" both become a stable "STARBUCKS ..." key.
 */
const PREFIXES = [
  /^(POS|EFTPOS|ATM|ACH|DD|SO|BGC|FPI|FPO|TFR|BP|CHQ)\b[\s:-]*/,
  /^(CARD|DEBIT CARD|CREDIT CARD|VISA|VISA DEBIT|MASTERCARD|MC|DEBIT)( PURCHASE| PAYMENT| TRANSACTION)?\b[\s:-]*/,
  /^(PURCHASE|PAYMENT|PMT|RECURRING|PREAUTHORIZED|PRE-AUTH|ONLINE|CONTACTLESS|DIRECT DEBIT|STANDING ORDER)\b( TO| AT| FROM)?[\s:-]*/,
  /^(SQ|SQU|TST|SP|PY|PP|PAYPAL) ?\*\s*/,
];

export function normalizeMerchant(description: string): string {
  let text = description.toUpperCase().replace(/\s·\s.*$/, ''); // drop the memo part
  for (let pass = 0; pass < 3; pass++) {
    for (const prefix of PREFIXES) text = text.replace(prefix, '');
  }
  text = text
    .replace(/\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b/g, ' ') // dates
    .replace(/\b(REF|ID|TXN|AUTH|CARD|NO)[\s:#.]*\w*\d\w*\b/g, ' ') // reference codes
    .replace(/[#*]\s*\w*\d\w*/g, ' ') // store numbers like #1234 or *AB12C
    .replace(/\b[A-Z]*\d{3,}[A-Z\d]*\b/g, ' ') // long digit runs: card and account numbers
    .replace(/\b(X{2,}\d*)\b/g, ' ') // masked card numbers
    .replace(/[^A-Z0-9&' .-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ (WA|CA|NY|TX|OR|FL|IL|MA|UK|GB|US|USA)$/, ''); // trailing region codes
  return text || description.toUpperCase().trim();
}

/** Removes anything that looks like an account or card number before text leaves the server. */
export function redactForAi(description: string): string {
  return description.replace(/\d[\d\s-]{5,}\d/g, '####').slice(0, 120);
}
