import Papa from 'papaparse';
import type { ParseReport } from '@expense/shared';
import { detectCurrency, parseAmount } from './amount';
import { guessDateFormat, parseDate } from './dates';

export interface RawTransaction {
  date: string;
  description: string;
  amount: number;
}

export interface ParsedStatement {
  rows: RawTransaction[];
  currency: string;
  report: ParseReport;
}

export class StatementParseError extends Error {}

interface ColumnMap {
  date: number;
  description: number[];
  amount?: number;
  debit?: number;
  credit?: number;
  /** A "Type" / "DR/CR" column that says which direction a positive amount goes. */
  direction?: number;
}

const HEADER_PATTERNS = {
  date: /^(transaction |posting |posted |booking |value )?date$|^date( posted)?$|^trans\.? date$/i,
  description: /description|details|narrative|payee|merchant|particulars|^name$|^text$/i,
  memo: /^memo$|^notes?$/i,
  amount: /^(transaction )?amount|^value$|^sum$/i,
  debit: /debit|withdrawal|money out|paid out|^out$|outflow/i,
  credit: /credit|deposit|money in|paid in|^in$|inflow/i,
  direction: /^type$|dr\s*\/\s*cr|debit\s*\/\s*credit|direction/i,
};

/** Banks often prepend a few lines of account info before the header row. */
const MAX_PREAMBLE_ROWS = 15;
export const MAX_ROWS = 5_000;

/**
 * Turns a bank's CSV export into signed transactions. Deals with the real-world variety:
 * comma/semicolon files, a preamble above the header, one signed "Amount" column or separate
 * Debit/Credit columns, a DR/CR type column, several date formats, and files with no header.
 */
export function parseStatementCsv(csv: string): ParsedStatement {
  const text = csv.replace(/^﻿/, '');
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
  const table = parsed.data.map((row) => row.map((cell) => (cell ?? '').trim()));
  if (table.length === 0) throw new StatementParseError('The file is empty.');

  const warnings: string[] = [];
  const headerIndex = findHeaderRow(table);
  let columns: ColumnMap;
  let headers: string[];
  let body: string[][];

  if (headerIndex !== -1) {
    headers = table[headerIndex];
    body = table.slice(headerIndex + 1);
    columns = mapColumnsFromHeader(headers);
  } else {
    // A first row with no date and no number in it is a header we could not read (e.g. another language).
    const unreadHeader = !table[0].some((c) => parseDate(c, 'DMY') !== null || parseAmount(c) !== null);
    body = unreadHeader ? table.slice(1) : table;
    columns = inferColumnsFromContent(body);
    headers = unreadHeader ? table[0] : table[0].map((_, i) => `Column ${i + 1}`);
    warnings.push(
      unreadHeader
        ? 'Column names were not recognised; columns were detected from their content.'
        : 'No header row found; columns were detected from their content.',
    );
  }

  if (body.length > MAX_ROWS) {
    throw new StatementParseError(`This file has ${body.length} rows. The limit is ${MAX_ROWS}.`);
  }

  const dateFormat = guessDateFormat(body.map((r) => r[columns.date] ?? ''));
  if (dateFormat.ambiguous) {
    warnings.push(`Dates could be read either way; assumed ${dateFormat.label}.`);
  }

  const rows: RawTransaction[] = [];
  let skipped = 0;
  const amountSamples: string[] = [];

  for (const row of body) {
    const date = parseDate(row[columns.date], dateFormat.order);
    const description = columns.description
      .map((i) => row[i])
      .filter(Boolean)
      .join(' · ')
      .replace(/\s+/g, ' ')
      .trim();
    const amount = readAmount(row, columns);
    if (!date || !description || amount === null || amount === 0) {
      skipped++;
      continue;
    }
    if (columns.amount !== undefined) amountSamples.push(row[columns.amount]);
    rows.push({ date, description, amount });
  }

  if (rows.length === 0) {
    throw new StatementParseError('No transactions found. The file needs a date, a description and an amount.');
  }

  if (columns.amount !== undefined && columns.direction === undefined && rows.every((r) => r.amount > 0)) {
    // Some banks export spending as positive numbers with no sign. Treat them as money out.
    for (const row of rows) row.amount = -row.amount;
    warnings.push('Every amount was positive, so they were treated as spending.');
  }

  if (skipped > 0) warnings.push(`${skipped} row(s) without a valid date, description or amount were skipped.`);

  rows.sort((a, b) => a.date.localeCompare(b.date));

  return {
    rows,
    currency: detectCurrency(amountSamples),
    report: {
      rowsRead: body.length,
      rowsSkipped: skipped,
      columns: {
        date: headers[columns.date],
        description: columns.description.map((i) => headers[i]).join(' + '),
        amount:
          columns.amount !== undefined
            ? headers[columns.amount]
            : [columns.debit, columns.credit]
                .filter((i): i is number => i !== undefined)
                .map((i) => headers[i])
                .join(' / '),
      },
      dateFormat: dateFormat.label,
      warnings,
    },
  };
}

function readAmount(row: string[], columns: ColumnMap): number | null {
  if (columns.amount !== undefined) {
    const value = parseAmount(row[columns.amount]);
    if (value === null || columns.direction === undefined) return value;
    const direction = (row[columns.direction] ?? '').toLowerCase();
    const isDebit = /^(d|dr|debit|withdrawal|out|payment)/.test(direction);
    const isCredit = /^(c|cr|credit|deposit|in)/.test(direction);
    if (isDebit) return -Math.abs(value);
    if (isCredit) return Math.abs(value);
    return value;
  }
  const debit = columns.debit !== undefined ? parseAmount(row[columns.debit]) : null;
  const credit = columns.credit !== undefined ? parseAmount(row[columns.credit]) : null;
  if (debit === null && credit === null) return null;
  return Math.abs(credit ?? 0) - Math.abs(debit ?? 0);
}

function findHeaderRow(table: string[][]): number {
  const limit = Math.min(table.length, MAX_PREAMBLE_ROWS);
  for (let i = 0; i < limit; i++) {
    const cells = table[i];
    const hasDate = cells.some((c) => HEADER_PATTERNS.date.test(c));
    const hasMoney = cells.some(
      (c) => HEADER_PATTERNS.amount.test(c) || HEADER_PATTERNS.debit.test(c) || HEADER_PATTERNS.credit.test(c),
    );
    if (hasDate && hasMoney) return i;
  }
  return -1;
}

function mapColumnsFromHeader(headers: string[]): ColumnMap {
  const find = (pattern: RegExp, exclude: number[] = []) =>
    headers.findIndex((h, i) => !exclude.includes(i) && pattern.test(h));

  const date = find(HEADER_PATTERNS.date);
  const amount = find(HEADER_PATTERNS.amount);
  // "Debit/Credit" is a direction column, not a money column, so match direction first.
  const direction = find(HEADER_PATTERNS.direction);
  const taken = [date, amount, direction].filter((i) => i !== -1);
  const debit = find(HEADER_PATTERNS.debit, taken);
  const credit = find(HEADER_PATTERNS.credit, [...taken, debit]);
  const moneyCols = [amount, debit, credit, direction].filter((i) => i !== -1);
  const primary = headers.findIndex(
    (h, i) => HEADER_PATTERNS.description.test(h) && i !== date && !moneyCols.includes(i),
  );
  const memo = find(HEADER_PATTERNS.memo, [primary]);
  const description = [primary, memo].filter((i) => i !== -1);

  if (description.length === 0) {
    throw new StatementParseError(`Could not find a description column. Found: ${headers.join(', ')}.`);
  }
  if (amount === -1 && debit === -1 && credit === -1) {
    throw new StatementParseError(`Could not find an amount column. Found: ${headers.join(', ')}.`);
  }
  return {
    date,
    description,
    amount: amount !== -1 ? amount : undefined,
    debit: amount === -1 && debit !== -1 ? debit : undefined,
    credit: amount === -1 && credit !== -1 ? credit : undefined,
    direction: amount !== -1 && direction !== -1 ? direction : undefined,
  };
}

/** For headerless files: the date column parses as dates, the amount column as numbers, the description is the longest text. */
function inferColumnsFromContent(body: string[][]): ColumnMap {
  const sample = body.slice(0, 50);
  const width = Math.max(...sample.map((r) => r.length));
  const share = (col: number, test: (cell: string) => boolean) =>
    sample.filter((r) => r[col] && test(r[col])).length / sample.length;

  let date = -1;
  let amount = -1;
  let direction: number | undefined;
  let description = -1;
  let bestTextLength = 0;
  for (let col = 0; col < width; col++) {
    if (date === -1 && share(col, (c) => parseDate(c, 'DMY') !== null) > 0.8) {
      date = col;
      continue;
    }
    if (amount === -1 && share(col, (c) => /^[-+(]?[\p{Sc}\s]*[\d.,]+\)?\s*(CR|DR)?$/iu.test(c)) > 0.8) {
      amount = col;
      continue;
    }
    if (direction === undefined && share(col, (c) => /^(DR|CR|D|C|DEBIT|CREDIT)$/i.test(c)) > 0.8) {
      direction = col;
      continue;
    }
    const avgLength = sample.reduce((sum, r) => sum + (r[col]?.length ?? 0), 0) / sample.length;
    if (avgLength > bestTextLength) {
      bestTextLength = avgLength;
      description = col;
    }
  }
  if (date === -1 || amount === -1 || description === -1) {
    throw new StatementParseError('Could not recognise the columns. Add a header row with Date, Description and Amount.');
  }
  return { date, description: [description], amount, direction };
}
