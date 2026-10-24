// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { InvoiceReconciliationPanel } from './invoice-reconciliation';
import type { InvoiceReconciliation } from '../lib/api';

const mock = vi.hoisted(() => ({
  invoiceReconciliation: vi.fn(),
  matchInvoiceIncome: vi.fn(),
  unmatchInvoiceIncome: vi.fn(),
}));
vi.mock('../lib/api', () => ({ api: mock }));
const fixture: InvoiceReconciliation = {
  invoiceId: 'invoice-1',
  currency: 'MYR',
  total: '1500.00',
  paid: '0.00',
  outstanding: '1500.00',
  matches: [],
  candidates: [
    {
      id: 'income-1',
      description: 'Website deposit',
      date: '2025-09-18',
      amount: '2000.00',
      available: '1800.00',
      currency: 'MYR',
      reference: 'REF-123',
    },
  ],
  candidateTotal: 1,
  page: 0,
  size: 10,
};
function mount() {
  return render(
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <InvoiceReconciliationPanel invoiceId="invoice-1" />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.invoiceReconciliation.mockResolvedValue(fixture);
  mock.matchInvoiceIncome.mockResolvedValue(fixture);
  mock.unmatchInvoiceIncome.mockResolvedValue(undefined);
});
afterEach(cleanup);
async function choose() {
  await screen.findByText('Link recorded income');
  fireEvent.click(screen.getByText('Link recorded income'));
  fireEvent.click(screen.getByRole('button', { name: 'Select income' }));
}
it('requires confirmation and submits a partial allocation without creating income', async () => {
  mount();
  await choose();
  const input = screen.getByRole('textbox', { name: 'Amount to apply (MYR)' });
  expect((input as HTMLInputElement).value).toBe('1500.00');
  expect(mock.matchInvoiceIncome).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '500.25' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm link' }));
  await waitFor(() =>
    expect(mock.matchInvoiceIncome).toHaveBeenCalledWith('invoice-1', {
      financialEntryId: 'income-1',
      amount: '500.25',
    }),
  );
  await screen.findByText(/collected sales have not increased/);
});
it('rejects amounts exceeding the invoice balance or using fractions of a cent', async () => {
  mount();
  await choose();
  for (const amount of ['1500.01', '12.345', '-1']) {
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Amount to apply (MYR)' }),
      { target: { value: amount } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm link' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
  }
  expect(mock.matchInvoiceIncome).not.toHaveBeenCalled();
});
it('retains the selection and reports a server conflict without claiming success', async () => {
  mock.matchInvoiceIncome.mockRejectedValue(
    new Error('This receipt has already been allocated.'),
  );
  mount();
  await choose();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm link' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    'already been allocated',
  );
  expect(screen.queryByText(/collected sales have not increased/)).toBeNull();
  expect(
    screen.getByRole('textbox', { name: 'Amount to apply (MYR)' }),
  ).toBeTruthy();
});
it('confirms unlinking and preserves the underlying income', async () => {
  mock.invoiceReconciliation.mockResolvedValue({
    ...fixture,
    paid: '1500.00',
    outstanding: '0.00',
    matches: [
      {
        id: 'match-1',
        financialEntryId: 'income-1',
        description: 'Website deposit',
        date: '2025-09-18',
        amount: '1500.00',
        reference: 'REF-123',
      },
    ],
  });
  mount();
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Remove link to Website deposit',
    }),
  );
  expect(mock.unmatchInvoiceIncome).not.toHaveBeenCalled();
  expect(screen.getByText(/income stays in Financial records/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm remove link' }));
  await waitFor(() =>
    expect(mock.unmatchInvoiceIncome).toHaveBeenCalledWith(
      'invoice-1',
      'match-1',
    ),
  );
  await screen.findByText(/The recorded income remains/);
});
it('paginates and searches candidate income with explicit query parameters', async () => {
  mock.invoiceReconciliation.mockResolvedValue({
    ...fixture,
    candidateTotal: 21,
  });
  mount();
  await screen.findByText('Link recorded income');
  fireEvent.click(screen.getByText('Link recorded income'));
  fireEvent.click(screen.getByRole('button', { name: 'Next income page' }));
  await waitFor(() =>
    expect(mock.invoiceReconciliation.mock.lastCall?.[1].get('page')).toBe('1'),
  );
  fireEvent.change(
    await screen.findByRole('textbox', { name: 'Search recorded income' }),
    { target: { value: 'REF-123' } },
  );
  await waitFor(() =>
    expect(mock.invoiceReconciliation.mock.lastCall?.[1].get('q')).toBe(
      'REF-123',
    ),
  );
  expect(mock.invoiceReconciliation.mock.lastCall?.[1].get('page')).toBe('0');
});

it('opens historical payment matching from Mark as paid without changing revenue or assuming a receipt', async () => {
  mount();
  const button = await screen.findByRole('button', { name: 'Mark as paid' });
  expect(
    screen.getByText('Link recorded income').closest('details')?.open,
  ).toBe(false);
  fireEvent.click(button);
  expect(
    screen.getByText('Link recorded income').closest('details')?.open,
  ).toBe(true);
  expect(mock.matchInvoiceIncome).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Select income' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm link' }));
  await waitFor(() =>
    expect(mock.matchInvoiceIncome).toHaveBeenCalledWith('invoice-1', {
      financialEntryId: 'income-1',
      amount: '1500.00',
    }),
  );
});
it('does not offer Mark as paid for a fully settled invoice', async () => {
  mock.invoiceReconciliation.mockResolvedValue({
    ...fixture,
    paid: '1500.00',
    outstanding: '0.00',
  });
  mount();
  await screen.findByText('Recorded as paid');
  expect(screen.queryByRole('button', { name: 'Mark as paid' })).toBeNull();
});
