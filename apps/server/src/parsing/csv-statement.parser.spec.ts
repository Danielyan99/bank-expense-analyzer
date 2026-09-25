import { generateSampleCsv } from '../sample/sample-statement';
import { parseStatementCsv, StatementParseError } from './csv-statement.parser';

describe('parseStatementCsv', () => {
  it('reads a signed Amount column and sorts by date', () => {
    const { rows, report } = parseStatementCsv(
      ['Date,Description,Amount', '2026-06-03,STARBUCKS,-4.50', '2026-06-01,PAYROLL,2000.00'].join('\n'),
    );
    expect(rows).toEqual([
      { date: '2026-06-01', description: 'PAYROLL', amount: 2000 },
      { date: '2026-06-03', description: 'STARBUCKS', amount: -4.5 },
    ]);
    expect(report.columns).toEqual({ date: 'Date', description: 'Description', amount: 'Amount' });
  });

  it('combines separate Debit and Credit columns', () => {
    const { rows, report } = parseStatementCsv(
      [
        'Posting Date,Details,Debit,Credit,Balance',
        '01/06/2026,TESCO STORES,23.10,,976.90',
        '25/06/2026,SALARY ACME LTD,,1500.00,2476.90',
      ].join('\n'),
    );
    expect(rows.map((r) => r.amount)).toEqual([-23.1, 1500]);
    expect(report.columns.amount).toBe('Debit / Credit');
    expect(report.dateFormat).toBe('DD/MM/YYYY');
  });

  it('handles semicolons, European numbers and a DR/CR type column', () => {
    const { rows } = parseStatementCsv(
      ['Buchungstag;Text;Amount;Type', '15.06.2026;REWE MARKT;12,99;DR', '16.06.2026;GEHALT;2.100,00;CR'].join('\n'),
    );
    // "Buchungstag" is not an English header, so the parser falls back to content detection.
    expect(rows.map((r) => r.amount)).toEqual([-12.99, 2100]);
  });

  it('skips a preamble above the header row', () => {
    const { rows } = parseStatementCsv(
      ['Account,XXXX1234', 'Period,June 2026', '', 'Transaction Date,Description,Amount', '06/02/2026,LYFT,-9.10'].join(
        '\n',
      ),
    );
    expect(rows).toHaveLength(1);
  });

  it('keeps quoted commas inside descriptions', () => {
    const { rows } = parseStatementCsv(['Date,Description,Amount', '2026-06-01,"SMITH, JONES & CO",-10'].join('\n'));
    expect(rows[0].description).toBe('SMITH, JONES & CO');
  });

  it('treats an all-positive amount column as spending and says so', () => {
    const { rows, report } = parseStatementCsv(['Date,Description,Amount', '2026-06-01,CAFE,4', '2026-06-02,BAR,8'].join('\n'));
    expect(rows.map((r) => r.amount)).toEqual([-4, -8]);
    expect(report.warnings).toContain('Every amount was positive, so they were treated as spending.');
  });

  it('parses a file with no header row from its content', () => {
    const { rows, report } = parseStatementCsv(['2026-06-01,UBER TRIP,-12.40', '2026-06-02,WHOLE FOODS MARKET,-56.00'].join('\n'));
    expect(rows).toHaveLength(2);
    expect(report.warnings[0]).toMatch(/No header row/);
  });

  it('counts and reports rows it cannot read', () => {
    const { rows, report } = parseStatementCsv(
      ['Date,Description,Amount', '2026-06-01,OK,-1', 'not a date,BAD,-1', '2026-06-02,,-1'].join('\n'),
    );
    expect(rows).toHaveLength(1);
    expect(report.rowsSkipped).toBe(2);
  });

  it('throws a readable error when there is no amount column', () => {
    expect(() => parseStatementCsv('Date,Description,Notes\n2026-06-01,X,Y')).toThrow(StatementParseError);
  });

  it('throws on an empty file', () => {
    expect(() => parseStatementCsv('')).toThrow('The file is empty.');
  });

  it('reads the bundled sample statement', () => {
    const { rows, report, currency } = parseStatementCsv(generateSampleCsv());
    expect(rows.length).toBeGreaterThan(150);
    expect(report.rowsSkipped).toBe(0);
    expect(report.dateFormat).toBe('MM/DD/YYYY');
    expect(currency).toBe('USD');
  });
});
