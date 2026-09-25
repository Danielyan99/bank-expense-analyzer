import { describe, expect, it } from 'vitest';
import { analysis, tx } from '../test/fixtures';
import { analysisReducer, initAnalysis } from './analysis';

describe('analysisReducer', () => {
  const a = tx({ amount: -12, merchant: 'SAKURA GARDEN', category: 'uncategorized', source: 'none', confidence: 0 });
  const b = tx({ amount: -14, merchant: 'SAKURA GARDEN', category: 'uncategorized', source: 'none', confidence: 0 });
  const refund = tx({ amount: 5, merchant: 'SAKURA GARDEN', category: 'uncategorized', source: 'none', confidence: 0 });
  const other = tx({ amount: -30, merchant: 'IKEA', category: 'shopping' });
  const start = () => initAnalysis(analysis([a, b, refund, other]));

  it('marks a changed transaction as manual and remembers the original', () => {
    const state = analysisReducer(start(), { type: 'recategorize', ids: [a.id], category: 'dining' });
    expect(state.transactions[0]).toMatchObject({ category: 'dining', source: 'manual', confidence: 1 });
    expect(state.originals[a.id]).toEqual({ category: 'uncategorized', source: 'none', confidence: 0 });
  });

  it('suggests the same change for the same merchant in the same direction', () => {
    const state = analysisReducer(start(), { type: 'recategorize', ids: [a.id], category: 'dining', suggest: true });
    expect(state.suggestion).toEqual({ merchant: 'SAKURA GARDEN', category: 'dining', ids: [b.id] });

    const applied = analysisReducer(state, { type: 'recategorize', ids: state.suggestion!.ids, category: 'dining' });
    expect(applied.transactions.filter((t) => t.category === 'dining')).toHaveLength(2);
    expect(applied.suggestion).toBeNull();
  });

  it('does not suggest when nothing else matches', () => {
    const state = analysisReducer(start(), { type: 'recategorize', ids: [other.id], category: 'leisure', suggest: true });
    expect(state.suggestion).toBeNull();
  });

  it('resets every manual change', () => {
    const changed = analysisReducer(start(), { type: 'recategorize', ids: [a.id, other.id], category: 'health' });
    const reset = analysisReducer(changed, { type: 'resetAll' });
    expect(reset.transactions).toEqual(start().transactions);
    expect(reset.originals).toEqual({});
  });
});
