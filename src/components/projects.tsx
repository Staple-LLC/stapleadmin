import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, ArrowLeft, Pencil } from 'lucide-react';
import { api } from '../lib/api';
import type { Project, ProjectInput } from '../lib/api';
import { currencies } from '../lib/financial-records';
import { useDebouncedValue } from '../lib/use-debounced-value';
import { BillingCustomerSelect, BillingPager } from './billing-common';
import { Button } from './ui/button';
import { Select, SelectItem } from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import './projects.css';

const money = (value: string, currency: string) =>
  new Intl.NumberFormat('en-MY', { style: 'currency', currency }).format(
    Number(value),
  );
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'Could not save. Please retry.';
export default function ProjectsPage() {
  const [params, setParams] = useSearchParams();
  const id = params.get('project') ?? '';
  const [currency, setCurrency] = useState('MYR');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Project | null | undefined>();
  const q = useDebouncedValue(search);
  const filters = new URLSearchParams({
    currency,
    q,
    page: String(page),
    size: '20',
    status,
  });
  const list = useQuery({
    queryKey: ['projects', 'list', filters.toString()],
    queryFn: () => api.projects.list(filters),
    enabled: !id,
  });
  const summary = useQuery({
    queryKey: ['projects', 'summary', currency],
    queryFn: () => api.projects.summary(currency),
    enabled: !id,
  });
  const detail = useQuery({
    queryKey: ['projects', 'detail', id],
    queryFn: () => api.projects.get(id),
    enabled: !!id,
  });
  const cache = useQueryClient();
  async function saved(project: Project) {
    await cache.invalidateQueries({ queryKey: ['projects'] });
    setEditing(undefined);
    setParams({ project: project.id });
  }
  const project = detail.data;
  return (
    <main className="page projects-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PROJECT FINANCIALS</p>
          <h1>{id ? (project?.name ?? 'Project') : 'Projects'}</h1>
          <p className="muted">
            Direct costs per project. Shared overhead stays in your business
            figures.
          </p>
        </div>
        {id ? (
          <div className="project-actions">
            <Button variant="outline" onClick={() => setParams({})}>
              <ArrowLeft size={15} /> All projects
            </Button>
            <Button disabled={!project} onClick={() => setEditing(project)}>
              <Pencil size={15} /> Edit project
            </Button>
          </div>
        ) : (
          <Button onClick={() => setEditing(null)}>
            <Plus size={15} /> New project
          </Button>
        )}
      </div>
      {!id ? (
        <>
          <div className="project-filters">
            <input
              aria-label="Search projects"
              placeholder="Search project or customer…"
              maxLength={200}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
            <Select
              aria-label="Project currency"
              value={currency}
              onValueChange={(value) => {
                setCurrency(value);
                setPage(0);
              }}
            >
              {currencies.map((value) => (
                <SelectItem key={value}>{value}</SelectItem>
              ))}
            </Select>
            <Select
              aria-label="Project status"
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(0);
              }}
            >
              <SelectItem value="">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </Select>
          </div>
          {summary.data && (
            <div className="project-overhead">
              <strong>
                {money(summary.data.sharedExpenses, currency)} shared
                subscriptions
              </strong>
              <p>
                Only unassigned ChatGPT and Claude subscriptions. Use the
                provider name and “subscription” or “plan” in the expense
                description so they are recognised. All recorded history ·{' '}
                {currency}.
              </p>
              <p>
                <strong>
                  {money(summary.data.unassignedExpenses ?? '0.00', currency)}{' '}
                  other unassigned expenses
                </strong>{' '}
                · Link these to a project when they are direct costs. All
                expenses remain included once in business totals.
              </p>
            </div>
          )}
          {summary.isError && (
            <p role="alert">
              Could not load shared expenses.{' '}
              <button onClick={() => void summary.refetch()}>Retry</button>
            </p>
          )}
          {list.isPending ? (
            <p role="status">Loading projects…</p>
          ) : list.isError ? (
            <p role="alert">
              {errorText(list.error)}{' '}
              <button onClick={() => void list.refetch()}>Retry</button>
            </p>
          ) : (
            <>
              <div className="project-table-wrap">
                <table className="project-table">
                  <thead>
                    <tr>
                      <th>Project / customer</th>
                      <th>Agreed value</th>
                      <th>Direct costs</th>
                      <th>Margin before overhead</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.content.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.name}</strong>
                          <small>{item.customerName}</small>
                        </td>
                        <td>{money(item.agreedValue, item.currency)}</td>
                        <td>{money(item.directCosts, item.currency)}</td>
                        <td>{money(item.margin, item.currency)}</td>
                        <td>{item.status.toLowerCase()}</td>
                        <td>
                          <Button
                            variant="outline"
                            onClick={() => setParams({ project: item.id })}
                            aria-label={`View ${item.name}`}
                          >
                            View project
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!list.data.content.length && (
                      <tr>
                        <td colSpan={6}>
                          No matching projects. Create a project to track its
                          direct costs.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <BillingPager
                page={page}
                data={list.data.totalElements ? list.data : undefined}
                onPage={setPage}
              />
            </>
          )}
        </>
      ) : detail.isPending ? (
        <p role="status">Loading project…</p>
      ) : detail.isError ? (
        <p role="alert">
          {errorText(detail.error)}{' '}
          <button onClick={() => void detail.refetch()}>Retry</button>
        </p>
      ) : (
        project && (
          <>
            <p className="muted">
              {project.customerName} · {project.status.toLowerCase()} ·{' '}
              {project.currency}
            </p>
            <div className="project-metrics">
              {[
                ['Agreed project value', project.agreedValue],
                ['Actual direct costs', project.directCosts],
                ['Margin before overhead', project.margin],
                ['Cost budget', project.costBudget],
                ['Budget remaining', project.budgetRemaining],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>
                    {value == null ? 'Not set' : money(value, project.currency)}
                  </strong>
                </div>
              ))}
            </div>
            <p className="project-explanation">
              Margin = agreed project value − direct costs. This is before
              shared overhead and your own time; agreed value is not proof of
              payment or collected revenue. Business totals are unchanged by
              cost allocation.
            </p>
            {project.notes && <p className="project-notes">{project.notes}</p>}
            <ProjectCosts project={project} />
          </>
        )
      )}
      {editing !== undefined && (
        <ProjectForm
          project={editing}
          currency={currency}
          onClose={() => setEditing(undefined)}
          onSaved={saved}
        />
      )}
    </main>
  );
}
function ProjectForm({
  project,
  currency,
  onClose,
  onSaved,
}: {
  project: Project | null;
  currency: string;
  onClose: () => void;
  onSaved: (project: Project) => Promise<void>;
}) {
  const [input, setInput] = useState<ProjectInput>(() =>
    project
      ? { ...project }
      : {
          customerId: '',
          name: '',
          currency,
          agreedValue: '',
          costBudget: null,
          status: 'ACTIVE',
          notes: '',
          version: 0,
        },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) =>
    setInput((previous) => ({ ...previous, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSaved(
        project
          ? await api.projects.update(project.id, input)
          : await api.projects.create(input),
      );
    } catch (error) {
      setError(errorText(error));
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
          {project ? 'Edit project' : 'New project'}
        </DialogTitle>
        <DialogDescription className="muted">
          Set the agreed price and track costs bought specifically for this
          project.
        </DialogDescription>
        <form className="project-form" onSubmit={submit}>
          <fieldset disabled={busy}>
            <BillingCustomerSelect
              value={input.customerId}
              onChange={(value) => set('customerId', value)}
            />
            <label>
              Project name
              <input
                required
                maxLength={300}
                value={input.name}
                onChange={(event) => set('name', event.target.value)}
              />
            </label>
            <label>
              Currency
              <Select
                aria-label="Project form currency"
                value={input.currency}
                disabled={!!project?.costCount}
                onValueChange={(value) => set('currency', value)}
              >
                {currencies.map((value) => (
                  <SelectItem key={value}>{value}</SelectItem>
                ))}
              </Select>
            </label>
            <label>
              Agreed project value
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={input.agreedValue}
                onChange={(event) => set('agreedValue', event.target.value)}
              />
            </label>
            <label>
              Direct cost budget (optional)
              <input
                type="number"
                min="0"
                step="0.01"
                value={input.costBudget ?? ''}
                onChange={(event) =>
                  set('costBudget', event.target.value || null)
                }
              />
            </label>
            <label>
              Status
              <Select
                aria-label="Project form status"
                value={input.status}
                onValueChange={(value) =>
                  set('status', value as ProjectInput['status'])
                }
              >
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </Select>
            </label>
            <label>
              Notes
              <textarea
                maxLength={4000}
                value={input.notes ?? ''}
                onChange={(event) => set('notes', event.target.value)}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="project-actions">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={busy}>
                {busy ? 'Saving…' : 'Save project'}
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function ProjectCosts({ project }: { project: Project }) {
  const [available, setAvailable] = useState(false),
    [page, setPage] = useState(0),
    [search, setSearch] = useState(''),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  const q = useDebouncedValue(search);
  const params = new URLSearchParams({
    available: String(available),
    page: String(page),
    size: '20',
    q,
  });
  const query = useQuery({
    queryKey: ['projects', 'costs', project.id, params.toString()],
    queryFn: () => api.projects.costs(project.id, params),
  });
  const cache = useQueryClient();
  async function change(id: string) {
    setBusy(id);
    setError('');
    try {
      await (available
        ? api.projects.assign(project.id, id)
        : api.projects.unassign(project.id, id));
      await cache.invalidateQueries({ queryKey: ['projects'] });
      setPage(0);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy('');
    }
  }
  return (
    <section className="project-costs" aria-label="Project direct costs">
      <div className="project-cost-heading">
        <div>
          <h2>Direct costs</h2>
          <p className="muted">
            Link existing expenses. Leave ChatGPT and Claude subscriptions under
            shared overhead.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setAvailable(!available);
            setPage(0);
            setSearch('');
          }}
        >
          {available ? 'View linked costs' : 'Link an existing expense'}
        </Button>
      </div>
      <input
        className="project-cost-search"
        aria-label="Search project costs"
        maxLength={200}
        placeholder={
          available ? 'Search unassigned expenses…' : 'Search linked costs…'
        }
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(0);
        }}
      />
      {available && (
        <p className="muted">
          Only unassigned expenses in {project.currency} are shown. Linking one
          makes it a direct project cost without recording another expense.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {query.isPending ? (
        <p role="status">Loading expenses…</p>
      ) : query.isError ? (
        <p role="alert">
          {errorText(query.error)}{' '}
          <button onClick={() => void query.refetch()}>Retry</button>
        </p>
      ) : (
        <>
          <div className="project-table-wrap">
            <table className="project-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Expense</th>
                  <th>Category</th>
                  <th>Cost</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {query.data.content.map((cost) => (
                  <tr key={cost.id}>
                    <td>{cost.date}</td>
                    <td>{cost.description}</td>
                    <td>{cost.category}</td>
                    <td>{money(cost.amount, cost.currency)}</td>
                    <td>
                      <Button
                        variant="outline"
                        disabled={
                          !!busy || (available && project.status === 'ARCHIVED')
                        }
                        onClick={() => void change(cost.id)}
                      >
                        {busy === cost.id
                          ? 'Saving…'
                          : available
                            ? 'Add to project'
                            : 'Unlink cost'}
                      </Button>
                    </td>
                  </tr>
                ))}
                {!query.data.content.length && (
                  <tr>
                    <td colSpan={5}>
                      {available
                        ? 'No matching unassigned expenses. Record the expense on the Expenses page first.'
                        : 'No direct costs linked yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <BillingPager
            data={query.data.totalElements ? query.data : undefined}
            page={page}
            onPage={setPage}
          />
        </>
      )}
    </section>
  );
}
