import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { analysis, tx } from '../test/fixtures';
import { Dashboard } from './Dashboard';

function setup() {
  const result = analysis([
    tx({ amount: -15.49, merchant: 'NETFLIX.COM', category: 'subscriptions', ruleId: 'merchant:NETFLIX' }),
    tx({ amount: -35, merchant: 'HOLLOWAY BARBERS', category: 'other', source: 'ai', confidence: 0.9, aiReason: 'Barber shop' }),
    tx({ amount: -18.5, merchant: 'THE LOCAL PRESS', category: 'uncategorized', source: 'none', confidence: 0 }),
    tx({ amount: -21, merchant: 'THE LOCAL PRESS', category: 'uncategorized', source: 'none', confidence: 0 }),
  ]);
  render(<Dashboard result={result} onNewFile={() => {}} />);
}

describe('Dashboard', () => {
  it('shows who decided each transaction and why', () => {
    setup();
    expect(screen.getByText('Known merchant: NETFLIX')).toBeInTheDocument();
    expect(screen.getByText('Barber shop')).toBeInTheDocument();
    expect(screen.getAllByText('No rule matched')).toHaveLength(2);
  });

  it('lets the user recategorize and apply it to the same merchant', () => {
    setup();
    const [first] = screen.getAllByRole('combobox', { name: 'Category for THE LOCAL PRESS' });
    fireEvent.change(first, { target: { value: 'dining' } });

    const prompt = screen.getByRole('status');
    expect(within(prompt).getByText(/Also set 1 other/)).toBeInTheDocument();
    fireEvent.click(within(prompt).getByRole('button', { name: 'Apply to all' }));

    expect(screen.getByRole('button', { name: 'Undo my 2 changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Needs review \(0\)/ })).toBeInTheDocument();
  });

  it('filters the table when a category is clicked', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Subscriptions/ }));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(2); // header + Netflix
  });
});
