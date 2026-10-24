import { describe, expect, it } from 'vitest';
import {
  buildFinancialSheets,
  cellsAsTsv,
  columnLetter,
  sheetAsCsv,
} from './financial-sheets';
import type { FinancialWorkbook } from './tracker-types';
export const workbookFixture: FinancialWorkbook = {
  summary: {
    source: {
      id: 'source',
      name: 'Tracker.xlsx',
      sha256: 'a'.repeat(64),
      currency: 'MYR',
      importedAt: '2026-10-22T00:00:00Z',
      firstDate: '2026-01-01',
      lastDate: '2026-02-01',
      transactionCount: 2,
    },
    years: [2026],
    periodStart: '2026-01-01',
    periodEnd: '2026-02-01',
    income: '100.10',
    expenses: '10.30',
    profit: '89.80',
    margin: '89.71',
    incomeCount: 1,
    expenseCount: 1,
    purchasedAssets: '500.00',
    assets: [{ sourceRow: 27, amount: '500.00' }],
    months: [
      {
        month: '2026-01',
        income: '100.10',
        expenses: '0.00',
        profit: '100.10',
        cumulativeProfit: '100.10',
        transactionCount: 1,
        margin: '100.00',
      },
      {
        month: '2026-02',
        income: '0.00',
        expenses: '10.30',
        profit: '-10.30',
        cumulativeProfit: '89.80',
        transactionCount: 1,
        margin: null,
      },
    ],
    categories: [{ name: 'Software/Tools', amount: '10.30' }],
  },
  transactions: [
    {
      sourceRow: 4,
      date: '2026-01-01',
      type: 'INCOME',
      category: 'Project Revenue',
      description: 'Website deposit',
      amount: '100.10',
      paymentMethod: 'Bank Transfer',
      reference: '001234567890',
      notes: null,
    },
    {
      sourceRow: 9,
      date: '2026-02-01',
      type: 'EXPENSE',
      category: 'Software/Tools',
      description: '=HYPERLINK("https://untrusted.example")',
      amount: '10.30',
      paymentMethod: 'Credit Card',
      reference: null,
      notes: 'Paid personally\nSecond line',
    },
  ],
  categoryRows: [
    {
      type: 'INCOME',
      name: 'Project Revenue',
      amounts: ['100.10', '0.00'],
      total: '100.10',
    },
    {
      type: 'EXPENSE',
      name: 'Software/Tools',
      amounts: ['0.00', '10.30'],
      total: '10.30',
    },
  ],
  expenseBreakdown: [
    {
      name: 'Software/Tools',
      amount: '10.30',
      share: '100.00',
      monthlyAverage: '5.15',
    },
  ],
};
describe('financial workbook display and exports', () => {
  it('uses sequential worksheet positions, preserves record source rows and references, and keeps undated assets separate', () => {
    const sheets = buildFinancialSheets(workbookFixture);
    expect(sheets[0].rows.map((r) => r.number)).toEqual([1, 2, 3, 4, 5]);
    expect(sheets[0].rows[4].record?.sourceRow).toBe(9);
    expect(sheets[0].rows[3].cells[6].raw).toBe('001234567890');
    const profit = sheets[1].rows.find(
      (r) => r.cells[0]?.raw === 'Net Profit',
    )!;
    expect(profit.cells.map((c) => c.raw)).toEqual([
      'Net Profit',
      '100.10',
      '-10.30',
      '89.80',
    ]);
    const margin = sheets[1].rows.find(
      (r) => r.cells[0]?.raw === 'Profit Margin',
    )!;
    expect(margin.cells[2].raw).toBe('—');
    expect(sheets[3].rows[3].cells[2].raw).toBe('');
    expect(sheets[2].rows[3].cells[3].raw).toBe('5.15');
  });
  it('places newly recorded historical income first by date without mutating source records or amounts', () => {
    const historical = {
      ...workbookFixture.transactions[0],
      id: 'rhymes',
      sourceRow: 55,
      date: '2025-10-19',
      description: 'RhymesButterflies Custom Website',
      amount: '400.00',
    };
    const transactions = [...workbookFixture.transactions, historical];
    const sheet = buildFinancialSheets({ ...workbookFixture, transactions })[0];
    expect(sheet.rows.slice(3).map((row) => row.cells[0].raw)).toEqual([
      '2025-10-19',
      '2026-01-01',
      '2026-02-01',
    ]);
    expect(sheet.rows.map((row) => row.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(sheet.rows[3].record).toBe(historical);
    expect(sheet.rows[3].record?.sourceRow).toBe(55);
    expect(transactions[2]).toBe(historical);
    const csv = sheetAsCsv(sheet);
    expect(csv.indexOf('RhymesButterflies')).toBeLessThan(
      csv.indexOf('Website deposit'),
    );
    expect(sheet.rows[3].cells[4].raw).toBe('400.00');
  });
  it('keeps same-day ordering stable by saved source row and repositions edited dates', () => {
    const older = {
      ...workbookFixture.transactions[0],
      sourceRow: 55,
      date: '2026-02-01',
    };
    const newer = { ...workbookFixture.transactions[1], sourceRow: 9 };
    const sheet = buildFinancialSheets({
      ...workbookFixture,
      transactions: [older, newer],
    })[0];
    expect(sheet.rows.slice(3).map((row) => row.record?.sourceRow)).toEqual([
      9, 55,
    ]);
    const updated = { ...older, date: '2025-10-19' };
    expect(
      buildFinancialSheets({
        ...workbookFixture,
        transactions: [newer, updated],
      })[0].rows[3].record,
    ).toBe(updated);
  });
  it('exports exact decimals and protects formula-looking text in CSV and clipboard data', () => {
    const sheet = buildFinancialSheets(workbookFixture)[0];
    const csv = sheetAsCsv(sheet);
    expect(csv).toContain('"100.10"');
    expect(csv).toContain('"\'=HYPERLINK(""https://untrusted.example"")"');
    expect(cellsAsTsv(sheet.rows, 3, 4, 3, 4)).toBe(
      'Website deposit\t100.10\r\n"\'=HYPERLINK(""https://untrusted.example"")"\t10.30',
    );
  });
  it('labels columns beyond Z correctly', () => {
    expect([0, 25, 26, 51, 52].map(columnLetter)).toEqual([
      'A',
      'Z',
      'AA',
      'AZ',
      'BA',
    ]);
  });
});
