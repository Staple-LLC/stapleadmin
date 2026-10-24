import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Globe,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api } from '../lib/api';
import type {
  BillingConfig,
  BillingPlan,
  BillingPlanInput,
  BillingService,
  BillingServiceInput,
} from '../lib/api';
import { currencies, refreshFinancialRecords } from '../lib/financial-records';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import {
  BillingCustomerSelect,
  BillingPager,
  BillingQueryState,
  billingDate,
  billingError,
  billingMoney,
  billingParams,
} from './billing-common';
import { BillingDomains } from './billing-domains';
import './billing.css';

const cycle = (interval: string) =>
  ({ ONCE: 'one time', MONTH: 'monthly', YEAR: 'annually' })[interval] ??
  interval;
const collection = (mode: string) =>
  ({
    AUTO_CARD: 'Automatic card',
    ONLINE: 'Payment link',
    MANUAL: 'Bank transfer',
  })[mode] ?? mode;
const titleCase = (value: string) => value.toLowerCase().replaceAll('_', ' ');
const today = () => new Date().toISOString().slice(0, 10);
const tabs = ['services', 'invoices', 'payments', 'plans'] as const;
type BillingTab = (typeof tabs)[number];
export default function BillingPage({
  invoices,
  customerId: providedCustomerId,
}: {
  invoices: ReactNode;
  customerId?: string;
}) {
  const [params, setParams] = useSearchParams();
  const cache = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  async function refreshBilling() {
    setRefreshing(true);
    try {
      await refreshFinancialRecords(cache);
    } finally {
      setRefreshing(false);
    }
  }
  const tab: BillingTab = tabs.includes(params.get('tab') as BillingTab)
    ? (params.get('tab') as BillingTab)
    : 'services';
  const customerId = providedCustomerId ?? params.get('customerId') ?? '';
  const config = useQuery({
    queryKey: ['billing', 'config'],
    queryFn: api.billing.config,
  });
  const customer = useQuery({
    queryKey: ['billing', 'customer', customerId],
    queryFn: () => api.customers.get(customerId),
    enabled: Boolean(customerId),
  });
  return (
    <main className="page billing-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">FINANCE</p>
          <h1>Billing</h1>
          <p className="muted">
            Your customer services, invoices and payments in one place.
          </p>
        </div>
        <div className="billing-header-actions">
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => void refreshBilling()}
          >
            <RefreshCw size={14} />
            {refreshing ? 'Refreshing…' : 'Refresh billing'}
          </Button>
          <span
            className={`billing-provider ${config.data?.mode === 'LIVE' ? 'billing-provider-live' : ''}`}
          >
            <CreditCard size={15} />
            {config.isPending
              ? 'Checking Stripe…'
              : config.data?.mode === 'LIVE'
                ? 'Stripe live'
                : config.data?.mode === 'TEST'
                  ? 'Stripe test mode'
                  : 'Stripe not connected'}
          </span>
        </div>
      </div>
      {config.error && (
        <div className="error" role="alert">
          Payment configuration could not be loaded.{' '}
          {billingError(config.error)}{' '}
          <button onClick={() => void config.refetch()}>Retry</button>
        </div>
      )}
      {config.data?.mode !== 'LIVE' && config.data && (
        <div className="billing-banner">
          <CreditCard size={20} />
          <div>
            <strong>
              {config.data.mode === 'TEST'
                ? 'Test payments only'
                : 'Set up your services now'}
            </strong>
            <p>
              {config.data.mode === 'TEST'
                ? 'Checkout uses Stripe test mode. Test payments do not collect real money or add to your financial totals.'
                : 'Save plans and customer services, or issue bank transfer invoices. Connect Stripe in the backend to generate online payment links.'}
            </p>
          </div>
        </div>
      )}
      {customerId && (
        <div className="billing-customer-scope">
          <span>
            Billing for{' '}
            <strong>
              {customer.data?.businessName ?? 'selected customer'}
            </strong>
          </span>
          {!providedCustomerId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setParams((previous) => {
                  const next = new URLSearchParams(previous);
                  next.delete('customerId');
                  return next;
                })
              }
            >
              View all customers
            </Button>
          )}
        </div>
      )}
      <div
        className="billing-tabs"
        role="tablist"
        aria-label="Billing sections"
      >
        {tabs.map((item) => (
          <button
            key={item}
            role="tab"
            id={`billing-tab-${item}`}
            aria-selected={tab === item}
            aria-controls={`billing-panel-${item}`}
            tabIndex={tab === item ? 0 : -1}
            onKeyDown={(event) => {
              if (
                !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
              )
                return;
              event.preventDefault();
              const index = tabs.indexOf(item);
              const target =
                tabs[
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? tabs.length - 1
                      : (index +
                          (event.key === 'ArrowRight' ? 1 : -1) +
                          tabs.length) %
                        tabs.length
                ];
              setParams((previous) => {
                const next = new URLSearchParams(previous);
                next.set('tab', target);
                return next;
              });
              document.getElementById(`billing-tab-${target}`)?.focus();
            }}
            onClick={() =>
              setParams((previous) => {
                const next = new URLSearchParams(previous);
                next.set('tab', item);
                return next;
              })
            }
          >
            {item === 'services' ? 'Customer services' : titleCase(item)}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={`billing-panel-${tab}`}
        aria-labelledby={`billing-tab-${tab}`}
      >
        {tab === 'services' && (
          <Services
            key={customerId}
            customerId={customerId}
            config={config.data}
          />
        )}
        {tab === 'invoices' && (
          <div className="billing-invoices">{invoices}</div>
        )}
        {tab === 'payments' && (
          <Payments key={customerId} customerId={customerId} />
        )}
        {tab === 'plans' && <Plans />}
      </section>
    </main>
  );
}

function Services({
  customerId,
  config,
}: {
  customerId: string;
  config?: BillingConfig;
}) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('createdAt,desc');
  const [adding, setAdding] = useState(false);
  const [showDomains, setShowDomains] = useState(false);
  const [selected, setSelected] = useState<BillingService | null>(null);
  const query = useQuery({
    queryKey: ['billing', 'services', page, search, status, sort, customerId],
    refetchOnWindowFocus: true,
    queryFn: () =>
      api.billing.services.list(
        billingParams(page, search, {
          sort,
          ...(status ? { status } : {}),
          ...(customerId ? { customerId } : {}),
        }),
      ),
  });
  return (
    <>
      <div className="billing-section-heading">
        <div>
          <h2>Every service, one clear schedule</h2>
          <p>
            Monthly websites, one-time projects and annual domain management.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus size={16} />
          Add service
        </Button>
      </div>
      <div className="billing-records">
        <div className="billing-toolbar">
          <label className="billing-search">
            <Search size={16} />
            <input
              aria-label="Search customer services"
              placeholder="Search customer or service…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <select
            aria-label="Service status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
          >
            <option value="">All statuses</option>
            {['PENDING', 'ACTIVE', 'PAST_DUE', 'COMPLETED', 'CANCELLED'].map(
              (value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ),
            )}
          </select>
          <select
            aria-label="Sort customer services"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(0);
            }}
          >
            <option value="createdAt,desc">Newest first</option>
            <option value="createdAt,asc">Oldest first</option>
            <option value="name,asc">Service name</option>
            <option value="nextBillingDate,asc">Next billing date</option>
          </select>
        </div>
        <BillingQueryState
          pending={query.isPending}
          error={query.error}
          retry={query.refetch}
          empty={!query.data?.content.length}
        >
          <CreditCard size={32} />
          <h3>Your services start here</h3>
          <p>
            Add a customer’s website or domain service, then choose how they
            pay.
          </p>
        </BillingQueryState>
        {query.data && query.data.content.length > 0 && (
          <div className="billing-table-scroll">
            <table className="billing-table">
              <thead>
                <tr>
                  <th>Customer & service</th>
                  <th>Price</th>
                  <th>Collection</th>
                  <th>Next billing</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {query.data.content.map((service) => (
                  <tr key={service.id}>
                    <td>
                      <strong>{service.name}</strong>
                      <span>
                        {service.customerName}
                        {service.domainName ? ` · ${service.domainName}` : ''}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {billingMoney(service.amount, service.currency)}
                      </strong>
                      <span>{cycle(service.interval)}</span>
                    </td>
                    <td>
                      {collection(service.collectionMode)}
                      {service.billingTest && (
                        <span className="billing-test">Test</span>
                      )}
                    </td>
                    <td>
                      {billingDate(service.nextBillingDate)}
                      {service.cancelAtPeriodEnd && (
                        <span>
                          Ends {billingDate(service.currentPeriodEnd)}
                        </span>
                      )}
                    </td>
                    <td>
                      <Status
                        value={
                          service.cancelAtPeriodEnd ? 'ENDING' : service.status
                        }
                      />
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Manage ${service.name} for ${service.customerName}`}
                        onClick={() => setSelected(service)}
                      >
                        Manage
                        <ArrowUpRight size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <BillingPager data={query.data} page={page} onPage={setPage} />
      </div>
      <p className="billing-footnote">
        <Globe size={15} />
        Website and domain services have separate billing schedules. Cancelling
        one leaves the other unchanged.
      </p>
      <details
        className="billing-domains-disclosure"
        onToggle={(event) => setShowDomains(event.currentTarget.open)}
      >
        <summary>
          <Globe size={16} /> Managed domains & renewal dates
        </summary>
        {showDomains && <BillingDomains customerId={customerId || undefined} />}
      </details>
      {adding && (
        <ServiceEditor
          customerId={customerId}
          onClose={() => setAdding(false)}
          onSaved={(service) => {
            setAdding(false);
            setSelected(service);
          }}
        />
      )}
      {selected && (
        <ServiceDetails
          service={selected}
          config={config}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={`billing-status billing-status-${value.toLowerCase()}`}>
      {titleCase(value)}
    </span>
  );
}
function ServiceEditor({
  customerId: initialCustomerId,
  onClose,
  onSaved,
}: {
  customerId: string;
  onClose: () => void;
  onSaved: (service: BillingService) => void;
}) {
  const cache = useQueryClient();
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [planId, setPlanId] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [domainId, setDomainId] = useState('');
  const [collectionMode, setCollectionMode] =
    useState<BillingServiceInput['collectionMode']>('AUTO_CARD');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const plans = useQuery({
    queryKey: ['billing', 'plan-options'],
    queryFn: () =>
      api.billing.plans.list(
        new URLSearchParams({ active: 'true', size: '100', sort: 'name,asc' }),
      ),
  });
  const domains = useQuery({
    queryKey: ['billing', 'domain-options', customerId],
    queryFn: () =>
      api.billing.domains.list(
        new URLSearchParams({ customerId, size: '100' }),
      ),
    enabled: Boolean(customerId),
  });
  const selectedPlan = plans.data?.content.find((plan) => plan.id === planId);
  function choosePlan(id: string) {
    const plan = plans.data?.content.find((item) => item.id === id);
    setPlanId(id);
    setName(plan?.name ?? '');
    setAmount(plan?.amount ?? '');
    setDomainId('');
    setCollectionMode(plan?.interval === 'ONCE' ? 'ONLINE' : 'AUTO_CARD');
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (
      collectionMode === 'AUTO_CARD' &&
      nextBillingDate &&
      nextBillingDate > today()
    ) {
      const delay =
        new Date(`${nextBillingDate}T00:00:00Z`).getTime() - Date.now();
      if (delay < 49 * 60 * 60 * 1000 || delay > 729 * 24 * 60 * 60 * 1000) {
        setError(
          'For automatic card billing, choose today or a first charge date between 3 and 729 days away.',
        );
        return;
      }
    }
    setBusy(true);
    setError('');
    try {
      const service = await api.billing.services.create({
        customerId,
        planId,
        name: name.trim(),
        amount: amount || undefined,
        collectionMode,
        ...(domainId ? { domainId } : {}),
        ...(nextBillingDate ? { nextBillingDate } : {}),
      });
      await cache.invalidateQueries({ queryKey: ['billing'] });
      onSaved(service);
    } catch (cause) {
      setError(billingError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle className="text-xl font-semibold">
          Add customer service
        </DialogTitle>
        <DialogDescription className="billing-dialog-description">
          Choose the service and billing schedule. Saving does not charge the
          customer or renew a domain.
        </DialogDescription>
        <form className="billing-form" onSubmit={(event) => void save(event)}>
          <fieldset disabled={busy}>
            <BillingCustomerSelect
              value={customerId}
              onChange={(value) => {
                setCustomerId(value);
                setDomainId('');
              }}
            />
            <label>
              Plan
              <select
                required
                value={planId}
                disabled={plans.isPending}
                onChange={(event) => choosePlan(event.target.value)}
              >
                <option value="">Choose a plan</option>
                {plans.data?.content.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} —{' '}
                    {plan.amount === null
                      ? 'quoted price'
                      : billingMoney(plan.amount, plan.currency)}{' '}
                    {cycle(plan.interval)}
                  </option>
                ))}
              </select>
            </label>
            {plans.error && (
              <p className="error" role="alert">
                {billingError(plans.error)}
              </p>
            )}
            {selectedPlan && (
              <>
                <label>
                  Service name
                  <input
                    required
                    maxLength={200}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    {selectedPlan.amount === null
                      ? 'Agreed annual price'
                      : 'Agreed price'}{' '}
                    ({selectedPlan.currency})
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      required
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </label>
                  <label>
                    Billing frequency
                    <input value={cycle(selectedPlan.interval)} readOnly />
                  </label>
                </div>
                {selectedPlan.kind === 'DOMAIN' && (
                  <>
                    <label>
                      Domain
                      <select
                        required
                        value={domainId}
                        onChange={(event) => setDomainId(event.target.value)}
                      >
                        <option value="">Choose this customer’s domain</option>
                        {domains.data?.content.map((domain) => (
                          <option key={domain.id} value={domain.id}>
                            {domain.name} · expires{' '}
                            {billingDate(domain.expiresOn)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {domains.error && (
                      <p role="alert" className="error">
                        {billingError(domains.error)}
                      </p>
                    )}
                    <p className="billing-help">
                      Include the renewal cost and your management fee in the
                      agreed price. Add the domain under Managed domains on the
                      Customer services tab first. Payment and registrar renewal
                      are separate.
                    </p>
                  </>
                )}
                <label>
                  How the customer pays
                  <select
                    value={collectionMode}
                    onChange={(event) =>
                      setCollectionMode(
                        event.target
                          .value as BillingServiceInput['collectionMode'],
                      )
                    }
                  >
                    {selectedPlan.interval !== 'ONCE' && (
                      <option value="AUTO_CARD">
                        Automatic card — {cycle(selectedPlan.interval)}
                      </option>
                    )}
                    <option value="ONLINE">
                      Payment link — customer pays each time
                    </option>
                    <option value="MANUAL">
                      Bank transfer — issue an invoice
                    </option>
                  </select>
                </label>
                <p className="billing-help">
                  {collectionMode === 'AUTO_CARD'
                    ? 'The customer enters their card once on Stripe and agrees to recurring billing. No OS or CMS account is needed. They can cancel future charges.'
                    : collectionMode === 'ONLINE'
                      ? 'Each payment requires the customer to open a new checkout link. This does not authorize automatic recurring charges.'
                      : 'An invoice records what is owed. Confirm funds against your bank records and link the recorded income before marking it settled.'}
                </p>
                {selectedPlan.interval !== 'ONCE' && (
                  <>
                    <label>
                      First billing date (optional)
                      <input
                        type="date"
                        min={today()}
                        value={nextBillingDate}
                        onChange={(event) =>
                          setNextBillingDate(event.target.value)
                        }
                      />
                    </label>
                    <p className="billing-help">
                      {collectionMode === 'AUTO_CARD' &&
                        'Choose today, or a date between 3 and 729 days away. '}
                      {selectedPlan.kind === 'DOMAIN'
                        ? 'For an existing domain, schedule billing around 30 days before expiry. '
                        : ''}
                      {collectionMode === 'AUTO_CARD'
                        ? selectedPlan.kind === 'DOMAIN' && !nextBillingDate
                          ? 'Leave blank to use 30 days before the recorded expiry, or today if that date has passed. A future date saves the card now and charges on that date.'
                          : nextBillingDate
                            ? 'A future date saves the card now and starts charging on that date. Choose today to charge at checkout.'
                            : 'Leave blank to charge when the customer checks out.'
                        : collectionMode === 'ONLINE'
                          ? 'This sets the billing period. The customer is charged when they pay the link, even if the billing date is in the future.'
                          : 'This sets the first invoice period. Payments are recorded only after you confirm the bank transfer.'}
                    </p>
                  </>
                )}
              </>
            )}
          </fieldset>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="form-footer">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button disabled={busy || !selectedPlan || !customerId}>
              {busy ? 'Saving…' : 'Save service'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function ServiceDetails({
  service: original,
  config,
  onClose,
}: {
  service: BillingService;
  config?: BillingConfig;
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ['billing', 'service', original.id],
    queryFn: () => api.billing.services.get(original.id),
    initialData: original,
    refetchOnWindowFocus: true,
    refetchInterval: (query) =>
      ['PENDING', 'PAST_DUE'].includes(query.state.data?.status ?? '') &&
      Boolean(
        query.state.data?.checkoutUrl || query.state.data?.stripeSubscriptionId,
      )
        ? 10_000
        : false,
    refetchIntervalInBackground: false,
  });
  const service = query.data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [link, setLink] = useState<{
    url: string;
    label: string;
    test: boolean;
    expiresAt?: string;
  } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [issue, setIssue] = useState(false);
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const ended = ['CANCELLED', 'COMPLETED'].includes(service.status);
  const cancelAtPeriodEnd =
    Boolean(service.stripeSubscriptionId) ||
    (service.status === 'ACTIVE' &&
      Boolean(service.nextBillingDate && service.nextBillingDate > today()));
  async function act(action: 'checkout' | 'cancel' | 'portal' | 'invoice') {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (action === 'checkout') {
        const result = await api.billing.checkout(service.id);
        setLink({
          ...result,
          test: result.billingTest,
          label: 'Customer checkout link',
        });
      } else if (action === 'portal') {
        const result = await api.billing.portal(service.id);
        setLink({
          ...result,
          test: service.billingTest,
          label: 'Customer billing portal',
        });
      } else if (action === 'cancel') {
        const updated = await api.billing.cancel(service.id);
        setConfirmCancel(false);
        setLink(null);
        setNotice(
          updated.cancelAtPeriodEnd
            ? 'Cancellation scheduled for the end of the billing period. Other customer services are unchanged.'
            : 'Service cancelled. Other customer services are unchanged.',
        );
      } else {
        const invoice = await api.billing.issueInvoice(service.id, {
          issueDate,
          dueDate,
        });
        setIssue(false);
        setNotice(
          `Invoice ${invoice.number} created. Confirm the bank transfer before recording payment.`,
        );
        await refreshFinancialRecords(cache);
      }
      await cache.invalidateQueries({ queryKey: ['billing'] });
    } catch (cause) {
      setError(billingError(cause));
    } finally {
      setBusy(false);
    }
  }
  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setNotice('Link copied. Share it with this customer.');
    } catch {
      setNotice('Select and copy the link below.');
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle className="text-xl font-semibold">
          {service.name}
        </DialogTitle>
        <DialogDescription className="billing-dialog-description">
          {service.customerName} · {service.planName}
        </DialogDescription>
        <div className="billing-service-price">
          <strong>{billingMoney(service.amount, service.currency)}</strong>
          <span>{cycle(service.interval)}</span>
          <Status
            value={service.cancelAtPeriodEnd ? 'ENDING' : service.status}
          />
          {service.billingTest && (
            <span className="billing-test">Test service</span>
          )}
        </div>
        <dl className="billing-details">
          <div>
            <dt>Collection</dt>
            <dd>{collection(service.collectionMode)}</dd>
          </div>
          <div>
            <dt>Next billing</dt>
            <dd>{billingDate(service.nextBillingDate)}</dd>
          </div>
          {service.domainName && (
            <div>
              <dt>Domain</dt>
              <dd>{service.domainName}</dd>
            </div>
          )}
          {service.currentPeriodEnd && (
            <div>
              <dt>
                {service.cancelAtPeriodEnd
                  ? 'Service ends'
                  : 'Current period ends'}
              </dt>
              <dd>{billingDate(service.currentPeriodEnd)}</dd>
            </div>
          )}
        </dl>
        {service.kind === 'DOMAIN' && (
          <p className="billing-help">
            A successful charge does not renew the domain. Confirm renewal
            separately with your registrar and update its expiry date.
          </p>
        )}
        {!service.stripeSubscriptionId &&
          service.collectionMode === 'AUTO_CARD' &&
          service.nextBillingDate &&
          service.nextBillingDate > today() && (
            <p className="billing-help">
              The customer saves their card at checkout. Their first charge is
              scheduled for {billingDate(service.nextBillingDate)}; no payment
              is collected today.
            </p>
          )}
        {service.collectionMode === 'ONLINE' && (
          <p className="billing-help">
            Payment methods:{' '}
            {config?.fpxEnabled && service.currency === 'MYR'
              ? 'card or FPX online banking'
              : 'card'}
            . The customer authorizes and pays each charge at checkout. Future
            billing dates do not delay that payment. There are no automatic
            recurring charges.
          </p>
        )}
        {query.error && (
          <p className="error" role="alert">
            {billingError(query.error)}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="billing-success" role="status">
            <Check size={16} />
            {notice}
          </p>
        )}
        <div className="billing-service-actions">
          {!ended &&
            service.collectionMode !== 'MANUAL' &&
            !service.stripeSubscriptionId && (
              <Button
                disabled={busy || !config?.checkoutEnabled}
                onClick={() => void act('checkout')}
              >
                <CreditCard size={16} />
                {busy ? 'Please wait…' : 'Generate payment link'}
              </Button>
            )}
          {!ended && service.collectionMode === 'MANUAL' && (
            <Button disabled={busy} onClick={() => setIssue(!issue)}>
              Issue bank transfer invoice
            </Button>
          )}
          {service.stripeSubscriptionId && (
            <Button
              variant="outline"
              disabled={busy || !config?.checkoutEnabled}
              onClick={() => void act('portal')}
            >
              Generate billing portal link
            </Button>
          )}
          {!ended && !service.cancelAtPeriodEnd && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmCancel(true)}
            >
              {cancelAtPeriodEnd ? 'Cancel future billing' : 'Cancel service'}
            </Button>
          )}
        </div>
        {!config?.checkoutEnabled && service.collectionMode !== 'MANUAL' && (
          <p className="billing-help">
            Online checkout is unavailable.{' '}
            {config?.message ??
              'Check the Stripe configuration before sending a payment link.'}
          </p>
        )}
        {link && (
          <div className="billing-link-panel">
            <strong>
              {link.label}
              {link.test ? ' · TEST' : ''}
            </strong>
            <input
              aria-label={link.label}
              readOnly
              value={link.url}
              onFocus={(event) => event.currentTarget.select()}
            />
            <div className="billing-service-actions">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void copyLink()}
              >
                <Copy size={14} />
                Copy link
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  Open link
                  <ExternalLink size={14} />
                </a>
              </Button>
            </div>
            {link.expiresAt && (
              <p className="billing-help">
                Expires {billingDate(link.expiresAt)}. Payment status updates
                after Stripe confirms the transaction.
              </p>
            )}
          </div>
        )}
        {confirmCancel && (
          <section
            className="billing-confirm"
            aria-label="Confirm cancellation"
          >
            <h3>
              {cancelAtPeriodEnd
                ? 'Stop future charges?'
                : 'Cancel this service?'}
            </h3>
            <p>
              {cancelAtPeriodEnd
                ? 'This service will end at the close of its current billing period.'
                : 'This service will be cancelled now and any open checkout link will be expired.'}{' '}
              No automatic refund is issued. Existing invoices and financial
              records are retained. The customer’s other services, including
              their domain, remain separate.
            </p>
            <div className="billing-service-actions">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setConfirmCancel(false)}
              >
                {cancelAtPeriodEnd ? 'Keep subscription' : 'Keep service'}
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => void act('cancel')}
              >
                {busy ? 'Cancelling…' : 'Confirm cancellation'}
              </Button>
            </div>
          </section>
        )}
        {issue && (
          <form
            className="billing-confirm billing-form"
            onSubmit={(event) => {
              event.preventDefault();
              void act('invoice');
            }}
          >
            <h3>Issue a bank transfer invoice</h3>
            <p>
              Creates an invoice for{' '}
              {billingMoney(service.amount, service.currency)}. This does not
              record a payment.
            </p>
            <div className="form-grid">
              <label>
                Issue date
                <input
                  required
                  type="date"
                  value={issueDate}
                  disabled={busy}
                  onChange={(event) => setIssueDate(event.target.value)}
                />
              </label>
              <label>
                Due date
                <input
                  required
                  type="date"
                  min={issueDate}
                  value={dueDate}
                  disabled={busy}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>
            </div>
            <div className="billing-service-actions">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setIssue(false)}
              >
                Back
              </Button>
              <Button disabled={busy}>
                {busy ? 'Creating…' : 'Create invoice'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Payments({ customerId }: { customerId: string }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const query = useQuery({
    queryKey: ['billing', 'payments', customerId, page, search, status],
    refetchOnWindowFocus: true,
    queryFn: () =>
      api.billing.payments.list(
        billingParams(page, search, {
          ...(customerId ? { customerId } : {}),
          ...(status ? { status } : {}),
        }),
      ),
  });
  return (
    <>
      <div className="billing-section-heading">
        <div>
          <h2>Payment history</h2>
          <p>
            Confirmed receipts and payment attempts for your customer services.
          </p>
        </div>
      </div>
      <div className="billing-records">
        <div className="billing-toolbar">
          <label className="billing-search">
            <Search size={16} />
            <input
              aria-label="Search payments"
              placeholder="Search customer, service or invoice…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <select
            aria-label="Payment status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
          >
            <option value="">All statuses</option>
            <option value="SUCCEEDED">Succeeded</option>
            <option value="FAILED">Failed</option>
            <option value="PENDING">Pending</option>
            <option value="REFUNDED">Refunded</option>
            <option value="PARTIALLY_REFUNDED">Partially refunded</option>
          </select>
        </div>
        <BillingQueryState
          pending={query.isPending}
          error={query.error}
          retry={query.refetch}
          empty={!query.data?.content.length}
        >
          <CreditCard size={32} />
          <h3>No payments yet</h3>
          <p>
            Payments appear after Stripe confirms a transaction. Sending a link
            does not record income.
          </p>
        </BillingQueryState>
        {query.data && query.data.content.length > 0 && (
          <div className="billing-table-scroll">
            <table className="billing-table">
              <thead>
                <tr>
                  <th>Customer & service</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Reference</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {query.data.content.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <strong>{payment.customerName}</strong>
                      <span>{payment.serviceName}</span>
                      {payment.invoiceNumber && (
                        <span>{payment.invoiceNumber}</span>
                      )}
                    </td>
                    <td>
                      <strong>
                        {billingMoney(payment.amount, payment.currency)}
                      </strong>
                      {payment.refundedAmount &&
                        payment.refundedAmount !== '0.00' && (
                          <span>
                            Refunded{' '}
                            {billingMoney(
                              payment.refundedAmount,
                              payment.currency,
                            )}
                          </span>
                        )}
                      {payment.billingTest && (
                        <span className="billing-test">
                          Test · excluded from finances
                        </span>
                      )}
                    </td>
                    <td>
                      <Status value={payment.status} />
                      {payment.failureReason && (
                        <span className="billing-failure">
                          {payment.failureReason}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="billing-reference">
                        {payment.reference || '—'}
                      </span>
                      <span>{payment.provider}</span>
                    </td>
                    <td>{billingDate(payment.occurredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <BillingPager data={query.data} page={page} onPage={setPage} />
      </div>
      <p className="billing-footnote">
        Only confirmed live payments contribute to collected sales. Test and
        failed payments are excluded.
      </p>
    </>
  );
}
function Plans() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [editing, setEditing] = useState<BillingPlan | null | undefined>();
  const query = useQuery({
    queryKey: ['billing', 'plans', page, search, active],
    queryFn: () =>
      api.billing.plans.list(
        billingParams(page, search, {
          ...(active ? { active } : {}),
          sort: 'name,asc',
        }),
      ),
  });
  return (
    <>
      <div className="billing-section-heading">
        <div>
          <h2>Your service plans</h2>
          <p>
            Reusable prices for new services. Existing customer agreements keep
            their saved price.
          </p>
        </div>
        <Button onClick={() => setEditing(null)}>
          <Plus size={16} />
          Add plan
        </Button>
      </div>
      <div className="billing-records">
        <div className="billing-toolbar">
          <label className="billing-search">
            <Search size={16} />
            <input
              aria-label="Search plans"
              placeholder="Search plans…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <select
            aria-label="Plan availability"
            value={active}
            onChange={(event) => {
              setActive(event.target.value);
              setPage(0);
            }}
          >
            <option value="">All plans</option>
            <option value="true">Active</option>
            <option value="false">Archived</option>
          </select>
        </div>
        <BillingQueryState
          pending={query.isPending}
          error={query.error}
          retry={query.refetch}
          empty={!query.data?.content.length}
        >
          <h3>No matching plans</h3>
          <p>Add a plan or change your filters.</p>
        </BillingQueryState>
        {query.data && (
          <div className="billing-plan-grid">
            {query.data.content.map((plan) => (
              <article key={plan.id} className="billing-plan">
                <div className="billing-plan-top">
                  <span className="eyebrow">{plan.kind}</span>
                  <Status value={plan.active ? 'ACTIVE' : 'ARCHIVED'} />
                </div>
                <h3>{plan.name}</h3>
                <div className="billing-plan-price">
                  <strong>
                    {plan.amount === null
                      ? 'Quoted per customer'
                      : billingMoney(plan.amount, plan.currency)}
                  </strong>
                  <span>{cycle(plan.interval)}</span>
                </div>
                <p>{plan.description || 'A reusable service plan.'}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(plan)}
                >
                  Edit plan
                </Button>
              </article>
            ))}
          </div>
        )}
        <BillingPager data={query.data} page={page} onPage={setPage} />
      </div>
      {editing !== undefined && (
        <PlanEditor plan={editing} onClose={() => setEditing(undefined)} />
      )}
    </>
  );
}
function PlanEditor({
  plan,
  onClose,
}: {
  plan: BillingPlan | null;
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const [input, setInput] = useState<BillingPlanInput>(() =>
    plan
      ? {
          code: plan.code,
          name: plan.name,
          description: plan.description,
          kind: plan.kind,
          interval: plan.interval,
          amount: plan.amount,
          currency: plan.currency,
          active: plan.active,
          version: plan.version,
        }
      : {
          code: '',
          name: '',
          description: '',
          kind: 'OTHER',
          interval: 'ONCE',
          amount: '',
          currency: 'MYR',
          active: true,
        },
  );
  const [quoted, setQuoted] = useState(plan?.amount === null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function change<K extends keyof BillingPlanInput>(
    key: K,
    value: BillingPlanInput[K],
  ) {
    setInput((previous) => ({ ...previous, [key]: value }));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const data = { ...input, amount: quoted ? null : input.amount };
      if (plan) await api.billing.plans.update(plan.id, data);
      else await api.billing.plans.create(data);
      await cache.invalidateQueries({ queryKey: ['billing'] });
      onClose();
    } catch (cause) {
      setError(billingError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle className="text-xl font-semibold">
          {plan ? 'Edit plan' : 'Add plan'}
        </DialogTitle>
        <DialogDescription className="billing-dialog-description">
          Plan changes apply to new customer services. Existing agreed prices
          and billing schedules are preserved.
        </DialogDescription>
        <form className="billing-form" onSubmit={(event) => void save(event)}>
          <fieldset disabled={busy}>
            <div className="form-grid">
              <label>
                Plan name
                <input
                  required
                  maxLength={150}
                  value={input.name}
                  onChange={(event) => change('name', event.target.value)}
                />
              </label>
              <label>
                Plan code
                <input
                  required
                  maxLength={50}
                  pattern="[A-Z0-9_\-]+"
                  value={input.code}
                  onChange={(event) =>
                    change('code', event.target.value.toUpperCase())
                  }
                />
                <small>
                  Uppercase letters, numbers, hyphens or underscores.
                </small>
              </label>
            </div>
            <label>
              Description
              <textarea
                maxLength={2000}
                rows={3}
                value={input.description ?? ''}
                onChange={(event) => change('description', event.target.value)}
              />
            </label>
            <div className="form-grid">
              <label>
                Service type
                <select
                  value={input.kind}
                  onChange={(event) =>
                    change(
                      'kind',
                      event.target.value as BillingPlanInput['kind'],
                    )
                  }
                >
                  <option value="WEBSITE">Website</option>
                  <option value="DOMAIN">Domain</option>
                  <option value="OTHER">Other service</option>
                </select>
              </label>
              <label>
                Billing frequency
                <select
                  value={input.interval}
                  onChange={(event) =>
                    change(
                      'interval',
                      event.target.value as BillingPlanInput['interval'],
                    )
                  }
                >
                  <option value="ONCE">One time</option>
                  <option value="MONTH">Monthly</option>
                  <option value="YEAR">Annually</option>
                </select>
              </label>
            </div>
            <label className="billing-checkbox">
              <input
                type="checkbox"
                checked={quoted}
                onChange={(event) => setQuoted(event.target.checked)}
              />
              Set the price individually for each customer
            </label>
            <div className="form-grid">
              {!quoted && (
                <label>
                  Price
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={input.amount ?? ''}
                    onChange={(event) => change('amount', event.target.value)}
                  />
                </label>
              )}
              <label>
                Currency
                <select
                  value={input.currency}
                  onChange={(event) => change('currency', event.target.value)}
                >
                  {currencies.map((currency) => (
                    <option key={currency}>{currency}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="billing-checkbox">
              <input
                type="checkbox"
                checked={input.active}
                onChange={(event) => change('active', event.target.checked)}
              />
              Available for new customer services
            </label>
          </fieldset>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="form-footer">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button disabled={busy}>{busy ? 'Saving…' : 'Save plan'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function BillingReturn() {
  const [params] = useSearchParams();
  const portal = params.get('status') === 'portal';
  const cancelled =
    params.get('status') === 'cancelled' || params.get('status') === 'cancel';
  return (
    <main className="billing-return">
      <div>
        <CreditCard size={32} />
        <h1>
          {portal
            ? 'Billing session closed'
            : cancelled
              ? 'Checkout closed'
              : 'Thank you'}
        </h1>
        <p>
          {portal
            ? 'Any billing changes will sync from Stripe. Contact your service provider if you need help.'
            : cancelled
              ? 'Your checkout was not completed. You can return to your original payment link when you are ready.'
              : 'Your checkout has been received. Payment confirmation comes from Stripe and may take a moment. Your provider will follow up if anything else is needed.'}
        </p>
        <p className="muted">
          You can close this page. No Staple OS account is required.
        </p>
      </div>
    </main>
  );
}
