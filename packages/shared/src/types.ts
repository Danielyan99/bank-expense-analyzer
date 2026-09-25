import type { CategoryId } from './categories';

/** Who decided a transaction's category. */
export type CategorySource = 'rule' | 'ai' | 'manual' | 'none';

export interface Transaction {
  id: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** The description exactly as the bank wrote it. */
  description: string;
  /** Cleaned-up merchant name used for matching, e.g. "BLUE BOTTLE COFFEE". */
  merchant: string;
  /** Negative = money out, positive = money in. */
  amount: number;
  category: CategoryId;
  source: CategorySource;
  /** 0..1. How sure the deciding step was. */
  confidence: number;
  /** Rule that matched (source "rule"). */
  ruleId?: string;
  /** Claude's one-line reason (source "ai"). */
  aiReason?: string;
  /** Same merchant, similar amount, roughly monthly. */
  recurring?: boolean;
}

export interface ParseReport {
  rowsRead: number;
  rowsSkipped: number;
  /** Which CSV column fed each field. */
  columns: { date: string; description: string; amount: string };
  dateFormat: string;
  warnings: string[];
}

export type AiStatus =
  /** Claude classified the leftovers. */
  | 'ok'
  /** Nothing was left for Claude after the rules. */
  | 'not-needed'
  /** No API key configured on the server. */
  | 'disabled'
  /** The call failed; leftovers stay uncategorized. */
  | 'error';

export interface PipelineReport {
  /** Transactions decided by each step, before any manual edits. */
  byRules: number;
  byAi: number;
  unresolved: number;
  /** Distinct merchants that were sent to Claude (duplicates are sent once). */
  merchantsSentToAi: number;
  aiStatus: AiStatus;
  aiModel?: string;
  aiMessage?: string;
  durationMs: { parse: number; rules: number; ai: number };
}

export interface AnalysisResult {
  fileName: string;
  currency: string;
  transactions: Transaction[];
  parse: ParseReport;
  pipeline: PipelineReport;
}

export interface ApiError {
  message: string;
}
