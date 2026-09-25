import type { AnalysisResult, CategoryId, Transaction } from '@expense/shared';

export interface AnalysisState {
  result: AnalysisResult;
  transactions: Transaction[];
  /** Original category per transaction id, kept for "undo" and to show what was changed. */
  originals: Record<string, Pick<Transaction, 'category' | 'source' | 'confidence'>>;
  /** After a manual change: other transactions from the same merchant the change could apply to. */
  suggestion: { merchant: string; category: CategoryId; ids: string[] } | null;
}

export type AnalysisAction =
  | { type: 'recategorize'; ids: string[]; category: CategoryId; suggest?: boolean }
  | { type: 'dismissSuggestion' }
  | { type: 'resetAll' };

export function initAnalysis(result: AnalysisResult): AnalysisState {
  return { result, transactions: result.transactions, originals: {}, suggestion: null };
}

export function analysisReducer(state: AnalysisState, action: AnalysisAction): AnalysisState {
  switch (action.type) {
    case 'recategorize': {
      const ids = new Set(action.ids);
      const originals = { ...state.originals };
      const transactions = state.transactions.map((tx) => {
        if (!ids.has(tx.id) || tx.category === action.category) return tx;
        originals[tx.id] ??= { category: tx.category, source: tx.source, confidence: tx.confidence };
        return { ...tx, category: action.category, source: 'manual' as const, confidence: 1 };
      });

      let suggestion: AnalysisState['suggestion'] = null;
      if (action.suggest && action.ids.length === 1) {
        const changed = state.transactions.find((t) => t.id === action.ids[0]);
        if (changed) {
          const sameMerchant = transactions.filter(
            (t) =>
              t.merchant === changed.merchant &&
              Math.sign(t.amount) === Math.sign(changed.amount) &&
              t.category !== action.category,
          );
          if (sameMerchant.length > 0) {
            suggestion = { merchant: changed.merchant, category: action.category, ids: sameMerchant.map((t) => t.id) };
          }
        }
      }
      return { ...state, transactions, originals, suggestion };
    }
    case 'dismissSuggestion':
      return { ...state, suggestion: null };
    case 'resetAll':
      return initAnalysis(state.result);
  }
}
