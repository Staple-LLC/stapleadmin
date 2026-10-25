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
import BillingPage, { BillingReturn } from './billing';
import { BillingDomains } from './billing-domains';
const mock = vi.hoisted(() => ({
  config: vi.fn(),
  serviceList: vi.fn(),
  serviceGet: vi.fn(),
  serviceCreate: vi.fn(),
  planList: vi.fn(),
  planCreate: vi.fn(),
  planUpdate: vi.fn(),
  domainList: vi.fn(),
  domainCreate: vi.fn(),
  domainUpdate: vi.fn(),
  paymentList: vi.fn(),
  customers: vi.fn(),
  customer: vi.fn(),
  checkout: vi.fn(),
  cancel: vi.fn(),
  portal: vi.fn(),
  issueInvoice: vi.fn(),
}));
vi.mock('../lib/api', () => ({
  ApiError: class extends Error {},
  api: {
    customers: { list: mock.customers, get: mock.customer },
    billing: {
      config: mock.config,
      services: {
        list: mock.serviceList,
        get: mock.serviceGet,
        create: mock.serviceCreate,
      },
      plans: {
        list: mock.planList,
        create: mock.planCreate,
        update: mock.planUpdate,
      },
      domains: {
        list: mock.domainList,
        create: mock.domainCreate,
        update: mock.domainUpdate,
      },
      payments: { list: mock.paymentList },
      checkout: mock.checkout,
      cancel: mock.cancel,
      portal: mock.portal,
      issueInvoice: mock.issueInvoice,
    },
  },
}));
const page = (content: unknown[]) => ({
  content,
  page: 0,
  size: 20,
  totalElements: content.length,
  totalPages: content.length ? 1 : 0,
});
const customer = { id: 'customer-1', businessName: 'Acme Studio' };
const monthly = {
  id: 'plan-1',
  code: 'WEBSITE_MONTHLY',
  name: 'Managed website',
  description: 'Cancel anytime.',
  kind: 'WEBSITE',
  interval: 'MONTH',
  amount: '99.00',
  currency: 'MYR',
  active: true,
  version: 0,
};
const domainPlan = {
  ...monthly,
  id: 'plan-domain',
  code: 'DOMAIN_ANNUAL',
  name: 'Annual domain management',
  kind: 'DOMAIN',
  interval: 'YEAR',
  amount: null,
};
const service = {
  id: 'service-1',
  customerId: customer.id,
  customerName: customer.businessName,
  planId: monthly.id,
  planName: monthly.name,
  name: 'Acme website',
  kind: 'WEBSITE',
  interval: 'MONTH',
  amount: '99.00',
  currency: 'MYR',
  collectionMode: 'AUTO_CARD',
  status: 'PENDING',
  nextBillingDate: '2027-01-01',
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  websiteId: null,
  domainId: null,
  domainName: null,
  checkoutUrl: null,
  checkoutExpiresAt: null,
  stripeSubscriptionId: null,
  billingTest: false,
  createdAt: '2026-10-24T00:00:00Z',
  version: 0,
};
const domain = {
  id: 'domain-1',
  customerId: customer.id,
  customerName: customer.businessName,
  websiteId: 'website-1',
  name: 'acme.com',
  registrar: 'Porkbun',
  expiresOn: '2027-10-24',
  renewalStatus: 'MANUAL',
  notes: '',
  version: 0,
  createdAt: '2026-10-24T00:00:00Z',
};
function mount(
  path = '/billing',
  component = <BillingPage invoices={<p>Existing invoice records</p>} />,
) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <MemoryRouter initialEntries={[path]}>{component}</MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.config.mockResolvedValue({
    mode: 'DISABLED',
    checkoutEnabled: false,
    webhookConfigured: false,
    fpxEnabled: false,
    message: 'Stripe credentials are not configured.',
  });
  mock.serviceList.mockResolvedValue(page([service]));
  mock.serviceGet.mockResolvedValue(service);
  mock.serviceCreate.mockResolvedValue(service);
  mock.planList.mockResolvedValue(page([monthly, domainPlan]));
  mock.planCreate.mockResolvedValue(monthly);
  mock.planUpdate.mockResolvedValue(monthly);
  mock.domainList.mockResolvedValue(page([domain]));
  mock.domainCreate.mockResolvedValue(domain);
  mock.domainUpdate.mockResolvedValue(domain);
  mock.paymentList.mockResolvedValue(page([]));
  mock.customers.mockResolvedValue(page([customer]));
  mock.customer.mockResolvedValue(customer);
  mock.cancel.mockResolvedValue({ ...service, cancelAtPeriodEnd: true });
  mock.issueInvoice.mockResolvedValue({ id: 'invoice-1', number: 'INV-001' });
  mock.checkout.mockResolvedValue({
    url: 'https://checkout.stripe.com/test-session',
    expiresAt: '2026-10-25T00:00:00Z',
    billingTest: true,
  });
});
afterEach(cleanup);
it('keeps online checkout disabled until Stripe is configured without preventing service setup', async () => {
  mount();
  await screen.findByText('Acme website');
  expect(screen.getByRole('button', { name: 'Add service' })).toBeTruthy();
  fireEvent.click(
    screen.getByRole('button', { name: 'Manage Acme website for Acme Studio' }),
  );
  const checkout = await screen.findByRole('button', {
    name: 'Generate payment link',
  });
  expect((checkout as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(checkout);
  expect(mock.checkout).not.toHaveBeenCalled();
  expect(
    screen.getByText(/Stripe credentials are not configured/),
  ).toBeTruthy();
});
it('creates a quoted annual domain service with an explicit collection mode and no charge', async () => {
  mount('/billing?customerId=customer-1');
  await screen.findByText('Acme website');
  fireEvent.click(screen.getByRole('button', { name: 'Add service' }));
  await chooseSelectValue(screen.getByLabelText('Plan'), 'plan-domain');
  fireEvent.change(screen.getByLabelText('Agreed annual price (MYR)'), {
    target: { value: '120.00' },
  });
  await chooseSelectValue(screen.getByLabelText('Domain'), 'domain-1');
  await chooseSelectValue(
    screen.getByLabelText('How the customer pays'),
    'AUTO_CARD',
  );
  fireEvent.change(screen.getByLabelText('First billing date (optional)'), {
    target: { value: '2027-09-24' },
  });
  expect(screen.getByText(/future date saves the card now/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Save service' }));
  await waitFor(() =>
    expect(mock.serviceCreate).toHaveBeenCalledWith({
      customerId: 'customer-1',
      planId: 'plan-domain',
      name: 'Annual domain management',
      amount: '120.00',
      collectionMode: 'AUTO_CARD',
      domainId: 'domain-1',
      nextBillingDate: '2027-09-24',
    }),
  );
  expect(mock.checkout).not.toHaveBeenCalled();
});
it('generates a test link only on request and does not claim the customer has paid', async () => {
  mock.config.mockResolvedValue({
    mode: 'TEST',
    checkoutEnabled: true,
    webhookConfigured: true,
    fpxEnabled: true,
    message: 'Test mode.',
  });
  mount();
  await screen.findByText('Acme website');
  expect(mock.checkout).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Manage Acme website for Acme Studio' }),
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Generate payment link' }),
  );
  await screen.findByText('Customer checkout link · TEST');
  expect(mock.checkout).toHaveBeenCalledWith('service-1');
  expect(
    (screen.getByLabelText('Customer checkout link') as HTMLInputElement).value,
  ).toBe('https://checkout.stripe.com/test-session');
  expect(
    screen.getByText(/Payment status updates after Stripe confirms/),
  ).toBeTruthy();
});
it('requires confirmation before scheduling a subscription cancellation', async () => {
  const active = {
    ...service,
    status: 'ACTIVE',
    stripeSubscriptionId: 'sub_1',
    currentPeriodEnd: '2026-11-24T00:00:00Z',
  };
  mock.serviceList.mockResolvedValue(page([active]));
  mock.serviceGet.mockResolvedValue(active);
  mount();
  await screen.findByText('Acme website');
  fireEvent.click(
    screen.getByRole('button', { name: 'Manage Acme website for Acme Studio' }),
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Cancel future billing' }),
  );
  expect(mock.cancel).not.toHaveBeenCalled();
  expect(screen.getByText(/No automatic refund is issued/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Keep subscription' }));
  expect(mock.cancel).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Cancel future billing' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
  await waitFor(() => expect(mock.cancel).toHaveBeenCalledWith('service-1'));
});
it('issues a bank transfer invoice without creating a payment or checkout', async () => {
  const manual = { ...service, collectionMode: 'MANUAL' };
  mock.serviceList.mockResolvedValue(page([manual]));
  mock.serviceGet.mockResolvedValue(manual);
  mount();
  await screen.findByText('Acme website');
  fireEvent.click(
    screen.getByRole('button', { name: 'Manage Acme website for Acme Studio' }),
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Issue bank transfer invoice' }),
  );
  fireEvent.change(screen.getByLabelText('Issue date'), {
    target: { value: '2026-10-24' },
  });
  fireEvent.change(screen.getByLabelText('Due date'), {
    target: { value: '2026-10-31' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
  await screen.findByText(/Invoice INV-001 created/);
  expect(mock.issueInvoice).toHaveBeenCalledWith('service-1', {
    issueDate: '2026-10-24',
    dueDate: '2026-10-31',
  });
  expect(mock.checkout).not.toHaveBeenCalled();
});
it('keeps customer and status filters in payment requests and preserves the invoice tab', async () => {
  mount('/billing?tab=payments&customerId=customer-1');
  await screen.findByText('No payments yet');
  await chooseSelectValue(screen.getByLabelText('Payment status'), 'FAILED');
  fireEvent.change(screen.getByLabelText('Search payments'), {
    target: { value: 'Acme' },
  });
  await waitFor(() =>
    expect(mock.paymentList.mock.lastCall?.[0].get('q')).toBe('Acme'),
  );
  const params = mock.paymentList.mock.lastCall?.[0];
  expect(params.get('customerId')).toBe('customer-1');
  expect(params.get('status')).toBe('FAILED');
  fireEvent.click(screen.getByRole('tab', { name: 'invoices' }));
  expect(screen.getByText('Existing invoice records')).toBeTruthy();
});
it('archives a plan using its version and leaves existing customer agreements unchanged', async () => {
  mount('/billing?tab=plans');
  await screen.findByText('Managed website');
  const card = screen
    .getByRole('heading', { name: 'Managed website' })
    .closest('article')!;
  fireEvent.click(within(card).getByRole('button', { name: 'Edit plan' }));
  fireEvent.click(screen.getByLabelText('Available for new customer services'));
  fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));
  await waitFor(() =>
    expect(mock.planUpdate).toHaveBeenCalledWith(
      'plan-1',
      expect.objectContaining({ active: false, version: 0, amount: '99.00' }),
    ),
  );
  expect(mock.serviceCreate).not.toHaveBeenCalled();
});
it('edits registrar records with website scoping without simulating domain renewal', async () => {
  mount(
    '/websites',
    <BillingDomains websiteId="website-1" customerId="customer-1" />,
  );
  await screen.findByText('acme.com');
  expect(mock.domainList.mock.lastCall?.[0].get('websiteId')).toBe('website-1');
  fireEvent.click(screen.getByRole('button', { name: 'Edit acme.com' }));
  fireEvent.change(screen.getByLabelText('Expiry date'), {
    target: { value: '2028-10-24' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save domain' }));
  await waitFor(() =>
    expect(mock.domainUpdate).toHaveBeenCalledWith(
      'domain-1',
      expect.objectContaining({
        expiresOn: '2028-10-24',
        version: 0,
        customerId: 'customer-1',
        websiteId: 'website-1',
      }),
    ),
  );
  expect(mock.checkout).not.toHaveBeenCalled();
});
it('does not treat returning from checkout as proof of payment', () => {
  mount('/billing-return?status=success', <BillingReturn />);
  expect(
    screen.getByText(/Payment confirmation comes from Stripe/),
  ).toBeTruthy();
  expect(mock.checkout).not.toHaveBeenCalled();
  expect(mock.serviceList).not.toHaveBeenCalled();
});
it('can cancel an unpaid bank transfer service immediately after explicit confirmation', async () => {
  const manual = { ...service, collectionMode: 'MANUAL' };
  mock.serviceList.mockResolvedValue(page([manual]));
  mock.serviceGet.mockResolvedValue(manual);
  mock.cancel.mockResolvedValue({
    ...manual,
    status: 'CANCELLED',
    cancelAtPeriodEnd: false,
  });
  mount();
  await screen.findByText('Acme website');
  fireEvent.click(
    screen.getByRole('button', { name: 'Manage Acme website for Acme Studio' }),
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Cancel service' }),
  );
  expect(mock.cancel).not.toHaveBeenCalled();
  expect(
    screen.getByText(/cancelled now and any open checkout link/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
  await screen.findByText(
    'Service cancelled. Other customer services are unchanged.',
  );
  expect(mock.cancel).toHaveBeenCalledWith('service-1');
});
it('rejects a first automatic charge date too soon for Stripe before creating a service', async () => {
  mount('/billing?customerId=customer-1');
  await screen.findByText('Acme website');
  fireEvent.click(screen.getByRole('button', { name: 'Add service' }));
  await chooseSelectValue(screen.getByLabelText('Plan'), 'plan-1');
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  fireEvent.change(screen.getByLabelText('First billing date (optional)'), {
    target: { value: tomorrow },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save service' }));
  await screen.findByText(
    'For automatic card billing, choose today or a first charge date between 3 and 729 days away.',
  );
  expect(mock.serviceCreate).not.toHaveBeenCalled();
});
it('refreshes billing records on request', async () => {
  mount();
  await screen.findByText('Acme website');
  const before = mock.serviceList.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Refresh billing' }));
  await waitFor(() =>
    expect(mock.serviceList.mock.calls.length).toBeGreaterThan(before),
  );
});
