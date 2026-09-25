import { guessDateFormat, parseDate } from './dates';

describe('guessDateFormat', () => {
  it('detects DD/MM when a first part is above 12', () => {
    expect(guessDateFormat(['03/04/2026', '25/04/2026'])).toEqual({ order: 'DMY', label: 'DD/MM/YYYY', ambiguous: false });
  });

  it('detects MM/DD when a second part is above 12', () => {
    expect(guessDateFormat(['03/04/2026', '04/25/2026'])).toEqual({ order: 'MDY', label: 'MM/DD/YYYY', ambiguous: false });
  });

  it('flags files where every date could be read both ways', () => {
    expect(guessDateFormat(['03.04.2026', '05.06.2026'])).toMatchObject({ label: 'DD.MM.YYYY', ambiguous: true });
  });

  it('recognises ISO dates', () => {
    expect(guessDateFormat(['2026-06-01'])).toMatchObject({ label: 'YYYY-MM-DD', ambiguous: false });
  });
});

describe('parseDate', () => {
  it.each([
    ['2026-06-01', 'DMY', '2026-06-01'],
    ['2026-06-01T10:22:00', 'DMY', '2026-06-01'],
    ['03/04/2026', 'DMY', '2026-04-03'],
    ['03/04/2026', 'MDY', '2026-03-04'],
    ['3.4.26', 'DMY', '2026-04-03'],
    ['15 Jan 2026', 'DMY', '2026-01-15'],
    ['15-Sep-2026', 'DMY', '2026-09-15'],
    ['Jan 15, 2026', 'MDY', '2026-01-15'],
    ['September 5 2026', 'MDY', '2026-09-05'],
  ] as const)('%s (%s) -> %s', (raw, order, expected) => {
    expect(parseDate(raw, order)).toBe(expected);
  });

  it.each(['31/02/2026', 'yesterday', '', '2026-13-01'])('rejects %p', (raw) => {
    expect(parseDate(raw, 'DMY')).toBeNull();
  });
});
