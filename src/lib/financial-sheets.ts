import type {
  FinancialWorkbook,
  TrackerTransaction,
  FinancialAsset,
} from './tracker-types';
export type SheetCell = {
  raw: string;
  display: string;
  kind: 'text' | 'money' | 'percent';
  field?: string;
};
export type SheetRow = {
  number: number;
  cells: SheetCell[];
  record?: TrackerTransaction;
  asset?: FinancialAsset;
  tone?: 'title' | 'heading' | 'section' | 'total' | 'profit' | 'note';
};
export type FinancialSheet = {
  id: string;
  name: string;
  columns: number;
  rows: SheetRow[];
  widths: number[];
};
const text = (raw: string | number | null | undefined): SheetCell => ({
  raw: raw == null ? '' : String(raw),
  display: raw == null ? '' : String(raw),
  kind: 'text',
});
const percent = (raw: string | null): SheetCell =>
  raw === null
    ? text('—')
    : {
        raw: `${raw}%`,
        display: `${Number(raw).toFixed(2)}%`,
        kind: 'percent',
      };
const row = (
  number: number,
  cells: SheetCell[],
  tone?: SheetRow['tone'],
): SheetRow => ({ number, cells, tone });
const month = (value: string) =>
  new Intl.DateTimeFormat('en-MY', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}-01T00:00:00Z`));
export function columnLetter(index: number): string {
  let value = index + 1,
    label = '';
  while (value > 0) {
    label = String.fromCharCode(65 + ((value - 1) % 26)) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}
export function buildFinancialSheets(
  workbook: FinancialWorkbook,
  includeTestPayments = false,
): FinancialSheet[] {
  const { summary: data, transactions, categoryRows } = workbook;
  // Worksheet positions follow business dates; source rows remain on each record for provenance.
  const datedTransactions = [...transactions].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.sourceRow - b.sourceRow ||
      (a.id ?? '').localeCompare(b.id ?? ''),
  );
  const currency = data.source?.currency ?? 'MYR';
  const formatter = new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
  const money = (raw: string): SheetCell => ({
    raw,
    display: formatter.format(Number(raw)),
    kind: 'money',
  });
  const log: FinancialSheet = {
    id: 'transactions',
    name: 'Transaction Log',
    columns: 8,
    widths: [120, 110, 165, 430, 150, 150, 180, 270],
    rows: [
      row(1, [text('Business Transaction Log')], 'title'),
      row(
        2,
        [
          text(
            `${currency} · ${includeTestPayments ? 'SANDBOX PREVIEW' : 'Live records'} · Saved changes update the dashboard`,
          ),
        ],
        'note',
      ),
      row(
        3,
        [
          'Date',
          'Type',
          'Category',
          'Description',
          'Amount',
          'Payment Method',
          'Reference/Invoice #',
          'Notes',
        ].map(text),
        'heading',
      ),
      ...datedTransactions.map((t, index) => ({
        ...row(
          index + 4,
          [
            text(t.date),
            text(t.type === 'INCOME' ? 'Income' : 'Expense'),
            text(t.category),
            text(t.description),
            money(t.amount),
            text(t.paymentMethod),
            text(t.reference),
            text(t.notes),
          ].map((cell, i) => ({
            ...cell,
            field:
              t.id && t.source !== 'PAYMENT' && !(i === 1 && t.source === 'OS')
                ? [
                    'date',
                    'type',
                    'category',
                    'description',
                    'amount',
                    'paymentMethod',
                    'reference',
                    'notes',
                  ][i]
                : undefined,
          })),
        ),
        record: t,
      })),
    ],
  };
  let number = 1;
  const monthly: FinancialSheet = {
    id: 'monthly',
    name: 'Monthly Summary',
    columns: data.months.length + 2,
    widths: [250, ...data.months.map(() => 145), 160],
    rows: [],
  };
  const add = (cells: SheetCell[], tone?: SheetRow['tone']) =>
    monthly.rows.push(row(number++, cells, tone));
  add([text('Monthly Profit & Loss Summary')], 'title');
  add(
    [
      text(
        data.periodStart && data.periodEnd
          ? `${data.periodStart} to ${data.periodEnd} · ${currency} · Recorded entries only`
          : 'No entries in this period',
      ),
    ],
    'note',
  );
  add(
    [
      text('Category'),
      ...data.months.map((m) => text(month(m.month))),
      text('Total'),
    ],
    'heading',
  );
  for (const type of ['INCOME', 'EXPENSE'] as const) {
    add([text(type === 'INCOME' ? 'INCOME' : 'EXPENSES')], 'section');
    for (const category of categoryRows.filter((c) => c.type === type))
      add([
        text(category.name),
        ...category.amounts.map(money),
        money(category.total),
      ]);
    add(
      [
        text(type === 'INCOME' ? 'Total Income' : 'Total Expenses'),
        ...data.months.map((m) =>
          money(type === 'INCOME' ? m.income : m.expenses),
        ),
        money(type === 'INCOME' ? data.income : data.expenses),
      ],
      'total',
    );
    add([]);
  }
  add(
    [
      text('Net Profit'),
      ...data.months.map((m) => money(m.profit)),
      money(data.profit),
    ],
    'profit',
  );
  add(
    [
      text('Profit Margin'),
      ...data.months.map((m) => percent(m.margin ?? null)),
      percent(data.margin),
    ],
    'total',
  );
  add(
    [
      text(
        'Purchased investments/assets are undated and shown in their own tab, outside recorded profit.',
      ),
    ],
    'note',
  );
  const breakdown: FinancialSheet = {
    id: 'categories',
    name: 'Category Breakdown',
    columns: 4,
    widths: [250, 170, 160, 190],
    rows: [
      row(1, [text('Expense Category Breakdown')], 'title'),
      row(
        2,
        [
          text(
            `${currency} · Monthly average uses ${data.months.length} calendar months in this period`,
          ),
        ],
        'note',
      ),
      row(
        3,
        [
          'Expense Category',
          'Total Amount',
          '% of Expenses',
          'Monthly Average',
        ].map(text),
        'heading',
      ),
      ...workbook.expenseBreakdown.map((c, i) =>
        row(i + 4, [
          text(c.name),
          money(c.amount),
          percent(c.share),
          c.monthlyAverage === null ? text('—') : money(c.monthlyAverage),
        ]),
      ),
      row(
        workbook.expenseBreakdown.length + 4,
        [
          text('Total Expenses'),
          money(data.expenses),
          Number(data.expenses) === 0 ? text('—') : percent('100.00'),
        ],
        'total',
      ),
    ],
  };
  const assets: FinancialSheet = {
    id: 'assets',
    name: 'Investments / Assets',
    columns: 4,
    widths: [220, 200, 170, 300],
    rows: [
      row(1, [text('Purchased Investments / Assets')], 'title'),
      row(
        2,
        [
          text(
            'Undated purchases · All history · Excluded from recorded profit',
          ),
        ],
        'note',
      ),
      row(
        3,
        [
          'Description',
          `Purchase Amount (${currency})`,
          'Purchase Date',
          'Source',
        ].map(text),
        'heading',
      ),
      ...data.assets.map((a, i) => ({
        ...row(i + 4, [
          {
            ...text(a.description ?? ''),
            display: a.description || 'Not recorded',
            field: a.id ? 'description' : undefined,
          },
          { ...money(a.amount), field: a.id ? 'amount' : undefined },
          {
            ...text(a.purchaseDate ?? ''),
            display: a.purchaseDate || 'Not recorded',
            field: a.id ? 'purchaseDate' : undefined,
          },
          text(
            a.source === 'MANUAL'
              ? 'Recorded in OS'
              : `Original workbook · Row ${a.sourceRow}`,
          ),
        ]),
        asset: a,
      })),
      row(
        data.assets.length + 4,
        [text('Total Purchases'), money(data.purchasedAssets)],
        'total',
      ),
    ],
  };
  return [log, monthly, breakdown, assets];
}
/** Excel can evaluate pasted/exported text as formulas; preserve those cells as literal text. */
function safeRaw(cell: SheetCell | undefined): string {
  if (!cell) return '';
  return cell.kind === 'text' && /^[\s\u0000-\u001f]*[=+\-@]/.test(cell.raw)
    ? `'${cell.raw}`
    : cell.raw;
}
export function cellsAsTsv(
  rows: SheetRow[],
  fromRow: number,
  toRow: number,
  fromCol: number,
  toCol: number,
): string {
  const escape = (value: string) =>
    /[\t\r\n"]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return rows
    .slice(fromRow, toRow + 1)
    .map((r) =>
      Array.from({ length: toCol - fromCol + 1 }, (_, i) =>
        escape(safeRaw(r.cells[fromCol + i])),
      ).join('\t'),
    )
    .join('\r\n');
}
export function sheetAsCsv(sheet: FinancialSheet): string {
  return (
    '\uFEFF' +
    sheet.rows
      .map((r) =>
        Array.from(
          { length: sheet.columns },
          (_, i) => `"${safeRaw(r.cells[i]).replaceAll('"', '""')}"`,
        ).join(','),
      )
      .join('\r\n')
  );
}
