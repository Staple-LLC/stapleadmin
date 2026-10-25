import { chooseSelectValue } from '../test-utils/select';
// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import FinancialDashboard from './financial-dashboard';
import type { FinancialOverview } from '../lib/api';
import type { TrackerSummary } from '../lib/tracker-types';

const mock = vi.hoisted(() => ({
  financialOverview: vi.fn(),
  trackerTransactions: vi.fn(),
  animations: [] as boolean[],
}));
vi.mock('../lib/api', () => ({ api: mock }));
vi.mock('recharts', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const Shape = ({ isAnimationActive }: { isAnimationActive: boolean }) => {
    mock.animations.push(isAnimationActive);
    return null;
  };
  const Empty = () => null;
  return {
    ResponsiveContainer: Container,
    BarChart: Container,
    AreaChart: Empty,
    PieChart: Container,
    Pie: Shape,
    Bar: Shape,
    Area: Shape,
    Cell: Empty,
    CartesianGrid: Empty,
    ReferenceLine: Empty,
    Tooltip: Empty,
    XAxis: Empty,
    YAxis: Empty,
  };
});
const summary: TrackerSummary = {
  source: {
    id: 'snapshot',
    name: 'Live records',
    sha256: null,
    currency: 'MYR',
    firstDate: '2025-12-16',
    lastDate: '2026-10-21',
    transactionCount: 4,
  },
  years: [2025, 2026],
  periodStart: '2026-10-01',
  periodEnd: '2026-10-21',
  income: '190.30',
  expenses: '10.30',
  profit: '180.00',
  margin: '94.59',
  incomeCount: 3,
  expenseCount: 1,
  purchasedAssets: '500.00',
  assets: [{ sourceRow: 27, amount: '500.00' }],
  months: [
    {
      month: '2026-10',
      income: '0.00',
      expenses: '10.30',
      profit: '-10.30',
      cumulativeProfit: '-10.30',
      transactionCount: 1,
    },
  ],
  categories: [{ name: 'Software/Tools', amount: '10.30' }],
};
const fixture: FinancialOverview = {
  period: 'month',
  from: '2026-10-01',
  to: '2026-10-31',
  asOf: '2026-10-24',
  currency: 'MYR',
  summary,
  lifetime: { income: '1000.00', expenses: '100.00', net: '900.00' },
  invoiced: '2200.00',
  outstanding: '3000.00',
  overdue: '1000.00',
  outstandingCount: 2,
  overdueCount: 1,
  customers: 6,
  openLeads: 0,
  liveWebsites: 6,
};
function mount() {
  return render(
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <FinancialDashboard />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
const collectedCard = () =>
  screen.getByRole('button', { name: /^Sales collected/ });
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  mock.animations.length = 0;
  mock.financialOverview.mockImplementation(async (params: URLSearchParams) => {
    const period = params.get('period') as FinancialOverview['period'];
    const currency = params.get('currency')!;
    const [from, to] =
      period === 'custom'
        ? [params.get('from'), params.get('to')]
        : period === 'all'
          ? [null, null]
          : period === 'year'
            ? ['2026-01-01', '2026-12-31']
            : [fixture.from, fixture.to];
    return {
      ...fixture,
      period,
      from,
      to,
      currency,
      summary: { ...summary, source: { ...summary.source, currency } },
    };
  });
  mock.trackerTransactions.mockImplementation(
    async (params: URLSearchParams) => ({
      content: [],
      page: Number(params.get('page')),
      size: 10,
      totalElements: 21,
      totalPages: 3,
    }),
  );
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('combines period and lifetime totals without adding invoiced amounts, and keeps outstanding as of today', async () => {
  mount();
  await screen.findByRole('button', { name: /^Sales collected/ });
  expect(mock.financialOverview.mock.lastCall?.[0].get('period')).toBe('month');
  expect(collectedCard().textContent).toContain('190.30');
  expect(collectedCard().textContent).toContain('1,000.00');
  expect(collectedCard().textContent).not.toContain('2,200.00');
  const outstanding = screen.getByRole('button', {
    name: /^Outstanding invoices/,
  });
  expect(outstanding.textContent).toContain('3,000.00');
  expect(outstanding.textContent).toContain('As of 24 Oct 2026');
  expect(outstanding.textContent).toContain('1,000.00 overdue');
  expect(
    screen
      .getByRole('link', { name: /Review & match invoices/ })
      .getAttribute('href'),
  ).toBe('/invoices');
  const operations = screen.getByRole('region', { name: 'Your operations' });
  expect(within(operations).getAllByText('6')).toHaveLength(2);
  expect(within(operations).getByText('0')).toBeTruthy();
  fireEvent.click(collectedCard());
  expect(
    screen.getByRole('region', { name: 'Sales collected explained' })
      .textContent,
  ).toContain('does not add that income again');
});

it('keeps purchased assets across all history and preserves a monthly table including negative net income', async () => {
  mount();
  await screen.findByRole('button', { name: /^Sales collected/ });
  fireEvent.click(screen.getByText('Income trend & purchased assets'));
  expect(screen.getByText(/purchases recorded in OS/).textContent).toContain(
    'regardless of the selected period',
  );
  const asset = screen.getByRole('region', { name: 'Building for the future' });
  expect(within(asset).getAllByText(/500\.00/).length).toBeGreaterThan(0);
  const table = screen.getByRole('table', {
    name: 'Monthly collected sales, expenses and income less expenses in MYR',
    hidden: true,
  });
  expect(within(table).getAllByText(/-.*10\.30/)).toHaveLength(2);
  expect(screen.getByText(/latest entry/).textContent).toContain('21 Oct 2026');
});

it('applies the server reporting dates and currency to transactions and resets pagination', async () => {
  mount();
  await screen.findByRole('button', { name: /^Sales collected/ });
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: 'Next transactions page' })
        .hasAttribute('disabled'),
    ).toBe(false),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Next transactions page' }),
  );
  await waitFor(() =>
    expect(mock.trackerTransactions.mock.lastCall?.[0].get('page')).toBe('1'),
  );
  await chooseSelectValue(
    screen.getByRole('combobox', { name: 'Reporting period' }),
    'year',
  );
  await waitFor(() =>
    expect(mock.trackerTransactions.mock.lastCall?.[0].get('from')).toBe(
      '2026-01-01',
    ),
  );
  expect(mock.trackerTransactions.mock.lastCall?.[0].get('to')).toBe(
    '2026-12-31',
  );
  expect(mock.trackerTransactions.mock.lastCall?.[0].get('page')).toBe('0');
  await chooseSelectValue(
    screen.getByRole('combobox', { name: 'Dashboard currency' }),
    'SGD',
  );
  await waitFor(() =>
    expect(mock.trackerTransactions.mock.lastCall?.[0].get('currency')).toBe(
      'SGD',
    ),
  );
  expect(mock.financialOverview.mock.lastCall?.[0].get('period')).toBe('year');
  expect(mock.financialOverview.mock.lastCall?.[0].get('currency')).toBe('SGD');
  expect(mock.trackerTransactions.mock.lastCall?.[0].get('from')).toBe(
    '2026-01-01',
  );
  expect(
    screen.getByRole('button', { name: /^Outstanding invoices/ }).textContent,
  ).toContain('As of 24 Oct 2026');
});

it('uses inclusive custom dates for every request and removes date limits for All time', async () => {
  mount();
  await screen.findByRole('button', { name: /^Sales collected/ });
  await chooseSelectValue(
    screen.getByRole('combobox', { name: 'Reporting period' }),
    'custom',
  );
  fireEvent.change(screen.getByLabelText('Reporting start date'), {
    target: { value: '2025-09-01' },
  });
  fireEvent.change(screen.getByLabelText('Reporting end date'), {
    target: { value: '2025-09-30' },
  });
  await waitFor(() =>
    expect(mock.trackerTransactions.mock.lastCall?.[0].get('to')).toBe(
      '2025-09-30',
    ),
  );
  expect(mock.trackerTransactions.mock.lastCall?.[0].get('from')).toBe(
    '2025-09-01',
  );
  expect(mock.financialOverview.mock.lastCall?.[0].get('from')).toBe(
    '2025-09-01',
  );
  expect(mock.financialOverview.mock.lastCall?.[0].get('to')).toBe(
    '2025-09-30',
  );
  expect(screen.getByText(/1 Sept 2025.*30 Sept 2025/)).toBeTruthy();
  await chooseSelectValue(
    screen.getByRole('combobox', { name: 'Reporting period' }),
    'all',
  );
  await waitFor(() =>
    expect(mock.trackerTransactions.mock.lastCall?.[0].has('from')).toBe(false),
  );
  expect(mock.trackerTransactions.mock.lastCall?.[0].has('to')).toBe(false);
});

it('does not request a reversed custom date range', async () => {
  mount();
  await screen.findByRole('button', { name: /^Sales collected/ });
  await chooseSelectValue(
    screen.getByRole('combobox', { name: 'Reporting period' }),
    'custom',
  );
  fireEvent.change(screen.getByLabelText('Reporting end date'), {
    target: { value: '2020-01-01' },
  });
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(mock.financialOverview.mock.lastCall?.[0].get('to')).not.toBe(
    '2020-01-01',
  );
});

it('filters transactions without changing chart totals and respects reduced motion', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  mount();
  await screen.findByRole('button', { name: /^Sales collected/ });
  await chooseSelectValue(
    screen.getByRole('combobox', { name: 'Transaction type' }),
    'EXPENSE',
  );
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Search transactions' }),
    { target: { value: 'personally' } },
  );
  await waitFor(() =>
    expect(mock.trackerTransactions.mock.lastCall?.[0].get('q')).toBe(
      'personally',
    ),
  );
  expect(mock.trackerTransactions.mock.lastCall?.[0].get('type')).toBe(
    'EXPENSE',
  );
  expect(mock.financialOverview).toHaveBeenCalledTimes(1);
  expect(mock.animations.length).toBeGreaterThan(0);
  expect(mock.animations.every((value) => !value)).toBe(true);
});

it('shows explicit zero activity while preserving lifetime and invoice amounts in an empty period', async () => {
  mock.financialOverview.mockResolvedValue({
    ...fixture,
    summary: {
      ...summary,
      source: null,
      income: '0.00',
      expenses: '0.00',
      profit: '0.00',
      incomeCount: 0,
      expenseCount: 0,
      months: [],
      categories: [],
    },
  });
  mount();
  await screen.findByText('No transactions recorded in this period.');
  expect(collectedCard().textContent).toContain('0.00');
  expect(collectedCard().textContent).toContain('1,000.00');
  expect(
    screen.getByRole('button', { name: /^Outstanding invoices/ }).textContent,
  ).toContain('3,000.00');
});

it('offers a retry when financial data cannot be loaded', async () => {
  mock.financialOverview.mockRejectedValueOnce(
    new Error('Service unavailable'),
  );
  mount();
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByRole('button', { name: /^Sales collected/ });
});

it('requests sandbox totals only while the test toggle is enabled', async () => {
  mount();
  await screen.findByRole('button', { name: /^Sales collected/ });
  expect(
    mock.financialOverview.mock.lastCall?.[0].has('includeTestPayments'),
  ).toBe(false);
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Include test payments' }),
  );
  await waitFor(() =>
    expect(
      mock.financialOverview.mock.lastCall?.[0].get('includeTestPayments'),
    ).toBe('true'),
  );
  expect(screen.getByText(/Sandbox preview: totals/).textContent).toContain(
    'Sandbox preview',
  );
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Include test payments' }),
  );
  await waitFor(() =>
    expect(screen.queryByText(/Sandbox preview: totals/)).toBeNull(),
  );
  expect(sessionStorage.getItem('staple-financial-test-preview')).toBe('false');
});
