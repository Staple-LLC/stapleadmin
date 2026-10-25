import { BillingCustomerSelect } from './components/billing-common';
import { useDebouncedValue } from './lib/use-debounced-value';
import { Select, SelectItem } from './components/ui/select';
import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Globe,
  Receipt,
  Wallet,
  Plus,
  Search,
  ArrowUpRight,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Layers3,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import { api, ApiError } from './lib/api';
import { authClient } from './lib/supabase';
import { useAuth } from './lib/use-auth';
import { CustomerPortal } from './components/customer-portal';
import { DocumentsPage, DocumentFiles } from './components/documents';
import { InvoiceReconciliationPanel } from './components/invoice-reconciliation';
import type {
  Session,
  Role,
  Customer,
  Lead,
  Website,
  Expense,
  Invoice,
  CustomerInput,
  LeadInput,
  WebsiteInput,
  ExpenseInput,
  InvoiceInput,
  Page,
} from './lib/api';
import { Button } from './components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './components/ui/dialog';
const routeModules = {
  'financial-records': () => import('./components/financial-workbook'),
  dashboard: () => import('./components/financial-dashboard'),
  billing: () => import('./components/billing'),
  domains: () => import('./components/billing-domains'),
};
const FinancialWorkbookPage = lazy(routeModules['financial-records']);
const FinancialDashboard = lazy(routeModules.dashboard);
const BillingPage = lazy(routeModules.billing);
const BillingReturn = lazy(() =>
  routeModules.billing().then((module) => ({ default: module.BillingReturn })),
);
const BillingDomains = lazy(() =>
  routeModules.domains().then((module) => ({ default: module.BillingDomains })),
);
function preloadRoute(id: string) {
  const load = routeModules[id as keyof typeof routeModules];
  if (load)
    void load().catch(() => {
      /* Navigation can retry after a transient download failure. */
    });
}

type Section = 'customers' | 'leads' | 'websites' | 'invoices' | 'expenses';
const access: Record<string, Role[]> = {
  dashboard: ['OWNER', 'FINANCE'],
  documents: ['OWNER', 'FINANCE'],
  'financial-records': ['OWNER', 'FINANCE'],
  customers: ['OWNER', 'FINANCE', 'SALES', 'DEVELOPER'],
  leads: ['OWNER', 'SALES'],
  websites: ['OWNER', 'DEVELOPER'],
  invoices: ['OWNER', 'FINANCE'],
  billing: ['OWNER', 'FINANCE'],
  expenses: ['OWNER', 'FINANCE'],
};
const Auth = createContext<{ session: Session; logout: () => void }>(null!);
const labels: Record<Section, string> = {
  customers: 'Customers',
  leads: 'Leads',
  websites: 'Websites',
  invoices: 'Invoices',
  expenses: 'Expenses',
};
const singular: Record<Section, string> = {
  customers: 'customer',
  leads: 'lead',
  websites: 'website',
  invoices: 'invoice',
  expenses: 'expense',
};
const stages: Record<Section, string[]> = {
  customers: ['ACTIVE', 'INACTIVE', 'PROSPECT'],
  leads: [
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'QUOTATION_SENT',
    'NEGOTIATION',
    'WON',
    'LOST',
  ],
  websites: [
    'PENDING',
    'IN_DEVELOPMENT',
    'REVIEW',
    'LIVE',
    'SUSPENDED',
    'ARCHIVED',
  ],
  invoices: ['ISSUED', 'OVERDUE', 'PAID'],
  expenses: [],
};
const pretty = (s: string) =>
  s
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
const money = (value: string | number, currency = 'MYR') =>
  new Intl.NumberFormat('en-MY', { style: 'currency', currency }).format(
    Number(value),
  );
function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <div role="alert" className="error">
      {error instanceof Error ? error.message : 'Something went wrong.'}
      {error instanceof ApiError && Object.keys(error.fields).length > 0 && (
        <ul>
          {Object.entries(error.fields).map(([field, message]) => (
            <li key={field}>
              {pretty(field)}: {message}
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : null;
}
export default function App() {
  const location = useLocation();
  return location.pathname === '/billing-return' ? (
    <Suspense fallback={<p role="status">Loading checkout status…</p>}>
      <BillingReturn />
    </Suspense>
  ) : (
    <AuthenticatedApp />
  );
}
function AuthenticatedApp() {
  const auth = useAuth();
  if (auth.loading)
    return (
      <main className="page" role="status">
        Loading your workspace…
      </main>
    );
  if (auth.recovering)
    return <PasswordReset onComplete={auth.finishRecovery} />;
  if (!auth.session) {
    if (auth.hasProviderSession)
      return (
        <main className="login">
          <div className="login-form">
            <div>
              <h2>Unable to load your account</h2>
              <ErrorMessage error={auth.error} />
              <Button onClick={auth.retry}>Try again</Button>{' '}
              <Button variant="outline" onClick={() => void auth.logout()}>
                Sign out
              </Button>
            </div>
          </div>
        </main>
      );
    return <Login initialError={auth.error} />;
  }
  if (!auth.session.user.role)
    return <CustomerPortal profile={auth.session.user} logout={auth.logout} />;
  return (
    <Auth.Provider
      value={{ session: auth.session, logout: () => void auth.logout() }}
    >
      <Shell />
    </Auth.Provider>
  );
}
function PasswordReset({ onComplete }: { onComplete: () => void }) {
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get('password') !== data.get('confirm')) {
      setError(new Error('Passwords must match.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: cause } = await authClient().auth.updateUser({
        password: String(data.get('password')),
      });
      if (cause) throw cause;
      onComplete();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <div className="login-form">
        <form onSubmit={submit}>
          <h2>Set your password</h2>
          <p className="muted">
            This updates your shared Staple account for OS and CMS.
          </p>
          <label>
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </label>
          <label>
            Confirm password
            <input
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </label>
          <ErrorMessage error={error} />
          <Button disabled={busy}>
            {busy ? 'Updating…' : 'Update password'}
          </Button>
          <Button type="button" variant="ghost" onClick={onComplete}>
            Back to workspace
          </Button>
        </form>
      </div>
    </main>
  );
}
function Login({ initialError }: { initialError: unknown }) {
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const client = authClient();
      const email = String(form.get('email')).trim();
      if (reset) {
        const { error: cause } = await client.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: `${window.location.origin}/auth/reset`,
          },
        );
        if (cause) throw cause;
        setSent(true);
      } else {
        const { error: cause } = await client.auth.signInWithPassword({
          email,
          password: String(form.get('password')),
        });
        if (cause) throw cause;
      }
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <div className="login-story">
        <div className="brand">
          <Layers3 /> staple<span>OS</span>
        </div>
        <div>
          <p className="eyebrow">YOUR BUSINESS, CONNECTED</p>
          <h1>
            A clearer view.
            <br />A better workday.
          </h1>
          <p>
            Customers, services and finances.
            <br />
            One place to keep things moving.
          </p>
        </div>
        <small>Staple Software Solutions</small>
      </div>
      <div className="login-form">
        <form onSubmit={submit}>
          <div className="brand mobile-brand">
            <Layers3 /> staple OS
          </div>
          <p className="eyebrow">YOUR STAPLE ACCOUNT</p>
          <h2>{reset ? 'Reset your password' : 'Welcome back'}</h2>
          <p className="muted">
            {reset
              ? 'We’ll email you a link to choose a new password.'
              : 'Sign in with the same account you use for Staple CMS.'}
          </p>
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              placeholder="you@company.com"
            />
          </label>
          {!reset && (
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
          )}
          {sent && (
            <p role="status" className="notice">
              If this account is eligible, a reset link will arrive by email.
            </p>
          )}
          <ErrorMessage error={error ?? initialError} />
          <Button className="w-full mt-2" disabled={busy}>
            {busy ? 'Please wait…' : reset ? 'Send reset link' : 'Sign in'}
            <ArrowUpRight size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full mt-2"
            onClick={() => {
              setReset(!reset);
              setError(null);
              setSent(false);
            }}
          >
            {reset ? 'Back to sign in' : 'Forgot password?'}
          </Button>
          <p className="text-xs muted mt-6">
            Your account’s permissions determine which workspace you can access.
          </p>
        </form>
      </div>
    </main>
  );
}
function Shell() {
  const { session, logout } = useContext(Auth);
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 800px)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(max-width: 800px)');
    const changed = () => setMobile(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const links = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    {
      id: 'financial-records',
      label: 'Financial records',
      icon: FileSpreadsheet,
    },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'leads', label: 'Leads', icon: TrendingUp },
    { id: 'websites', label: 'Websites', icon: Globe },
    { id: 'billing', label: 'Billing', icon: Receipt },
    { id: 'expenses', label: 'Expenses', icon: Wallet },
    { id: 'documents', label: 'Documents', icon: FileText },
  ];
  const home = access.dashboard.includes(session.user.role!)
    ? '/dashboard'
    : session.user.role === 'SALES'
      ? '/leads'
      : '/websites';
  return (
    <div className="app">
      <aside
        inert={mobile && !open}
        className={open ? 'sidebar is-open' : 'sidebar'}
      >
        <div className="brand">
          <Layers3 size={25} /> staple<span>OS</span>
        </div>
        <div className="workspace">
          <span className="workspace-icon">S</span>
          <div>
            Staple Software<small>Business workspace</small>
          </div>
          <span className="workspace-dot" />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {links
            .filter((l) => access[l.id].includes(session.user.role!))
            .map(({ id, label, icon: Icon }) => (
              <NavLink
                key={id}
                to={`/${id}`}
                onMouseEnter={() => preloadRoute(id)}
                onFocus={() => preloadRoute(id)}
                onClick={() => setOpen(false)}
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="avatar">
            {session.user.email.slice(0, 1).toUpperCase()}
          </div>
          <div className="user-info">
            <strong>{session.user.email}</strong>
            <small>{pretty(session.user.role!)}</small>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </Button>
        </div>
      </aside>
      {open && (
        <button
          aria-label="Close menu"
          className="mobile-overlay"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="main">
        <header>
          <Button
            size="icon"
            variant="ghost"
            className="mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </Button>
          <span className="muted">
            Workspace <span className="mx-3 text-gray-300">/</span>
            <strong>Staple OS</strong>
          </span>
          <span className="header-tag">Internal workspace</span>
        </header>
        <Routes>
          <Route path="/" element={<Navigate to={home} replace />} />
          <Route
            path="/dashboard"
            element={
              <Guard feature="dashboard">
                <Overview />
              </Guard>
            }
          />
          <Route
            path="/financial-records"
            element={
              <Guard feature="financial-records">
                <Suspense
                  fallback={
                    <p className="page" role="status">
                      Loading financial workbook…
                    </p>
                  }
                >
                  <FinancialWorkbookPage />
                </Suspense>
              </Guard>
            }
          />
          <Route
            path="/documents"
            element={
              <Guard feature="documents">
                <DocumentsPage />
              </Guard>
            }
          />
          <Route
            path="/billing"
            element={
              <Guard feature="billing">
                <Suspense
                  fallback={
                    <p className="page" role="status">
                      Loading billing…
                    </p>
                  }
                >
                  <BillingPage
                    invoices={<Records section="invoices" embedded />}
                  />
                </Suspense>
              </Guard>
            }
          />
          <Route
            path="/invoices"
            element={<Navigate to="/billing?tab=invoices" replace />}
          />
          {(Object.keys(labels) as Section[])
            .filter((section) => section !== 'invoices')
            .map((section) => (
              <Route
                key={section}
                path={`/${section}`}
                element={
                  <Guard feature={section}>
                    <Records key={section} section={section} />
                  </Guard>
                }
              />
            ))}
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
      </div>
    </div>
  );
}
function Guard({
  feature,
  children,
}: {
  feature: string;
  children: ReactNode;
}) {
  const { session } = useContext(Auth);
  return access[feature].includes(session.user.role!) ? (
    children
  ) : (
    <div className="page">
      <h1>Access restricted</h1>
      <p>Your role does not have access to this area.</p>
    </div>
  );
}
function Overview() {
  return (
    <main className="page">
      <Suspense fallback={<p role="status">Loading dashboard…</p>}>
        <FinancialDashboard />
      </Suspense>
    </main>
  );
}
function useRole() {
  return useContext(Auth).session.user.role;
}
type Row = Customer | Lead | Website | Expense | Invoice;
function Records({
  section,
  embedded = false,
}: {
  section: Section;
  embedded?: boolean;
}) {
  const [urlParams] = useSearchParams();
  const customerId =
    section === 'invoices' ? urlParams.get('customerId') : null;
  const Container = embedded ? 'div' : 'main';
  const role = useRole();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('createdAt,desc');
  const [editing, setEditing] = useState<Row | null | undefined>();
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [deleteError, setDeleteError] = useState<unknown>();
  const [deletingBusy, setDeletingBusy] = useState(false);
  const cache = useQueryClient();
  const writable =
    section !== 'customers' || role === 'OWNER' || role === 'SALES';
  const mutable = writable && section !== 'invoices' && section !== 'expenses';
  const params = new URLSearchParams({
    page: String(page),
    size: '20',
    sort:
      section === 'expenses'
        ? sort.replace('createdAt', 'transactionDate')
        : sort,
    q: debouncedSearch,
    ...(customerId ? { customerId } : {}),
    ...(status
      ? { [section === 'expenses' ? 'source' : 'status']: status }
      : {}),
  });
  const query = useQuery<Page<Row>>({
    queryKey: [section, customerId, page, debouncedSearch, status, sort],
    queryFn: () => api[section].list(params),
  });
  async function remove() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await api[section].remove(deleting.id);
      setDeleting(null);
      await cache.invalidateQueries({ queryKey: [section] });
      await cache.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e) {
      setDeleteError(e);
    } finally {
      setDeletingBusy(false);
    }
  }
  return (
    <Container
      className={`${embedded ? 'billing-invoices' : 'page'} ${section === 'expenses' ? 'expenses-page' : ''}`}
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {section === 'customers' || section === 'leads'
              ? 'RELATIONSHIPS'
              : section === 'websites'
                ? 'SERVICES'
                : 'FINANCE'}
          </p>
          <h1>{labels[section]}</h1>
          <p className="muted">
            {
              {
                customers: 'Good relationships start with the details.',
                leads: 'Keep your next opportunity moving.',
                websites: 'Every website, one clear view.',
                invoices: 'A reliable record of what you have billed.',
                expenses:
                  'Workbook expenses and costs recorded in OS, together.',
              }[section]
            }
          </p>
        </div>
        {writable && (
          <Button onClick={() => setEditing(null)}>
            <Plus size={17} />
            {section === 'expenses'
              ? 'Record expense'
              : `New ${singular[section]}`}
          </Button>
        )}
      </div>
      {section === 'invoices' && (
        <p className="text-xs muted mb-5">
          Have an existing invoice PDF?{' '}
          <NavLink className="text-primary underline" to="/documents">
            Upload it in Documents
          </NavLink>{' '}
          or attach it to an invoice’s details.
        </p>
      )}
      <section className="records">
        <div className="table-toolbar">
          <div className="search">
            <Search size={17} />
            <input
              aria-label={`Search ${labels[section]}`}
              placeholder={`Search ${labels[section].toLowerCase()}…`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <div className="filters">
            {section === 'expenses' && (
              <Select
                aria-label="Expense source"
                value={status}
                onValueChange={(nextValue) => {
                  setStatus(nextValue);
                  setPage(0);
                }}
              >
                <SelectItem value="">All sources</SelectItem>
                <SelectItem value="WORKBOOK">Imported workbook</SelectItem>
                <SelectItem value="OS">Recorded in OS</SelectItem>
              </Select>
            )}
            {stages[section].length > 0 && (
              <Select
                aria-label="Filter by status"
                value={status}
                onValueChange={(nextValue) => {
                  setStatus(nextValue);
                  setPage(0);
                }}
              >
                <SelectItem value="">All statuses</SelectItem>
                {stages[section].map((s) => (
                  <SelectItem key={s}>{s}</SelectItem>
                ))}
              </Select>
            )}
            <Select
              aria-label="Sort records"
              value={sort}
              onValueChange={(nextValue) => {
                setSort(nextValue);
                setPage(0);
              }}
            >
              <SelectItem value="createdAt,desc">Newest first</SelectItem>
              <SelectItem value="createdAt,asc">Oldest first</SelectItem>
              {section === 'expenses' && (
                <>
                  <SelectItem value="amount,desc">Largest amount</SelectItem>
                  <SelectItem value="amount,asc">Smallest amount</SelectItem>
                </>
              )}
            </Select>
          </div>
        </div>
        <ErrorMessage error={query.error} />
        {query.isPending ? (
          <div className="empty" role="status">
            Loading records…
          </div>
        ) : (
          query.data && (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {columns(section).map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.content.map((row) => (
                      <tr key={row.id}>
                        {cells(section, row).map((cell, i) => (
                          <td key={i}>{cell}</td>
                        ))}
                        <td className="actions">
                          {section === 'customers' &&
                            (role === 'OWNER' || role === 'FINANCE') && (
                              <Button asChild variant="ghost" size="sm">
                                <NavLink to={`/billing?customerId=${row.id}`}>
                                  Services & billing
                                </NavLink>
                              </Button>
                            )}
                          {section === 'invoices' || section === 'expenses' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditing(row)}
                            >
                              View / PDFs
                            </Button>
                          ) : (
                            mutable && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Edit record"
                                  onClick={() => setEditing(row)}
                                >
                                  <Pencil size={15} />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Delete record"
                                  onClick={() => {
                                    setDeleteError(null);
                                    setDeleting(row);
                                  }}
                                >
                                  <Trash2 size={15} />
                                </Button>
                              </>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {query.data.content.length === 0 && (
                <div className="empty">
                  <div className="empty-icon">
                    <Layers3 size={27} />
                  </div>
                  <h3>
                    {search || status
                      ? 'No matching records'
                      : `Your ${labels[section].toLowerCase()} start here`}
                  </h3>
                  <p>
                    {search || status
                      ? 'Try changing your search or filters.'
                      : `Add your first ${singular[section]} to keep your workspace up to date.`}
                  </p>
                  {writable && !search && !status && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setEditing(null)}
                    >
                      <Plus size={16} />
                      Add {singular[section]}
                    </Button>
                  )}
                </div>
              )}
              <div className="pagination">
                <span>{query.data.totalElements} records</span>
                <div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Previous page"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft size={17} />
                  </Button>
                  <span>
                    Page {page + 1} of {Math.max(1, query.data.totalPages)}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Next page"
                    disabled={page + 1 >= query.data.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight size={17} />
                  </Button>
                </div>
              </div>
            </>
          )
        )}
      </section>
      {section === 'websites' && role === 'OWNER' && (
        <Suspense fallback={<p role="status">Loading managed domains…</p>}>
          <BillingDomains />
        </Suspense>
      )}
      {(section === 'expenses' || section === 'invoices') && (
        <p className="text-xs muted mt-4">
          {section === 'invoices'
            ? 'Open an invoice to link income already recorded. Linking updates its balance without adding sales again. Issued invoice details remain fixed.'
            : 'These expenses share the live Financial records and dashboard totals. Use Financial records to make corrections.'}
        </p>
      )}
      <Dialog
        open={editing !== undefined}
        onOpenChange={(o) => {
          if (!o) setEditing(undefined);
        }}
      >
        {editing !== undefined && (
          <DialogContent>
            <DialogTitle className="text-xl font-semibold mb-1">
              {(section === 'invoices' || section === 'expenses') && editing
                ? section === 'invoices'
                  ? 'Invoice details'
                  : 'Expense details'
                : `${editing ? 'Edit' : section === 'expenses' ? 'Record' : 'New'} ${singular[section]}`}
            </DialogTitle>
            <DialogDescription className="muted text-sm mb-6">
              {section === 'invoices'
                ? 'Review amounts and currency carefully before issuing.'
                : 'Keep your workspace records accurate and up to date.'}
            </DialogDescription>
            {section === 'invoices' && editing ? (
              <InvoiceDetails invoice={editing as Invoice} />
            ) : section === 'expenses' && editing ? (
              <ExpenseDetails expense={editing as Expense} />
            ) : (
              <RecordForm
                section={section}
                row={editing}
                onDone={() => {
                  setEditing(undefined);
                  void cache.invalidateQueries({ queryKey: [section] });
                  void cache.invalidateQueries({ queryKey: ['dashboard'] });
                  void cache.invalidateQueries({ queryKey: ['tracker'] });
                  void cache.invalidateQueries({
                    queryKey: ['tracker-transactions'],
                  });
                  void cache.invalidateQueries({
                    queryKey: ['financial-workbook'],
                  });
                }}
              />
            )}
          </DialogContent>
        )}
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o && !deletingBusy) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="text-xl font-semibold">
            Delete {singular[section]}?
          </DialogTitle>
          <DialogDescription className="muted my-4">
            This permanently removes this record. Records referenced by other
            business data cannot be deleted.
          </DialogDescription>
          <ErrorMessage error={deleteError} />
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              disabled={deletingBusy}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deletingBusy}
              onClick={() => void remove()}
            >
              {deletingBusy ? 'Deleting…' : 'Delete record'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
function columns(s: Section) {
  return {
    customers: ['Business', 'Contact', 'Email', 'Status'],
    leads: ['Opportunity', 'Business', 'Est. value', 'Stage'],
    websites: ['Website', 'Domain', 'Type', 'Status'],
    invoices: ['Invoice', 'Customer', 'Due date', 'Total', 'Status'],
    expenses: ['Expense', 'Category', 'Date', 'Amount', 'Payment', 'Source'],
  }[s];
}
function Badge({ value }: { value: string }) {
  return (
    <span
      className={`badge ${['ACTIVE', 'LIVE', 'WON', 'PAID'].includes(value) ? 'positive' : value === 'OVERDUE' || value === 'LOST' ? 'negative' : ''}`}
    >
      {pretty(value)}
    </span>
  );
}
function cells(s: Section, r: Row): ReactNode[] {
  if (s === 'customers') {
    const v = r as Customer;
    return [
      <strong>{v.businessName}</strong>,
      v.contactPerson || '—',
      v.email,
      <Badge value={v.status} />,
    ];
  }
  if (s === 'leads') {
    const v = r as Lead;
    return [
      <strong>{v.name}</strong>,
      v.business || '—',
      money(v.estimatedValue, v.currency),
      <Badge value={v.status} />,
    ];
  }
  if (s === 'websites') {
    const v = r as Website;
    return [
      <strong>{v.name}</strong>,
      v.domainName || '—',
      pretty(v.websiteType),
      <Badge value={v.status} />,
    ];
  }
  if (s === 'invoices') {
    const v = r as Invoice;
    return [
      <strong className="invoice-number" title={v.number}>
        {v.number}
        {v.billingTest && <small className="billing-test">Test</small>}
      </strong>,
      v.billingName,
      v.dueDate,
      money(v.total, v.currency),
      <Badge value={v.status} />,
    ];
  }
  const v = r as Expense;
  return [
    <div className="expense-description">
      <strong>{v.description}</strong>
      <small>{v.vendor || 'Vendor not recorded'}</small>
      {v.notes && <small>{v.notes}</small>}
    </div>,
    v.category,
    v.transactionDate,
    money(v.amount, v.currency),
    <div>
      {v.paymentMethod || '—'}
      {v.reference && (
        <small className="block text-xs muted mt-1">{v.reference}</small>
      )}
    </div>,
    <div title={v.sourceName || undefined}>
      <span className="badge">
        {v.source === 'WORKBOOK' ? 'Imported workbook' : 'Recorded in OS'}
      </span>
      {v.sourceRow != null && (
        <small className="block text-xs muted mt-1">
          Transaction Log · Row {v.sourceRow}
        </small>
      )}
    </div>,
  ];
}
function InvoiceDetails({ invoice }: { invoice: Invoice }) {
  const query = useQuery({
    queryKey: ['invoices', 'detail', invoice.id],
    queryFn: () => api.invoices.get(invoice.id),
  });
  const i = query.data ?? invoice;
  return (
    <div className="invoice-detail">
      <p className="font-semibold break-all">{i.number}</p>
      <p>{i.billingName}</p>
      <p className="muted whitespace-pre-line">{i.billingAddress}</p>
      <p className="my-4">
        Issued {i.issueDate} · Due {i.dueDate} · <Badge value={i.status} />
      </p>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit price</th>
          </tr>
        </thead>
        <tbody>
          {i.lines.map((l, n) => (
            <tr key={n}>
              <td>{l.description}</td>
              <td>{l.quantity}</td>
              <td>{money(l.unitPrice, i.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-right font-semibold mt-4">
        Total {money(i.total, i.currency)}
      </p>
      <p className="text-xs muted mt-4">
        No tax applied. This is an operational invoice record, not a validated
        e-Invoice.
      </p>
      {i.billingTest && (
        <p className="billing-notice">
          Stripe test invoice — excluded from your financial overview.
        </p>
      )}
      {i.provider === 'STRIPE' ? (
        <p className="muted text-sm">
          Payment status is updated by Stripe. View payment history in Billing.
        </p>
      ) : (
        !i.billingTest && <InvoiceReconciliationPanel invoiceId={i.id} />
      )}
      <DocumentFiles
        target={{ type: 'invoices', id: i.id }}
        defaultKind="INVOICE"
      />
    </div>
  );
}
function ExpenseDetails({ expense: e }: { expense: Expense }) {
  return (
    <div className="expense-details">
      <h2>{e.description}</h2>
      <dl className="expense-detail-grid">
        <div>
          <dt>Amount</dt>
          <dd>{money(e.amount, e.currency)}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{e.transactionDate}</dd>
        </div>
        <div>
          <dt>Vendor</dt>
          <dd>{e.vendor || 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{e.category}</dd>
        </div>
        <div>
          <dt>Payment method</dt>
          <dd>{e.paymentMethod || 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd>{e.reference || 'Not recorded'}</dd>
        </div>
        {e.notes && (
          <div>
            <dt>Notes</dt>
            <dd>{e.notes}</dd>
          </div>
        )}
      </dl>
      <DocumentFiles
        target={{ type: 'expenses', id: e.id }}
        defaultKind="RECEIPT"
      />
    </div>
  );
}
type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
};
const fields: Record<Section, Field[]> = {
  customers: [
    { name: 'businessName', label: 'Business name', required: true },
    { name: 'contactPerson', label: 'Contact person' },
    { name: 'email', label: 'Email (optional)', type: 'email' },
    { name: 'phone', label: 'Phone (optional)' },
    { name: 'billingAddress', label: 'Billing address', type: 'textarea' },
    { name: 'source', label: 'Acquisition source' },
  ],
  leads: [
    { name: 'name', label: 'Lead name', required: true },
    { name: 'business', label: 'Business' },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'phone', label: 'Phone' },
    { name: 'source', label: 'Acquisition source' },
    { name: 'interestedService', label: 'Interested service' },
    {
      name: 'estimatedValue',
      label: 'Estimated value',
      type: 'number',
      required: true,
    },
    { name: 'followUpDate', label: 'Next follow-up', type: 'date' },
  ],
  websites: [
    { name: 'name', label: 'Website name', required: true },
    { name: 'domainName', label: 'Domain' },
    { name: 'liveUrl', label: 'Live URL', type: 'url' },
    {
      name: 'websiteType',
      label: 'Website type',
      options: ['ONE_TIME', 'SUBSCRIPTION', 'CUSTOM_WEBSITE', 'CUSTOM_APP'],
    },
    { name: 'framework', label: 'Framework' },
    { name: 'hostingProvider', label: 'Hosting provider' },
  ],
  invoices: [
    { name: 'issueDate', label: 'Issue date', type: 'date', required: true },
    { name: 'dueDate', label: 'Due date', type: 'date', required: true },
  ],
  expenses: [
    { name: 'vendor', label: 'Vendor', required: true },
    { name: 'description', label: 'Description', required: true },
    { name: 'amount', label: 'Amount', type: 'number', required: true },
    {
      name: 'transactionDate',
      label: 'Transaction date',
      type: 'date',
      required: true,
    },
    {
      name: 'category',
      label: 'Category',
      required: true,
      options: [
        'Advertising',
        'Domain registration',
        'Domain renewals',
        'Hosting',
        'Cloud infrastructure',
        'AI subscriptions',
        'Software subscriptions',
        'Office supplies',
        'Contractors',
        'Professional services',
        'Travel',
        'Banking and processing fees',
        'Other',
      ],
    },
    { name: 'paymentMethod', label: 'Payment method' },
  ],
};
function CustomerSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="col-span-full">
      <BillingCustomerSelect value={value} onChange={onChange} />
    </div>
  );
}

function RecordForm({
  section,
  row,
  onDone,
}: {
  section: Section;
  row: Row | null;
  onDone: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState<Record<string, string | boolean | null>>(
    () =>
      ({
        ...Object.fromEntries(
          fields[section].map((f) => [
            f.name,
            f.type === 'date'
              ? section === 'leads'
                ? null
                : today
              : (f.options?.[0] ?? ''),
          ]),
        ),
        status: stages[section][0] ?? '',
        notes: '',
        currency: 'MYR',
        estimatedValue: '0.00',
        cmsEnabled: false,
        ...row,
      }) as Record<string, string | boolean | null>,
  );
  const [lines, setLines] = useState([
    { description: '', quantity: '1', unitPrice: '0.00' },
  ]);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const set = (key: string, value: string | boolean | null) =>
    setData((d) => ({ ...d, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const clean = Object.fromEntries(
        [
          ...fields[section].map((f) => f.name),
          'status',
          'notes',
          'currency',
          'customerId',
          'cmsEnabled',
        ]
          .filter((k) => k in data)
          .map((k) => [k, data[k]]),
      );
      if (section === 'customers') {
        const input = clean as unknown as CustomerInput;
        await (row
          ? api.customers.update(row.id, input)
          : api.customers.create(input));
      }
      if (section === 'leads') {
        const input = {
          ...clean,
          followUpDate: data.followUpDate || null,
        } as unknown as LeadInput;
        await (row ? api.leads.update(row.id, input) : api.leads.create(input));
      }
      if (section === 'websites') {
        const input = clean as unknown as WebsiteInput;
        await (row
          ? api.websites.update(row.id, input)
          : api.websites.create(input));
      }
      if (section === 'expenses')
        await api.expenses.create(clean as unknown as ExpenseInput);
      if (section === 'invoices')
        await api.invoices.create({
          ...clean,
          lines,
        } as unknown as InvoiceInput);
      onDone();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        {(section === 'websites' || section === 'invoices') && (
          <CustomerSelect
            value={String(data.customerId ?? '')}
            onChange={(v) => set('customerId', v)}
          />
        )}
        {fields[section].map((f) => (
          <label
            className={f.type === 'textarea' ? 'col-span-full' : ''}
            key={f.name}
          >
            {f.label}
            {f.options ? (
              <Select
                aria-label={f.label}
                required
                value={String(data[f.name] ?? '')}
                onValueChange={(nextValue) => set(f.name, nextValue)}
              >
                {f.options.map((v) => (
                  <SelectItem value={v} key={v}>
                    {pretty(v)}
                  </SelectItem>
                ))}
              </Select>
            ) : f.type === 'textarea' ? (
              <textarea
                rows={3}
                maxLength={2000}
                value={String(data[f.name] ?? '')}
                onChange={(e) => set(f.name, e.target.value)}
              />
            ) : (
              <input
                type={f.type ?? 'text'}
                required={f.required}
                min={f.type === 'number' ? '0' : undefined}
                step={f.type === 'number' ? '0.01' : undefined}
                maxLength={f.type === 'email' ? 254 : 200}
                value={String(data[f.name] ?? '')}
                onChange={(e) =>
                  set(f.name, e.target.value || (f.type === 'date' ? null : ''))
                }
              />
            )}
          </label>
        ))}
        {stages[section].length > 0 && section !== 'invoices' && (
          <label>
            Status
            <Select
              aria-label="Status"
              value={String(data.status)}
              onValueChange={(nextValue) => set('status', nextValue)}
            >
              {stages[section].map((s) => (
                <SelectItem key={s} value={s}>
                  {pretty(s)}
                </SelectItem>
              ))}
            </Select>
          </label>
        )}
        {['leads', 'invoices', 'expenses'].includes(section) && (
          <label>
            Currency
            <Select
              aria-label="Currency"
              value={String(data.currency)}
              onValueChange={(nextValue) => set('currency', nextValue)}
            >
              {['MYR', 'USD', 'SGD', 'EUR', 'GBP', 'AUD'].map((c) => (
                <SelectItem key={c}>{c}</SelectItem>
              ))}
            </Select>
          </label>
        )}
        {section === 'websites' && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={!!data.cmsEnabled}
              onChange={(e) => set('cmsEnabled', e.target.checked)}
            />{' '}
            CMS enabled (registry flag only)
          </label>
        )}
        {section !== 'invoices' && (
          <label className="col-span-full">
            Notes
            <textarea
              maxLength={4000}
              rows={3}
              value={String(data.notes ?? '')}
              onChange={(e) => set('notes', e.target.value)}
            />
          </label>
        )}
      </div>
      {section === 'invoices' && (
        <fieldset className="mt-5">
          <legend className="font-semibold text-sm mb-3">Line items</legend>
          {lines.map((line, index) => (
            <div className="line-item" key={index}>
              <label>
                Description
                <input
                  required
                  maxLength={1000}
                  value={line.description}
                  onChange={(e) =>
                    setLines((a) =>
                      a.map((l, n) =>
                        n === index ? { ...l, description: e.target.value } : l,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Quantity
                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={line.quantity}
                  onChange={(e) =>
                    setLines((a) =>
                      a.map((l, n) =>
                        n === index ? { ...l, quantity: e.target.value } : l,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Unit price
                <input
                  required
                  type="number"
                  step="0.01"
                  value={line.unitPrice}
                  onChange={(e) =>
                    setLines((a) =>
                      a.map((l, n) =>
                        n === index ? { ...l, unitPrice: e.target.value } : l,
                      ),
                    )
                  }
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={lines.length === 1}
                aria-label="Remove line"
                onClick={() => setLines((a) => a.filter((_, n) => n !== index))}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={lines.length >= 100}
            onClick={() =>
              setLines((a) => [
                ...a,
                { description: '', quantity: '1', unitPrice: '0.00' },
              ])
            }
          >
            <Plus size={15} />
            Add line
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-2"
            disabled={lines.length >= 100}
            onClick={() =>
              setLines((a) => [
                ...a,
                { description: 'Discount', quantity: '1', unitPrice: '-0.00' },
              ])
            }
          >
            <Plus size={15} />
            Add discount
          </Button>
          <p className="text-xs muted mt-3">
            For a discount, use quantity 1 and a negative unit price such as
            -89.90. The invoice total must be zero or higher. Totals use
            server-side decimal calculations. No tax is applied. Issued invoices
            cannot be edited.
          </p>
        </fieldset>
      )}
      <ErrorMessage error={error} />
      <div className="form-footer">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onDone}
        >
          Cancel
        </Button>
        <Button disabled={busy}>
          {busy
            ? 'Saving…'
            : section === 'invoices'
              ? 'Issue invoice'
              : `Save ${singular[section]}`}
        </Button>
      </div>
    </form>
  );
}
