import { useDebouncedValue } from '../lib/use-debounced-value';
import { Select, SelectItem } from './ui/select';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Globe, Plus, Search } from 'lucide-react';
import { api } from '../lib/api';
import type { BillingDomain, BillingDomainInput } from '../lib/api';
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
  billingParams,
} from './billing-common';
import './billing.css';
const renewalLabels: Record<BillingDomainInput['renewalStatus'], string> = {
  MANUAL: 'Manual renewal',
  AUTO_RENEW: 'Registrar auto-renew',
  DO_NOT_RENEW: 'Do not renew',
  RENEWAL_REQUIRED: 'Renewal required',
};
export function BillingDomains({
  websiteId,
  customerId,
}: {
  websiteId?: string;
  customerId?: string;
}) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [renewalStatus, setRenewalStatus] = useState('');
  const [editing, setEditing] = useState<BillingDomain | null | undefined>();
  const query = useQuery({
    queryKey: [
      'billing',
      'domains',
      websiteId,
      customerId,
      page,
      debouncedSearch,
      renewalStatus,
    ],
    queryFn: () =>
      api.billing.domains.list(
        billingParams(page, debouncedSearch, {
          ...(customerId ? { customerId } : {}),
          ...(websiteId ? { websiteId } : {}),
          ...(renewalStatus ? { renewalStatus } : {}),
          sort: 'expiresOn,asc',
        }),
      ),
  });
  return (
    <section className="billing-domain-section" aria-label="Managed domains">
      <div className="billing-section-heading">
        <div>
          <h2>Managed domains</h2>
          <p>
            Track registrar details and expiry dates separately from customer
            payments.
          </p>
        </div>
        <Button variant="outline" onClick={() => setEditing(null)}>
          <Plus size={16} />
          Add domain
        </Button>
      </div>
      <div className="billing-records">
        <div className="billing-toolbar">
          <label className="billing-search">
            <Search size={16} />
            <input
              aria-label="Search managed domains"
              placeholder="Search domain or registrar…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <Select
            aria-label="Domain renewal status"
            value={renewalStatus}
            onValueChange={(nextValue) => {
              setRenewalStatus(nextValue);
              setPage(0);
            }}
          >
            <SelectItem value="">All renewal statuses</SelectItem>
            {Object.entries(renewalLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </Select>
        </div>
        <BillingQueryState
          pending={query.isPending}
          error={query.error}
          retry={query.refetch}
          empty={!query.data?.content.length}
        >
          <Globe size={30} />
          <h3>No managed domains yet</h3>
          <p>
            Record a domain’s expiry date, then add its annual renewal service
            in Billing.
          </p>
        </BillingQueryState>
        {query.data && query.data.content.length > 0 && (
          <div className="billing-table-scroll">
            <table className="billing-table">
              <thead>
                <tr>
                  <th>Domain & customer</th>
                  <th>Registrar</th>
                  <th>Expiry date</th>
                  <th>Renewal</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {query.data.content.map((domain) => (
                  <tr key={domain.id}>
                    <td>
                      <strong>{domain.name}</strong>
                      <span>{domain.customerName}</span>
                    </td>
                    <td>{domain.registrar || 'Not recorded'}</td>
                    <td>{billingDate(domain.expiresOn)}</td>
                    <td>
                      <span
                        className={`billing-status billing-status-${domain.renewalStatus.toLowerCase()}`}
                      >
                        {renewalLabels[domain.renewalStatus]}
                      </span>
                    </td>
                    <td>
                      <div
                        className="billing-service-actions"
                        style={{ marginTop: 0 }}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Edit ${domain.name}`}
                          onClick={() => setEditing(domain)}
                        >
                          Edit
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <Link
                            to={`/billing?tab=services&customerId=${encodeURIComponent(domain.customerId)}`}
                          >
                            Billing
                          </Link>
                        </Button>
                      </div>
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
        These are tracking records. Changes here do not buy a domain, change
        registrar settings or confirm a renewal.
      </p>
      {editing !== undefined && (
        <DomainEditor
          domain={editing}
          customerId={customerId}
          websiteId={websiteId}
          onClose={() => setEditing(undefined)}
        />
      )}
    </section>
  );
}
function DomainEditor({
  domain,
  customerId,
  websiteId,
  onClose,
}: {
  domain: BillingDomain | null;
  customerId?: string;
  websiteId?: string;
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const [input, setInput] = useState<BillingDomainInput>(() =>
    domain
      ? {
          customerId: domain.customerId,
          websiteId: domain.websiteId ?? null,
          name: domain.name,
          registrar: domain.registrar,
          expiresOn: domain.expiresOn,
          renewalStatus: domain.renewalStatus,
          notes: domain.notes,
          version: domain.version,
        }
      : {
          customerId: customerId ?? '',
          websiteId: websiteId ?? null,
          name: '',
          registrar: '',
          expiresOn: '',
          renewalStatus: 'MANUAL',
          notes: '',
        },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function change<K extends keyof BillingDomainInput>(
    key: K,
    value: BillingDomainInput[K],
  ) {
    setInput((previous) => ({ ...previous, [key]: value }));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (domain) await api.billing.domains.update(domain.id, input);
      else await api.billing.domains.create(input);
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
          {domain ? 'Edit managed domain' : 'Add managed domain'}
        </DialogTitle>
        <DialogDescription className="billing-dialog-description">
          Use the actual registrar expiry date. Billing does not renew the
          domain automatically.
        </DialogDescription>
        <form className="billing-form" onSubmit={(event) => void save(event)}>
          <fieldset disabled={busy}>
            <BillingCustomerSelect
              value={input.customerId}
              disabled={Boolean(customerId || websiteId)}
              onChange={(value) => change('customerId', value)}
            />
            <label>
              Domain name
              <input
                required
                maxLength={253}
                placeholder="example.com"
                autoCapitalize="none"
                value={input.name}
                onChange={(event) =>
                  change('name', event.target.value.toLowerCase())
                }
              />
            </label>
            <div className="form-grid">
              <label>
                Registrar
                <input
                  maxLength={100}
                  placeholder="e.g. Porkbun"
                  value={input.registrar ?? ''}
                  onChange={(event) => change('registrar', event.target.value)}
                />
              </label>
              <label>
                Expiry date
                <input
                  required
                  type="date"
                  value={input.expiresOn}
                  onChange={(event) => change('expiresOn', event.target.value)}
                />
              </label>
            </div>
            <label>
              Renewal arrangement
              <Select
                aria-label="Renewal arrangement"
                value={input.renewalStatus}
                onValueChange={(nextValue) =>
                  change(
                    'renewalStatus',
                    nextValue as BillingDomainInput['renewalStatus'],
                  )
                }
              >
                {Object.entries(renewalLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </Select>
            </label>
            <label>
              Notes
              <textarea
                rows={3}
                maxLength={2000}
                value={input.notes ?? ''}
                onChange={(event) => change('notes', event.target.value)}
              />
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
            <Button disabled={busy}>{busy ? 'Saving…' : 'Save domain'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
