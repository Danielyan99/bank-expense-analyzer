import { generateSampleRows } from '../sample/sample-statement';
import { normalizeMerchant, redactForAi } from './merchant';
import { categorizeWithRules, findRecurringMerchants, matchRule } from './rule-engine';

describe('normalizeMerchant', () => {
  it.each([
    ['POS 4821 STARBUCKS STORE #1234 SEATTLE WA 03/14', 'STARBUCKS STORE SEATTLE'],
    ['SQ *BLUE HERON BAKERY', 'BLUE HERON BAKERY'],
    ['VISA DEBIT PURCHASE NETFLIX.COM', 'NETFLIX.COM'],
    ['AMZN MKTP US*7Y1RT', 'AMZN MKTP'],
    ['TST* EL FAROLITO', 'EL FAROLITO'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeMerchant(raw)).toBe(expected);
  });
});

describe('redactForAi', () => {
  it('masks card and account numbers', () => {
    expect(redactForAi('TRANSFER TO 4111 1111 1111 1111 JOHN')).toBe('TRANSFER TO #### JOHN');
  });
});

describe('matchRule', () => {
  it('prefers the most specific merchant name', () => {
    expect(matchRule('AMAZON PRIME*2K4', -14.99)?.category).toBe('subscriptions');
    expect(matchRule('AMAZON.COM*2K4', -40)?.category).toBe('shopping');
    expect(matchRule('UBER EATS', -25)?.category).toBe('dining');
    expect(matchRule('UBER *TRIP', -12)?.category).toBe('transport');
  });

  it('respects money direction', () => {
    expect(matchRule('ACME PAYROLL', 2000)?.category).toBe('income');
    expect(matchRule('ACME PAYROLL', -2000)).toBeUndefined();
  });

  it('matches names with symbols like & and .', () => {
    expect(matchRule('AT&T BILL PAYMENT', -70)?.id).toBe('merchant:AT&T');
    expect(matchRule('BOOKING.COM HOTEL', -300)?.id).toBe('merchant:BOOKING.COM');
  });

  it('does not match a keyword inside another word', () => {
    // "BAR" must not fire on "BARNES", "MARKET" must not fire on "SUPERMARKETS".
    expect(matchRule('BARNES & NOBLE', -20)?.id).not.toBe('keyword:BAR');
    expect(matchRule('SUPERMARKETS', -20)?.id).not.toBe('keyword:MARKET');
  });

  it('returns undefined for unknown merchants', () => {
    expect(matchRule('HOLLOWAY BARBERS', -35)).toBeUndefined();
  });
});

describe('findRecurringMerchants', () => {
  const row = (date: string, description: string, amount: number) => ({ date, description, amount });

  it('finds a steady monthly charge', () => {
    const rows = [row('2026-06-12', 'HEADWAY APP', -12.99), row('2026-07-12', 'HEADWAY APP', -12.99), row('2026-08-11', 'HEADWAY APP', -12.99)];
    expect(findRecurringMerchants(rows)).toEqual(new Set(['HEADWAY APP']));
  });

  it('ignores irregular timing and changing amounts', () => {
    const irregular = [row('2026-06-01', 'CAFE X', -5), row('2026-06-03', 'CAFE X', -5), row('2026-07-20', 'CAFE X', -5)];
    const changing = [row('2026-06-01', 'SHOP Y', -10), row('2026-07-01', 'SHOP Y', -40), row('2026-08-01', 'SHOP Y', -10)];
    expect(findRecurringMerchants([...irregular, ...changing]).size).toBe(0);
  });
});

describe('categorizeWithRules', () => {
  it('uses the recurring signal for unknown small monthly charges', () => {
    const rows = ['2026-06-12', '2026-07-12', '2026-08-11'].map((date) => ({ date, description: 'HEADWAY APP 22019', amount: -12.99 }));
    const { transactions, unresolved } = categorizeWithRules(rows);
    expect(unresolved).toEqual([]);
    expect(transactions[0]).toMatchObject({ category: 'subscriptions', source: 'rule', ruleId: 'signal:recurring', recurring: true });
  });

  it('leaves unknown merchants for the AI step', () => {
    const { transactions, unresolved } = categorizeWithRules([{ date: '2026-06-01', description: 'HOLLOWAY BARBERS', amount: -35 }]);
    expect(unresolved).toEqual([0]);
    expect(transactions[0]).toMatchObject({ category: 'uncategorized', source: 'none', confidence: 0 });
  });

  it('settles most of the sample statement without AI', () => {
    const rows = generateSampleRows().map((r) => ({ date: `2026-06-01`, description: r.description, amount: r.amount }));
    const { unresolved } = categorizeWithRules(rows);
    expect(unresolved.length / rows.length).toBeLessThan(0.2);
  });
});
