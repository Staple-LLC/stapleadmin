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
import ProjectsPage from './projects';
import { chooseSelectValue } from '../test-utils/select';
const mock = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  summary: vi.fn(),
  costs: vi.fn(),
  assign: vi.fn(),
  unassign: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  customers: vi.fn(),
  customer: vi.fn(),
}));
vi.mock('../lib/api', () => ({
  ApiError: class extends Error {},
  api: {
    projects: {
      list: mock.list,
      get: mock.get,
      summary: mock.summary,
      costs: mock.costs,
      assign: mock.assign,
      unassign: mock.unassign,
      create: mock.create,
      update: mock.update,
    },
    customers: { list: mock.customers, get: mock.customer },
  },
}));
const page = (content: unknown[]) => ({
  content,
  page: 0,
  size: 20,
  totalElements: content.length,
  totalPages: content.length ? 1 : 0,
});
let project = {
  id: 'p1',
  customerId: 'c1',
  customerName: 'Acme Studio',
  name: 'Client website',
  currency: 'MYR',
  agreedValue: '1500.00',
  costBudget: '150.00',
  status: 'ACTIVE',
  notes: 'Client website build',
  version: 0,
  directCosts: '100.00',
  margin: '1400.00',
  budgetRemaining: '50.00',
  costCount: 1,
  createdAt: '2026-01-01T00:00:00Z',
};
const linked = {
  id: 'e1',
  date: '2026-01-15',
  description: 'Domain purchase',
  category: 'Domain',
  amount: '100.00',
  currency: 'MYR',
  projectId: 'p1',
  projectName: 'Client website',
};
function mount(path = '/projects') {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <ProjectsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  project = {
    ...project,
    directCosts: '100.00',
    margin: '1400.00',
    budgetRemaining: '50.00',
    costCount: 1,
  };
  mock.list.mockImplementation(async () => page([project]));
  mock.get.mockImplementation(async () => project);
  mock.summary.mockResolvedValue({
    currency: 'MYR',
    agreedValue: '1500.00',
    directCosts: '100.00',
    margin: '1400.00',
    sharedExpenses: '99.00',
    unassignedExpenses: '100.00',
  });
  mock.costs.mockImplementation(async (_id: string, params: URLSearchParams) =>
    page(
      params.get('available') === 'true'
        ? [
            {
              ...linked,
              id: 'e2',
              description: 'Client artwork',
              amount: '20.00',
              projectId: null,
            },
          ]
        : [linked],
    ),
  );
  mock.customers.mockResolvedValue(
    page([{ id: 'c1', businessName: 'Acme Studio' }]),
  );
  mock.customer.mockResolvedValue({ id: 'c1', businessName: 'Acme Studio' });
  mock.assign.mockResolvedValue(undefined);
  mock.unassign.mockResolvedValue(undefined);
  mock.create.mockImplementation(async (input) => ({ ...project, ...input }));
});
afterEach(cleanup);
it('shows shared overhead separately from project direct costs and explains the margin', async () => {
  mount();
  await screen.findByText(/99.00 shared subscriptions/);
  expect(screen.getByText(/100.00 other unassigned expenses/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'View Client website' }));
  await screen.findByRole('heading', { name: 'Client website' });
  expect(screen.getByText(/Margin = agreed project value/)).toBeTruthy();
  const card = screen.getByText('Margin before overhead').parentElement!;
  expect(card.textContent).toContain('1,400.00');
  expect(
    screen.getByText('Actual direct costs').parentElement?.textContent,
  ).toContain('100.00');
  expect(
    screen.getByText('Budget remaining').parentElement?.textContent,
  ).toContain('50.00');
});
it('links an existing expense and refreshes project amounts', async () => {
  mount('/projects?project=p1');
  await screen.findByRole('heading', { name: 'Client website' });
  fireEvent.click(
    screen.getByRole('button', { name: 'Link an existing expense' }),
  );
  await screen.findByText('Client artwork');
  mock.assign.mockImplementation(async () => {
    project = {
      ...project,
      directCosts: '120.00',
      margin: '1380.00',
      budgetRemaining: '30.00',
      costCount: 2,
    };
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add to project' }));
  await waitFor(() => expect(mock.assign).toHaveBeenCalledWith('p1', 'e2'));
  await waitFor(() =>
    expect(
      screen.getByText('Actual direct costs').parentElement?.textContent,
    ).toContain('120.00'),
  );
  expect(screen.getByText(/without recording another expense/)).toBeTruthy();
});
it('unlinks a project cost without labelling it as shared overhead or deleting it', async () => {
  mount('/projects?project=p1');
  await screen.findByText('Domain purchase');
  fireEvent.click(
    within(
      screen.getByRole('region', { name: 'Project direct costs' }),
    ).getByRole('button', { name: 'Unlink cost' }),
  );
  await waitFor(() => expect(mock.unassign).toHaveBeenCalledWith('p1', 'e1'));
});
it('creates a project with a customer, agreed value and optional direct cost budget', async () => {
  mount();
  await screen.findByText('Client website');
  fireEvent.click(screen.getByRole('button', { name: 'New project' }));
  await chooseSelectValue(
    screen.getByRole('combobox', { name: 'Customer' }),
    'c1',
  );
  fireEvent.change(screen.getByLabelText('Project name'), {
    target: { value: 'New website' },
  });
  fireEvent.change(screen.getByLabelText('Agreed project value'), {
    target: { value: '1500.00' },
  });
  fireEvent.change(screen.getByLabelText('Direct cost budget (optional)'), {
    target: { value: '200.00' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save project' }));
  await waitFor(() =>
    expect(mock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'c1',
        name: 'New website',
        agreedValue: '1500.00',
        costBudget: '200.00',
        currency: 'MYR',
        status: 'ACTIVE',
      }),
    ),
  );
});
