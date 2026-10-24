import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  Globe,
  Users,
  Info,
  FileSpreadsheet,
  Landmark,
  Search,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, type FinancialOverview } from '../lib/api';
import { currencies } from '../lib/financial-records';
import { Button } from './ui/button';
import './financial-dashboard.css';

const colors = ['#367763', '#c49a61', '#8696bf', '#bb8076', '#718c93'];
const currency = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
  minimumFractionDigits: 2,
});
export const formatMYR = (amount: string | number) =>
  currency.format(Number(amount));
const date = (value: string) =>
  new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
const month = (value: string) =>
  new Intl.DateTimeFormat('en-MY', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${value}-01T00:00:00Z`));
const compact = (value: number) =>
  new Intl.NumberFormat('en-MY', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
const tooltipStyle = {
  borderRadius: 10,
  border: '1px solid #dfe8e1',
  fontSize: 12,
  boxShadow: '0 8px 28px #1b3d2912',
};

export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

export default function FinancialDashboard() {
  const [period, setPeriod] = useState<FinancialOverview['period']>('month');
  const [selectedCurrency, setCurrency] = useState(() => {
    const requested =
      new URLSearchParams(window.location.search).get('currency') ?? 'MYR';
    return currencies.includes(requested) ? requested : 'MYR';
  });
  const [from, setFrom] = useState(
    () => `${new Date().toISOString().slice(0, 7)}-01`,
  );
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const invalidRange = period === 'custom' && (!from || !to || from > to);
  const params = new URLSearchParams({
    period,
    currency: selectedCurrency,
    ...(period === 'custom' ? { from, to } : {}),
  });
  const query = useQuery({
    queryKey: ['dashboard', 'overview', params.toString()],
    refetchInterval: 15000,
    enabled: !invalidRange,
    queryFn: () => api.financialOverview(params),
  });
  return (
    <section className="financial-dashboard" aria-label="Financial dashboard">
      <div className="page-heading finance-heading">
        <div>
          <p className="eyebrow">YOUR BUSINESS, IN PERSPECTIVE</p>
          <h1>
            Financial overview<span className="heading-dot">.</span>
          </h1>
          <p className="muted">Your sales, spending and invoices, together.</p>
        </div>
        <div className="finance-period-controls">
          <label className="period-select">
            <span>Reporting period</span>
            <select
              aria-label="Reporting period"
              value={period}
              onChange={(e) =>
                setPeriod(e.target.value as FinancialOverview['period'])
              }
            >
              <option value="month">This month</option>
              <option value="year">This year</option>
              <option value="all">All time</option>
              <option value="custom">Custom dates</option>
            </select>
          </label>
          <label className="period-select">
            <span>Currency</span>
            <select
              aria-label="Dashboard currency"
              value={selectedCurrency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {period === 'custom' && (
        <div className="finance-custom-dates">
          <label className="period-select">
            <span>From</span>
            <input
              type="date"
              aria-label="Reporting start date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="period-select">
            <span>To</span>
            <input
              type="date"
              aria-label="Reporting end date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <span>Includes both dates. Reporting dates use UTC.</span>
        </div>
      )}
      {invalidRange ? (
        <div className="finance-state" role="alert">
          Choose a start and end date, with the end on or after the start.
        </div>
      ) : query.isPending ? (
        <div className="finance-loading" role="status">
          <span className="loading-dot" />
          Loading financial records…
        </div>
      ) : query.isError ? (
        <div className="finance-state" role="alert">
          <h2>Couldn’t load your financial records</h2>
          <p>{query.error.message}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <FinancialReport key={params.toString()} overview={query.data} />
      )}
    </section>
  );
}

export function FinancialReport({ overview }: { overview: FinancialOverview }) {
  const data = overview.summary;
  const currency = overview.currency;
  const formatMYR = (value: string | number) =>
    new Intl.NumberFormat('en-MY', { style: 'currency', currency }).format(
      Number(value),
    );
  const tooltipMoney = (value: unknown) => formatMYR(Number(value));
  const reduced = useReducedMotion();
  const [profitView, setProfitView] = useState<'profit' | 'cumulativeProfit'>(
    'profit',
  );
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const series = data.months.map((m) => ({
    ...m,
    label: month(m.month),
    income: Number(m.income),
    expenses: Number(m.expenses),
    profit: Number(m.profit),
    cumulativeProfit: Number(m.cumulativeProfit),
  }));
  const categories = data.categories.map((c, i) => ({
    ...c,
    amount: Number(c.amount),
    fill: colors[i % colors.length],
  }));
  const period =
    overview.from && overview.to
      ? `${date(overview.from)} – ${date(overview.to)}`
      : 'All recorded history';
  const anim = {
    isAnimationActive: !reduced,
    animationDuration: 1000,
    animationEasing: 'ease-out' as const,
  };
  const metrics = [
    {
      label: 'Sales collected',
      value: data.income,
      lifetime: overview.lifetime.income,
      note: `${data.incomeCount} recorded receipts`,
      icon: ArrowDownLeft,
      tone: 'income',
      explanation:
        'Money received in the selected period, based on each receipt’s original date. Linking an invoice to income already recorded does not add that income again.',
    },
    {
      label: 'Recorded expenses',
      value: data.expenses,
      lifetime: overview.lifetime.expenses,
      note: `${data.expenseCount} expense entries`,
      icon: ArrowUpRight,
      tone: 'expense',
      explanation:
        'Expenses recorded within the selected dates. Purchased assets are shown separately below.',
    },
    {
      label: 'Income less expenses',
      value: data.profit,
      lifetime: overview.lifetime.net,
      note: 'Collected sales − recorded expenses',
      icon: TrendingUp,
      tone: 'net',
      explanation:
        'Collected sales minus recorded expenses for this period. This is not an accounting profit calculation; purchased assets and depreciation are excluded.',
    },
    {
      label: 'Outstanding invoices',
      value: overview.outstanding,
      lifetime: null,
      note: `As of ${date(overview.asOf)}`,
      icon: ReceiptText,
      tone: 'outstanding',
      explanation:
        'The remaining balance on issued invoices across all dates, after recorded payments and matched income. Historical invoices already paid should be linked to their existing income records.',
    },
  ];
  const detail = metrics.find((metric) => metric.label === selectedMetric);
  const noEntries = data.incomeCount + data.expenseCount === 0;
  return (
    <>
      <div className="source-strip">
        <span>
          <span className="source-dot" />
          Live financial records
          <span className="source-separator">/</span>
          {period}
        </span>
        <span>
          {currency} · {data.incomeCount + data.expenseCount} transactions · UTC
        </span>
      </div>
      <div className="finance-kpis">
        {metrics.map(
          ({ label, value, lifetime, note, icon: Icon, tone }, index) => (
            <button
              type="button"
              className={`finance-kpi ${tone}`}
              key={label}
              style={{ animationDelay: `${index * 60}ms` }}
              aria-expanded={selectedMetric === label}
              aria-controls="finance-metric-detail"
              onClick={() =>
                setSelectedMetric(selectedMetric === label ? null : label)
              }
            >
              <span className="finance-kpi-label">
                {label}
                <span>
                  <Icon size={17} />
                </span>
              </span>
              <strong>{formatMYR(value)}</strong>
              <span className="finance-kpi-note">{note}</span>
              {lifetime !== null ? (
                <span className="finance-lifetime">
                  All time <b>{formatMYR(lifetime)}</b>
                </span>
              ) : (
                <span className="finance-lifetime">
                  {overview.overdueCount > 0
                    ? `${formatMYR(overview.overdue)} overdue · ${overview.overdueCount} ${overview.overdueCount === 1 ? 'invoice' : 'invoices'}`
                    : 'No overdue balance'}
                </span>
              )}
            </button>
          ),
        )}
      </div>
      {detail && (
        <div
          className="finance-metric-detail"
          id="finance-metric-detail"
          role="region"
          aria-label={`${detail.label} explained`}
        >
          <Info size={17} />
          <p>
            <strong>{detail.label}</strong>
            {detail.explanation}
          </p>
        </div>
      )}
      {noEntries && (
        <div className="finance-empty-period" role="status">
          <FileSpreadsheet size={20} />
          <p>
            <strong>No transactions recorded in this period.</strong> Lifetime
            totals and outstanding invoices remain visible. Choose All time to
            see earlier records.
          </p>
        </div>
      )}
      <div className="finance-billing-strip">
        <div>
          <ReceiptText size={19} />
          <span>
            Invoiced in this period{' '}
            <strong>{formatMYR(overview.invoiced)}</strong>
          </span>
        </div>
        <p>
          Invoices show amounts billed. Collected sales above show money
          received.
        </p>
        <Link to="/invoices">
          Review & match invoices <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="finance-main-grid">
        <section
          className="chart-panel trend-panel"
          aria-labelledby="income-chart-title"
        >
          <div className="chart-heading">
            <div>
              <p className="eyebrow">THE BIG PICTURE</p>
              <h2 id="income-chart-title">Sales collected & expenses</h2>
            </div>
            <div className="chart-legend">
              <span>
                <i style={{ background: '#367763' }} />
                Sales collected
              </span>
              <span>
                <i style={{ background: '#d4b88d' }} />
                Expenses
              </span>
            </div>
          </div>
          <p className="chart-subtitle">
            Monthly totals within the selected dates
          </p>
          <div
            className="finance-chart"
            aria-label="Monthly income and expenses chart"
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={series}
                margin={{ top: 20, right: 8, left: -12, bottom: 0 }}
                barGap={3}
                accessibilityLayer
              >
                <CartesianGrid
                  strokeDasharray="3 5"
                  vertical={false}
                  stroke="#e9ede9"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#7b877f', fontSize: 10 }}
                  minTickGap={12}
                  dy={9}
                />
                <YAxis
                  tickFormatter={compact}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#8b968e', fontSize: 10 }}
                />
                <Tooltip
                  formatter={tooltipMoney}
                  contentStyle={tooltipStyle}
                  cursor={{ fill: '#f1f5f1' }}
                />
                <Bar
                  dataKey="income"
                  name="Sales collected"
                  fill="#367763"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={25}
                  {...anim}
                />
                <Bar
                  dataKey="expenses"
                  name="Expenses"
                  fill="#d4b88d"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={25}
                  {...anim}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-footnote">
            Amounts in {currency}. A month with no entries does not confirm
            there was no activity.
          </div>
        </section>
        <section
          className="chart-panel category-panel"
          aria-labelledby="category-chart-title"
        >
          <div className="chart-heading">
            <div>
              <p className="eyebrow">WHERE IT GOES</p>
              <h2 id="category-chart-title">Expense breakdown</h2>
            </div>
          </div>
          {categories.length ? (
            <>
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart accessibilityLayer>
                    <Pie
                      data={categories}
                      dataKey="amount"
                      nameKey="name"
                      innerRadius="72%"
                      outerRadius="93%"
                      paddingAngle={3}
                      stroke="none"
                      startAngle={90}
                      endAngle={-270}
                      {...anim}
                    >
                      {categories.map((c) => (
                        <Cell key={c.name} fill={c.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={tooltipMoney}
                      contentStyle={tooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <span>Total expenses</span>
                  <strong>{formatMYR(data.expenses)}</strong>
                </div>
              </div>
              <ul className="category-list">
                {categories.map((c) => (
                  <li key={c.name}>
                    <span>
                      <i style={{ background: c.fill }} />
                      {c.name}
                    </span>
                    <strong>
                      {formatMYR(c.amount)}
                      <small>
                        {((c.amount / Number(data.expenses)) * 100).toFixed(1)}%
                      </small>
                    </strong>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="chart-empty">No expense entries in this period.</p>
          )}
        </section>
      </div>
      <section className="finance-operations" aria-label="Your operations">
        <h2>Your operations</h2>
        <div>
          <Users size={19} />
          <strong>{overview.customers}</strong>
          <span>Customers</span>
        </div>
        <div>
          <TrendingUp size={19} />
          <strong>{overview.openLeads}</strong>
          <span>Open leads</span>
        </div>
        <div>
          <Globe size={19} />
          <strong>{overview.liveWebsites}</strong>
          <span>Live websites</span>
        </div>
      </section>
      <details className="finance-more-details">
        <summary>Income trend & purchased assets</summary>
        <div className="finance-secondary-grid">
          <section className="chart-panel" aria-labelledby="profit-chart-title">
            <div className="chart-heading">
              <div>
                <p className="eyebrow">PROGRESS OVER TIME</p>
                <h2 id="profit-chart-title">Income less expenses</h2>
              </div>
              <div
                className="chart-switch"
                aria-label="Income less expenses chart view"
              >
                {(['profit', 'cumulativeProfit'] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    aria-pressed={profitView === view}
                    onClick={() => setProfitView(view)}
                  >
                    {view === 'profit' ? 'Monthly' : 'Cumulative'}
                  </button>
                ))}
              </div>
            </div>
            <p className="chart-subtitle">
              {profitView === 'profit'
                ? 'Income less expenses each month'
                : 'Running income less expenses within the selected period'}
            </p>
            <div className="finance-chart profit-chart">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart
                  data={series}
                  margin={{ top: 18, right: 10, left: -12, bottom: 0 }}
                  accessibilityLayer
                >
                  <defs>
                    <linearGradient
                      id="profit-fill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#367763"
                        stopOpacity={0.21}
                      />
                      <stop
                        offset="100%"
                        stopColor="#367763"
                        stopOpacity={0.01}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 5"
                    stroke="#e9ede9"
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#7b877f', fontSize: 10 }}
                    minTickGap={12}
                    dy={9}
                  />
                  <YAxis
                    tickFormatter={compact}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#8b968e', fontSize: 10 }}
                  />
                  <ReferenceLine y={0} stroke="#a9b7ad" strokeDasharray="4 4" />
                  <Tooltip
                    formatter={tooltipMoney}
                    contentStyle={tooltipStyle}
                  />
                  <Area
                    key={profitView}
                    type="linear"
                    dataKey={profitView}
                    name={
                      profitView === 'profit'
                        ? 'Income less expenses'
                        : 'Cumulative income less expenses'
                    }
                    stroke="#367763"
                    strokeWidth={2.5}
                    fill="url(#profit-fill)"
                    dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                    {...anim}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="asset-panel" aria-labelledby="asset-title">
            <span className="asset-icon">
              <Landmark size={23} />
            </span>
            <p className="eyebrow">PURCHASED INVESTMENTS / ASSETS</p>
            <h2 id="asset-title">Building for the future</h2>
            <strong className="asset-amount">
              {formatMYR(data.purchasedAssets)}
            </strong>
            <p>
              {data.assets.length} purchases recorded in OS. Shown across all
              history, regardless of the selected period.
            </p>
            <div className="asset-rule" />
            <p className="asset-caveat">
              Kept separate from income less expenses. Add purchase dates and
              details in Financial records. Depreciation is not calculated.
            </p>
            <details className="asset-details">
              <summary>View the {data.assets.length} entries</summary>
              <ol>
                {data.assets.map((a, i) => (
                  <li key={a.sourceRow}>
                    <span>
                      {a.description || `Entry ${i + 1}`}{' '}
                      <small>
                        ·{' '}
                        {a.purchaseDate
                          ? date(a.purchaseDate)
                          : 'Date not recorded'}
                      </small>
                    </span>
                    <strong>{formatMYR(a.amount)}</strong>
                  </li>
                ))}
              </ol>
            </details>
          </section>
        </div>
      </details>
      <details className="monthly-details">
        <summary>View monthly figures as a table</summary>
        <div className="finance-table-scroll">
          <table>
            <caption className="sr-only">
              Monthly collected sales, expenses and income less expenses in{' '}
              {currency}
            </caption>
            <thead>
              <tr>
                <th>Month</th>
                <th>Sales collected</th>
                <th>Expenses</th>
                <th>Income less expenses</th>
                <th>Cumulative income less expenses</th>
                <th>Entries</th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((m) => (
                <tr key={m.month}>
                  <td>{month(m.month)}</td>
                  <td>{formatMYR(m.income)}</td>
                  <td>{formatMYR(m.expenses)}</td>
                  <td>{formatMYR(m.profit)}</td>
                  <td>{formatMYR(m.cumulativeProfit)}</td>
                  <td>{m.transactionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <Transactions
        key={`${overview.from}-${overview.to}-${currency}`}
        from={overview.from}
        to={overview.to}
        currency={currency}
      />
      <div className="finance-provenance">
        <FileSpreadsheet size={16} />
        <p>
          <strong>{data.source?.name ?? 'Saved business records'}</strong>
          <span>
            Transaction Log · {data.source?.transactionCount ?? 0} saved
            transactions · latest entry{' '}
            {data.source?.lastDate ? date(data.source.lastDate) : 'none yet'}
          </span>
          <span>
            Each receipt contributes once to collected sales. Period totals are
            part of the all-time totals. Currencies are shown separately without
            conversion. Purchased assets are excluded from income less expenses.
          </span>
        </p>
      </div>
    </>
  );
}

function Transactions({
  from,
  to,
  currency,
}: {
  from: string | null;
  to: string | null;
  currency: string;
}) {
  const formatMYR = (value: string | number) =>
    new Intl.NumberFormat('en-MY', { style: 'currency', currency }).format(
      Number(value),
    );
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [type, setType] = useState('');
  const [sort, setSort] = useState('date,desc');
  const [page, setPage] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const params = new URLSearchParams({
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    page: String(page),
    size: '10',
    currency,
    q: debounced,
    type,
    sort,
  });
  const query = useQuery({
    queryKey: ['tracker-transactions', params.toString()],
    refetchInterval: 15000,
    queryFn: () => api.trackerTransactions(params),
  });
  return (
    <section
      className="finance-transactions"
      aria-labelledby="transaction-title"
    >
      <div className="chart-heading">
        <div>
          <p className="eyebrow">EVERY ENTRY, IN ONE PLACE</p>
          <h2 id="transaction-title">Transaction history</h2>
        </div>
        <span className="transaction-count">
          {query.data ? `${query.data.totalElements} entries` : 'Loading…'}
        </span>
      </div>
      <div className="finance-table-tools">
        <label className="finance-search">
          <Search size={16} />
          <input
            aria-label="Search transactions"
            maxLength={200}
            placeholder="Search description, category or reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div>
          <select
            aria-label="Transaction type"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All transactions</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expenses</option>
          </select>
          <select
            aria-label="Sort transactions"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(0);
            }}
          >
            <option value="date,desc">Newest first</option>
            <option value="date,asc">Oldest first</option>
            <option value="amount,desc">Largest amount</option>
            <option value="amount,asc">Smallest amount</option>
          </select>
        </div>
      </div>
      {query.isError ? (
        <div role="alert" className="finance-state">
          <p>{query.error.message}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : query.isPending ? (
        <p className="table-loading" role="status">
          Loading transactions…
        </p>
      ) : (
        <>
          <div className="finance-table-scroll">
            <table>
              <caption className="sr-only">
                Live financial transactions in {currency}
              </caption>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Payment / reference</th>
                  <th className="amount-column">Amount</th>
                </tr>
              </thead>
              <tbody>
                {query.data.content.map((t) => (
                  <tr key={t.id ?? t.sourceRow}>
                    <td className="transaction-date">
                      {date(t.date)}
                      <small>
                        {t.source === 'PAYMENT'
                          ? 'Invoice payment'
                          : t.source === 'OS'
                            ? 'Expense record'
                            : `Row ${t.sourceRow}`}
                      </small>
                    </td>
                    <td className="transaction-description">
                      <span>{t.description}</span>
                      {t.notes && <small>{t.notes}</small>}
                    </td>
                    <td>
                      <span
                        className={`transaction-type ${t.type.toLowerCase()}`}
                      >
                        {t.type === 'INCOME' ? 'Income' : 'Expense'}
                      </span>
                      <small>{t.category}</small>
                    </td>
                    <td>
                      {t.paymentMethod || '—'}
                      <small>{t.reference || 'No reference'}</small>
                    </td>
                    <td
                      className={`amount-column amount-${t.type.toLowerCase()}`}
                    >
                      {t.type === 'INCOME' ? '+' : '−'}
                      {formatMYR(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {query.data.content.length === 0 && (
              <p className="chart-empty">
                No transactions match these filters.
              </p>
            )}
          </div>
          <div className="finance-pagination">
            <span>
              {query.data.totalElements
                ? `${page * 10 + 1}–${Math.min((page + 1) * 10, query.data.totalElements)} of ${query.data.totalElements} transactions`
                : '0 transactions'}
              <small>Table filters do not change the charts above.</small>
            </span>
            <div>
              <Button
                size="sm"
                variant="outline"
                aria-label="Previous transactions page"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={16} />
              </Button>
              <span>
                {query.data.totalPages ? page + 1 : 0} / {query.data.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                aria-label="Next transactions page"
                disabled={page + 1 >= query.data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
