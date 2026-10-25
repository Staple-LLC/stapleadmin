// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WorkbookGrid } from './financial-workbook';
import { buildFinancialSheets } from '../lib/financial-sheets';
import type { FinancialWorkbook } from '../lib/tracker-types';
const workbook: FinancialWorkbook = {
  summary: {
    source: null,
    years: [2026],
    periodStart: '2026-01-01',
    periodEnd: '2026-01-01',
    income: '100.10',
    expenses: '0.00',
    profit: '100.10',
    margin: '100.00',
    incomeCount: 1,
    expenseCount: 0,
    purchasedAssets: '0.00',
    assets: [],
    months: [],
    categories: [],
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
      reference: '001234',
      notes: null,
    },
  ],
  categoryRows: [],
  expenseBreakdown: [],
};
const copy = vi.fn();
beforeEach(() => {
  copy.mockReset();
  copy.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: copy },
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('selects cells, shows their full value and navigates with arrow keys', () => {
  render(<WorkbookGrid sheet={buildFinancialSheets(workbook)[0]} />);
  const cell = screen.getByRole('gridcell', { name: /^D4:/ });
  fireEvent.click(cell);
  expect(screen.getByLabelText('Selected cell').textContent).toBe('D4');
  expect(screen.getByLabelText('Selected cell value').textContent).toBe(
    'Website deposit',
  );
  fireEvent.keyDown(cell, { key: 'ArrowRight' });
  expect(screen.getByLabelText('Selected cell').textContent).toBe('E4');
  expect(screen.getByLabelText('Selected cell value').textContent).toBe(
    '100.10',
  );
});
it('copies a rectangular selection as Excel-compatible tab-separated cells', async () => {
  render(<WorkbookGrid sheet={buildFinancialSheets(workbook)[0]} />);
  fireEvent.click(screen.getByRole('gridcell', { name: /^D4:/ }));
  fireEvent.click(screen.getByRole('gridcell', { name: /^E4:/ }), {
    shiftKey: true,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Copy cells' }));
  await waitFor(() =>
    expect(copy).toHaveBeenCalledWith('Website deposit\t100.10'),
  );
  expect(screen.getByRole('grid').getAttribute('aria-readonly')).toBe('true');
});
it('filters displayed rows without changing source row labels', () => {
  render(<WorkbookGrid sheet={buildFinancialSheets(workbook)[0]} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Filter sheet rows' }), {
    target: { value: 'no match' },
  });
  expect(screen.queryByRole('gridcell', { name: /^D4:/ })).toBeNull();
  expect(screen.getByRole('gridcell', { name: /^A1:/ })).toBeTruthy();
});
it('saves an edited cell with the original row version and retains failed drafts', async () => {
  const data = structuredClone(workbook);
  data.transactions[0] = {
    ...data.transactions[0],
    id: 'record-1',
    version: 7,
    currency: 'MYR',
    source: 'MANUAL',
  };
  const commit = vi
    .fn()
    .mockRejectedValueOnce(new Error('Another user changed this record'))
    .mockResolvedValue(undefined);
  render(
    <WorkbookGrid sheet={buildFinancialSheets(data)[0]} onCommit={commit} />,
  );
  fireEvent.doubleClick(screen.getByRole('gridcell', { name: /^E4:/ }));
  fireEvent.change(screen.getByLabelText('Edit cell value'), {
    target: { value: '125.25' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save cell' }));
  await waitFor(() =>
    expect(screen.getByText('Another user changed this record')).toBeTruthy(),
  );
  expect(
    (screen.getByLabelText('Edit cell value') as HTMLInputElement).value,
  ).toBe('125.25');
  expect(commit.mock.calls[0][0].record.version).toBe(7);
  expect(commit.mock.calls[0].slice(1)).toEqual(['amount', '125.25']);
  fireEvent.click(screen.getByRole('button', { name: 'Save cell' }));
  await waitFor(() =>
    expect(screen.queryByLabelText('Edit cell value')).toBeNull(),
  );
});

it('uses server page metadata and requests another page instead of slicing the downloaded rows', () => {
  const onPageChange = vi.fn();
  const onSearchChange = vi.fn();
  const data = {
    ...workbook,
    transactionPage: {
      content: workbook.transactions,
      page: 1,
      size: 50,
      totalElements: 125,
      totalPages: 3,
    },
  };
  render(
    <WorkbookGrid
      sheet={buildFinancialSheets(data)[0]}
      remote={{
        ...data.transactionPage,
        search: '',
        onPageChange,
        onSearchChange,
      }}
    />,
  );
  expect(screen.getByText('51–100 of 125 transactions')).toBeTruthy();
  expect(screen.getByRole('gridcell', { name: /^D54:/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Next sheet page' }));
  expect(onPageChange).toHaveBeenCalledWith(2);
  fireEvent.change(screen.getByLabelText('Filter sheet rows'), {
    target: { value: 'Website' },
  });
  expect(onSearchChange).toHaveBeenCalledWith('Website');
});

it('requests the complete matching sheet for export rather than exporting only the visible page', async () => {
  const onExport = vi.fn().mockResolvedValue(buildFinancialSheets(workbook)[0]);
  const createObjectURL = vi.fn().mockReturnValue('blob:csv-fixture');
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  render(
    <WorkbookGrid
      sheet={buildFinancialSheets(workbook)[0]}
      onExport={onExport}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
  expect(onExport).toHaveBeenCalledTimes(1);
  expect(screen.getByText('CSV exported')).toBeTruthy();
  click.mockRestore();
});
