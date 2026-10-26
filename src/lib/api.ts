import { authClient } from './supabase';
import type {
  FinancialWorkbook,
  TrackerSummary,
  TrackerTransaction,
  FinancialAsset,
  FinancialAssetInput,
  FinancialTransactionInput,
} from './tracker-types';

export type Role = 'OWNER' | 'FINANCE' | 'SALES' | 'DEVELOPER';
export interface CustomerAccess {
  id: string;
  businessName: string;
}
export interface Profile {
  id: string;
  email: string;
  role: Role | null;
  customers: CustomerAccess[];
}
export interface Session {
  user: Profile;
}
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export interface Base {
  id: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}
export interface CustomerInput {
  businessName: string;
  contactPerson: string;
  email: string;
  phone: string;
  billingAddress: string;
  source: string;
  status: string;
  notes: string;
}
export interface LeadInput {
  name: string;
  business: string;
  email: string;
  phone: string;
  source: string;
  interestedService: string;
  estimatedValue: string;
  currency: string;
  followUpDate: string | null;
  status: string;
  notes: string;
}
export interface WebsiteInput {
  customerId: string;
  name: string;
  domainName: string;
  liveUrl: string;
  websiteType: string;
  framework: string;
  hostingProvider: string;
  cmsEnabled: boolean;
  status: string;
  notes: string;
}
export interface ExpenseInput {
  projectId?: string | null;
  vendor: string;
  description: string;
  amount: string;
  currency: string;
  transactionDate: string;
  category: string;
  paymentMethod: string;
  notes: string;
}
export interface InvoiceInput {
  customerId: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  lines: { description: string; quantity: string; unitPrice: string }[];
}
export type Customer = Base & CustomerInput;
export type Lead = Base & LeadInput;
export type Website = Base & WebsiteInput;
export type Expense = Base &
  ExpenseInput & {
    source: 'OS' | 'WORKBOOK';
    sourceName: string | null;
    sourceRow: number | null;
    reference: string | null;
  };
export interface Invoice extends InvoiceInput {
  id: string;
  createdAt: string;
  number: string;
  billingName: string;
  billingAddress: string;
  status: string;
  total: string;
  billingServiceId?: string | null;
  billingTest?: boolean;
  provider?: string | null;
}
export type BillingInterval = 'ONCE' | 'MONTH' | 'YEAR';
export type BillingKind = 'WEBSITE' | 'DOMAIN' | 'OTHER';
export type BillingCollection = 'AUTO_CARD' | 'ONLINE' | 'MANUAL';
export interface BillingPlanInput {
  code: string;
  name: string;
  description: string | null;
  kind: BillingKind;
  interval: BillingInterval;
  amount: string | null;
  currency: string;
  active: boolean;
  version?: number | null;
}
export interface BillingPlan extends BillingPlanInput {
  id: string;
  version: number;
}
export interface BillingServiceInput {
  customerId: string;
  planId: string;
  name?: string | null;
  amount?: string | null;
  currency?: string | null;
  collectionMode: BillingCollection;
  websiteId?: string | null;
  domainId?: string | null;
  nextBillingDate?: string | null;
}
export interface BillingService {
  id: string;
  customerId: string;
  customerName: string;
  planId: string;
  planName: string;
  name: string;
  kind: BillingKind;
  interval: BillingInterval;
  amount: string;
  currency: string;
  collectionMode: BillingCollection;
  status: 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'COMPLETED';
  nextBillingDate: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  websiteId: string | null;
  domainId: string | null;
  domainName: string | null;
  checkoutUrl: string | null;
  checkoutExpiresAt: string | null;
  stripeSubscriptionId: string | null;
  billingTest: boolean;
  createdAt: string;
  version: number;
}
export interface BillingDomainInput {
  customerId: string;
  websiteId: string | null;
  name: string;
  registrar: string | null;
  expiresOn: string;
  renewalStatus: 'MANUAL' | 'AUTO_RENEW' | 'DO_NOT_RENEW' | 'RENEWAL_REQUIRED';
  notes: string | null;
  version?: number | null;
}
export interface BillingDomain extends BillingDomainInput {
  id: string;
  customerName: string;
  createdAt: string;
  version: number;
}
export interface BillingPayment {
  id: string;
  serviceId: string | null;
  customerId: string;
  customerName: string;
  serviceName: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  amount: string;
  refundedAmount: string;
  currency: string;
  status: string;
  provider: string;
  reference: string | null;
  occurredAt: string;
  failureReason: string | null;
  billingTest: boolean;
}
export interface BillingConfig {
  mode: 'DISABLED' | 'TEST' | 'LIVE';
  checkoutEnabled: boolean;
  webhookConfigured: boolean;
  fpxEnabled: boolean;
  message: string;
}
export interface Money {
  currency: string;
  amount: string;
}
export interface Dashboard {
  customers: number;
  openLeads: number;
  liveWebsites: number;
  periodStart: string;
  periodEndExclusive: string;
  invoiced: Money[];
  collected: Money[];
  expenses: Money[];
  outstanding: Money[];
}
export interface FinancialOverview {
  period: 'month' | 'year' | 'all' | 'custom';
  from: string | null;
  to: string | null;
  asOf: string;
  currency: string;
  summary: TrackerSummary;
  lifetime: { income: string; expenses: string; net: string };
  invoiced: string;
  outstanding: string;
  overdue: string;
  outstandingCount: number;
  overdueCount: number;
  customers: number;
  openLeads: number;
  liveWebsites: number;
}
export interface IncomeCandidate {
  id: string;
  description: string;
  date: string;
  amount: string;
  available: string;
  currency: string;
  reference: string | null;
}
export interface InvoiceReconciliation {
  invoiceId: string;
  currency: string;
  total: string;
  paid: string;
  outstanding: string;
  matches: {
    id: string;
    financialEntryId: string;
    description: string;
    date: string;
    amount: string;
    reference: string | null;
  }[];
  candidates: IncomeCandidate[];
  candidateTotal: number;
  page: number;
  size: number;
}
export interface PdfDocument {
  id: string;
  kind: 'INVOICE' | 'RECEIPT';
  name: string;
  size: number;
  pages: number;
  createdAt: string;
  targetType: 'invoices' | 'expenses' | 'financial-records' | null;
  targetId: string | null;
  targetLabel: string | null;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
async function authorizedResponse(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const { data, error: sessionError } = await authClient().auth.getSession();
  if (sessionError) throw sessionError;
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, 'Sign in to continue.');
  const res = await fetch(
    `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1${path}`,
    {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    },
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    if (res.status === 401) window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(
      res.status,
      error.message ?? 'Request failed',
      error.fields,
    );
  }
  return res;
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await authorizedResponse(path, options);
  return res.status === 204 ? (undefined as T) : res.json();
}
function resource<T, I>(name: string) {
  return {
    get: (id: string) => request<T>(`/${name}/${id}`),
    list: (params: URLSearchParams) => request<Page<T>>(`/${name}?${params}`),
    create: (data: I) =>
      request<T>(`/${name}`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: I) =>
      request<T>(`/${name}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      request<void>(`/${name}/${id}`, { method: 'DELETE' }),
  };
}
export interface ProjectInput {
  customerId: string;
  name: string;
  currency: string;
  agreedValue: string;
  costBudget: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  notes: string;
  version: number;
}
export interface Project extends ProjectInput {
  id: string;
  customerName: string;
  directCosts: string;
  margin: string;
  budgetRemaining: string | null;
  costCount: number;
  createdAt: string;
}
export interface ProjectCost {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: string;
  currency: string;
  projectId: string | null;
  projectName: string | null;
}
export interface ProjectSummary {
  currency: string;
  agreedValue: string;
  directCosts: string;
  margin: string;
  sharedExpenses: string;
  unassignedExpenses: string;
}
export const api = {
  projects: {
    ...resource<Project, ProjectInput>('projects'),
    summary: (currency: string) =>
      request<ProjectSummary>(
        `/projects/summary?${new URLSearchParams({ currency })}`,
      ),
    costs: (id: string, params: URLSearchParams) =>
      request<Page<ProjectCost>>(`/projects/${id}/costs?${params}`),
    assign: (id: string, expenseId: string) =>
      request<void>(`/projects/${id}/costs/${expenseId}`, { method: 'PUT' }),
    unassign: (id: string, expenseId: string) =>
      request<void>(`/projects/${id}/costs/${expenseId}`, { method: 'DELETE' }),
  },
  billing: {
    paymentLink: async (
      token: string,
    ): Promise<{
      status: 'READY' | 'COMPLETED' | 'EXPIRED' | 'UNAVAILABLE';
      url: string | null;
    }> => {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1/billing/pay/${encodeURIComponent(token)}`,
        {
          cache: 'no-store',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        },
      );
      if (!response.ok) throw new Error('Payment link unavailable');
      return response.json();
    },
    receipt: async (
      sessionId: string,
    ): Promise<{
      status: 'READY' | 'PENDING' | 'NO_PAYMENT' | 'NO_CHARGE';
      url: string | null;
    }> => {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1/billing/checkout/receipt?${new URLSearchParams({ sessionId })}`,
        {
          cache: 'no-store',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        },
      );
      if (!response.ok)
        throw new Error(
          'The receipt could not be loaded. Please retry or contact your service provider.',
        );
      return response.json();
    },
    config: () => request<BillingConfig>('/billing/config'),
    plans: resource<BillingPlan, BillingPlanInput>('billing/plans'),
    services: resource<BillingService, BillingServiceInput>('billing/services'),
    domains: resource<BillingDomain, BillingDomainInput>('billing/domains'),
    payments: {
      list: (params: URLSearchParams) =>
        request<Page<BillingPayment>>(`/billing/payments?${params}`),
    },
    checkout: (id: string) =>
      request<{ url: string; expiresAt: string; billingTest: boolean }>(
        `/billing/services/${id}/checkout`,
        { method: 'POST' },
      ),
    cancel: (id: string) =>
      request<BillingService>(`/billing/services/${id}/cancel`, {
        method: 'POST',
      }),
    portal: (id: string) =>
      request<{ url: string }>(`/billing/services/${id}/portal`, {
        method: 'POST',
      }),
    issueInvoice: (id: string, data: { issueDate: string; dueDate: string }) =>
      request<Invoice>(`/billing/services/${id}/invoices`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  documents: {
    remove: (id: string) =>
      request<void>(`/documents/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    list: (params: URLSearchParams) =>
      request<Page<PdfDocument>>(`/documents?${params}`),
    upload: (
      file: File,
      kind: 'INVOICE' | 'RECEIPT',
      target?: {
        type: 'invoices' | 'expenses' | 'financial-records';
        id: string;
      },
    ) => {
      const body = new FormData();
      body.set('file', file);
      body.set('kind', kind);
      if (target) {
        body.set('targetType', target.type);
        body.set('targetId', target.id);
      }
      return request<PdfDocument>('/documents', { method: 'POST', body });
    },
    download: async (id: string) =>
      (
        await authorizedResponse(`/documents/${encodeURIComponent(id)}/file`)
      ).blob(),
  },
  me: () => request<Profile>('/auth/me'),
  portalInvoices: (customerId: string, params: URLSearchParams) =>
    request<Page<Invoice>>(
      `/portal/customers/${customerId}/invoices?${params}`,
    ),
  dashboard: () => request<Dashboard>('/dashboard'),
  financialOverview: (params: URLSearchParams) =>
    request<FinancialOverview>(`/dashboard/overview?${params}`),
  invoiceReconciliation: (id: string, params: URLSearchParams) =>
    request<InvoiceReconciliation>(`/invoices/${id}/reconciliation?${params}`),
  matchInvoiceIncome: (
    id: string,
    data: { financialEntryId: string; amount: string },
  ) =>
    request<InvoiceReconciliation>(`/invoices/${id}/reconciliation`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  unmatchInvoiceIncome: (id: string, matchId: string) =>
    request<void>(`/invoices/${id}/reconciliation/${matchId}`, {
      method: 'DELETE',
    }),
  tracker: (year: string, currency = 'MYR') =>
    request<TrackerSummary>(
      `/dashboard/tracker?${new URLSearchParams({ currency, ...(year ? { year } : {}) })}`,
    ),
  financialWorkbook: (
    year: string,
    currency = 'MYR',
    includeTestPayments = false,
    page = 0,
    q = '',
  ) =>
    request<FinancialWorkbook>(
      `/dashboard/tracker/workbook?${new URLSearchParams({ page: String(page), size: '50', q, currency, ...(year ? { year } : {}), ...(includeTestPayments ? { includeTestPayments: 'true' } : {}) })}`,
    ),
  financialRecords: {
    create: (data: FinancialTransactionInput) =>
      request<TrackerTransaction>('/financial-records/transactions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: FinancialTransactionInput) =>
      request<TrackerTransaction>(`/financial-records/transactions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    createAsset: (data: FinancialAssetInput) =>
      request<FinancialAsset>('/financial-records/assets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateAsset: (id: string, data: FinancialAssetInput) =>
      request<FinancialAsset>(`/financial-records/assets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },
  trackerTransactions: (params: URLSearchParams) =>
    request<Page<TrackerTransaction>>(
      `/dashboard/tracker/transactions?${params}`,
    ),
  customers: resource<Customer, CustomerInput>('customers'),
  leads: resource<Lead, LeadInput>('leads'),
  websites: resource<Website, WebsiteInput>('websites'),
  expenses: resource<Expense, ExpenseInput>('expenses'),
  invoices: resource<Invoice, InvoiceInput>('invoices'),
};
