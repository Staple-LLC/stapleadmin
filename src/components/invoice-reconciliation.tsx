import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Link2, Unlink } from 'lucide-react';
import { api } from '../lib/api';
import type { IncomeCandidate } from '../lib/api';
import { refreshFinancialRecords } from '../lib/financial-records';
import { Button } from './ui/button';
import './invoice-reconciliation.css';

function cents(value: string): bigint | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The invoice could not be updated.';

export function InvoiceReconciliationPanel({
  invoiceId,
}: {
  invoiceId: string;
}) {
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<IncomeCandidate | null>(null);
  const [amount, setAmount] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const query = useQuery({
    queryKey: ['invoice-reconciliation', invoiceId, search, page],
    queryFn: () =>
      api.invoiceReconciliation(
        invoiceId,
        new URLSearchParams({
          q: search,
          page: String(page),
          size: '10',
        }),
      ),
  });
  const data = query.data;
  const money = (value: string) =>
    new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: data?.currency ?? 'MYR',
    }).format(Number(value));

  function choose(candidate: IncomeCandidate) {
    if (!data) return;
    setSelected(candidate);
    setAmount(
      (cents(candidate.available) ?? 0n) < (cents(data.outstanding) ?? 0n)
        ? candidate.available
        : data.outstanding,
    );
    setError('');
    setNotice('');
  }
  async function match(event: FormEvent) {
    event.preventDefault();
    if (!selected || !data || busy) return;
    const value = cents(amount);
    if (
      value === null ||
      value <= 0n ||
      value > (cents(selected.available) ?? 0n) ||
      value > (cents(data.outstanding) ?? 0n)
    ) {
      setError(
        'Enter a positive amount within the available income and invoice balance, using at most two decimal places.',
      );
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.matchInvoiceIncome(invoiceId, {
        financialEntryId: selected.id,
        amount,
      });
      setSelected(null);
      setPickerOpen(false);
      await refreshFinancialRecords(cache);
      setNotice(
        'Income linked. The invoice balance is updated; collected sales have not increased.',
      );
    } catch (cause) {
      setError(errorMessage(cause));
      await query.refetch();
    } finally {
      setBusy(false);
    }
  }
  async function unmatch() {
    if (!removing || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.unmatchInvoiceIncome(invoiceId, removing);
      setRemoving(null);
      await refreshFinancialRecords(cache);
      setNotice(
        'Link removed. The recorded income remains, and the invoice balance has been recalculated.',
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="invoice-reconciliation"
      aria-label="Invoice payments and recorded income"
    >
      <div className="reconciliation-heading">
        <h3>Payments & recorded income</h3>
        {data && (cents(data.outstanding) ?? 0n) > 0n && (
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              setPickerOpen(true);
              setError('');
              setNotice('');
              requestAnimationFrame(() => searchInput.current?.focus());
            }}
          >
            Mark as paid
          </Button>
        )}
      </div>
      {data && (cents(data.outstanding) ?? 0n) > 0n && (
        <p>
          Already paid in the past? Choose <strong>Mark as paid</strong> and
          link the original income record. A full payment clears the outstanding
          balance without adding revenue again.
        </p>
      )}
      {query.isPending ? (
        <p role="status">Loading invoice balance…</p>
      ) : query.isError ? (
        <div role="alert">
          <p>{query.error.message}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry invoice balance
          </Button>
        </div>
      ) : (
        data && (
          <>
            <dl className="reconciliation-balances">
              <div>
                <dt>Recorded as paid</dt>
                <dd>{money(data.paid)}</dd>
              </div>
              <div>
                <dt>Still outstanding</dt>
                <dd>{money(data.outstanding)}</dd>
              </div>
            </dl>
            {data.matches.length > 0 && (
              <div className="reconciliation-matches">
                <h4>Linked income</h4>
                {data.matches.map((item) => (
                  <div className="reconciliation-row" key={item.id}>
                    <div>
                      <strong>{item.description}</strong>
                      <span>
                        {item.date} · {money(item.amount)}
                        {item.reference ? ` · ${item.reference}` : ''}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setRemoving(item.id);
                        setNotice('');
                        setError('');
                      }}
                      aria-label={`Remove link to ${item.description}`}
                    >
                      <Unlink size={14} />
                      Remove link
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {removing && (
              <div
                className="reconciliation-confirm"
                role="group"
                aria-label="Confirm removal of income link"
              >
                <p>
                  Remove this link? The income stays in Financial records. This
                  invoice’s unpaid balance will increase.
                </p>
                <div className="reconciliation-actions">
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={() => setRemoving(null)}
                  >
                    Keep link
                  </Button>
                  <Button disabled={busy} onClick={() => void unmatch()}>
                    {busy ? 'Removing…' : 'Confirm remove link'}
                  </Button>
                </div>
              </div>
            )}
            {(cents(data.outstanding) ?? 0n) > 0n && (
              <details
                className="reconciliation-picker"
                open={pickerOpen}
                onToggle={(event) => setPickerOpen(event.currentTarget.open)}
              >
                <summary>Link recorded income</summary>
                <p>
                  Already paid? Select the receipt already in Financial records.
                  Linking changes this invoice’s balance and keeps the original
                  receipt date. It adds no new income.
                </p>
                <label>
                  Search recorded income
                  <input
                    ref={searchInput}
                    value={search}
                    maxLength={200}
                    placeholder="Customer, description or reference…"
                    disabled={busy}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                      setSelected(null);
                    }}
                  />
                </label>
                {data.candidates.length ? (
                  <div className="reconciliation-candidates">
                    {data.candidates.map((candidate) => (
                      <div className="reconciliation-row" key={candidate.id}>
                        <div>
                          <strong>{candidate.description}</strong>
                          <span>
                            {candidate.date}
                            {candidate.reference
                              ? ` · ${candidate.reference}`
                              : ''}
                          </span>
                          <span>
                            {money(candidate.available)} available of{' '}
                            {money(candidate.amount)}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          aria-pressed={selected?.id === candidate.id}
                          onClick={() => choose(candidate)}
                        >
                          Select income
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    No available income matches this search in {data.currency}.
                  </p>
                )}
                <div className="reconciliation-pagination">
                  <span>{data.candidateTotal} available receipts</span>
                  <div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Previous income page"
                      disabled={busy || page === 0}
                      onClick={() => {
                        setPage(page - 1);
                        setSelected(null);
                      }}
                    >
                      <ChevronLeft size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Next income page"
                      disabled={
                        busy || (page + 1) * data.size >= data.candidateTotal
                      }
                      onClick={() => {
                        setPage(page + 1);
                        setSelected(null);
                      }}
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
                {selected && (
                  <form
                    className="reconciliation-confirm"
                    onSubmit={(event) => void match(event)}
                  >
                    <h4>Confirm income link</h4>
                    <p>
                      {selected.description} · {selected.date}
                    </p>
                    <label>
                      Amount to apply ({data.currency})
                      <input
                        required
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={busy}
                      />
                    </label>
                    <p className="muted">
                      This amount will be applied to this invoice. Total
                      collected sales stay unchanged.
                    </p>
                    <div className="reconciliation-actions">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setSelected(null)}
                      >
                        Cancel link
                      </Button>
                      <Button type="submit" disabled={busy}>
                        <Link2 size={15} />
                        {busy ? 'Linking…' : 'Confirm link'}
                      </Button>
                    </div>
                  </form>
                )}
                <p className="reconciliation-help">
                  If the payment is missing,{' '}
                  <Link to="/financial-records">
                    add an income record in Financial records
                  </Link>{' '}
                  using the date you received it, then return here to link it.
                </p>
              </details>
            )}
          </>
        )
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="reconciliation-notice">
          {notice}
        </p>
      )}
    </section>
  );
}
