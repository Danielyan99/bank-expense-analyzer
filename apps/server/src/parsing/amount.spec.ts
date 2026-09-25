import { detectCurrency, parseAmount } from './amount';

describe('parseAmount', () => {
  it.each([
    ['12.50', 12.5],
    ['-12.50', -12.5],
    ['(12.50)', -12.5],
    ['12.50-', -12.5],
    ['$1,234.56', 1234.56],
    ['-$1,234.56', -1234.56],
    ['1.234,56', 1234.56],
    ['12,50', 12.5],
    ['1,250', 1250],
    ['1.250.000', 1250000],
    ['€ 99,99', 99.99],
    ['45.00 DR', -45],
    ['45.00 CR', 45],
    ['USD 7.10', 7.1],
  ])('%s -> %d', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it.each(['', '   ', 'n/a', undefined])('returns null for %p', (raw) => {
    expect(parseAmount(raw)).toBeNull();
  });
});

describe('detectCurrency', () => {
  it('picks the most common symbol or code', () => {
    expect(detectCurrency(['€12,00', '€3,50', '$1.00'])).toBe('EUR');
    expect(detectCurrency(['GBP 12.00'])).toBe('GBP');
  });

  it('defaults to USD', () => {
    expect(detectCurrency(['12.00', '-3.50'])).toBe('USD');
  });
});
