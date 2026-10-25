import { Select, SelectItem } from './ui/select';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Profile } from '../lib/api';
import { Button } from './ui/button';

export function CustomerPortal({
  profile,
  logout,
}: {
  profile: Profile;
  logout: () => Promise<void>;
}) {
  const [customerId, setCustomerId] = useState(profile.customers[0]?.id ?? '');
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ['portal-invoices', profile.id, customerId, page],
    queryFn: () =>
      api.portalInvoices(
        customerId,
        new URLSearchParams({ page: String(page), size: '20' }),
      ),
    enabled: Boolean(customerId),
    retry: false,
  });
  return (
    <main className="page">
      <div className="flex justify-between items-center gap-4 mb-8">
        <div>
          <p className="eyebrow">STAPLE CUSTOMER PORTAL</p>
          <h1>Your account</h1>
          <p className="muted">{profile.email}</p>
        </div>
        <Button variant="outline" onClick={() => void logout()}>
          Sign out
        </Button>
      </div>
      {!profile.customers.length ? (
        <div className="notice">
          <h2>Your Staple account is connected</h2>
          <p>
            No business has been linked to this account yet. Share your account
            ID with the Staple team to request access.
          </p>
          <p className="mt-3">
            Account ID: <code>{profile.id}</code>
          </p>
        </div>
      ) : (
        <>
          <label className="mb-6">
            Business
            <Select
              aria-label="Business"
              value={customerId}
              onValueChange={(nextValue) => {
                setCustomerId(nextValue);
                setPage(0);
              }}
            >
              {profile.customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.businessName}
                </SelectItem>
              ))}
            </Select>
          </label>
          <h2 className="mb-4">Invoices</h2>
          {query.isLoading && <p role="status">Loading invoices…</p>}
          {query.error && (
            <div role="alert" className="error">
              {query.error.message}
              <Button variant="ghost" onClick={() => void query.refetch()}>
                Try again
              </Button>
            </div>
          )}
          {query.data && (
            <>
              {!query.data.content.length ? (
                <p className="notice">No invoices to display.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Issued</th>
                        <th>Due</th>
                        <th>Status</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {query.data.content.map((invoice) => (
                        <tr key={invoice.id}>
                          <td>{invoice.number}</td>
                          <td>{invoice.issueDate}</td>
                          <td>{invoice.dueDate}</td>
                          <td>{invoice.status}</td>
                          <td>
                            {new Intl.NumberFormat('en-MY', {
                              style: 'currency',
                              currency: invoice.currency,
                            }).format(Number(invoice.total))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex items-center gap-4 mt-4">
                <Button
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span>
                  Page {page + 1} of {Math.max(1, query.data.totalPages)}
                </span>
                <Button
                  variant="outline"
                  disabled={page + 1 >= query.data.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
