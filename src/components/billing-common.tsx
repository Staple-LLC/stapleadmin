import { useDebouncedValue } from '../lib/use-debounced-value';
import { Select, SelectItem } from './ui/select';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { Page } from '../lib/api';
import { Button } from './ui/button';

export const billingMoney = (value: string, currency: string) =>
  new Intl.NumberFormat('en-MY', { style: 'currency', currency }).format(
    Number(value),
  );
export const billingDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat('en-MY', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value))
    : 'Not scheduled';
export const billingError = (error: unknown) =>
  error instanceof ApiError && Object.keys(error.fields ?? {}).length
    ? Object.values(error.fields).join(' ')
    : error instanceof Error
      ? error.message
      : 'The request could not be completed.';
export const billingParams = (
  page = 0,
  search = '',
  extra: Record<string, string> = {},
) =>
  new URLSearchParams({ page: String(page), size: '20', q: search, ...extra });
export function BillingPager({
  data,
  page,
  onPage,
}: {
  data?: Page<unknown>;
  page: number;
  onPage: (page: number) => void;
}) {
  if (!data) return null;
  return (
    <div className="billing-pager">
      <span>
        {data.totalElements} {data.totalElements === 1 ? 'record' : 'records'}
      </span>
      <div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={17} />
        </Button>
        <span>
          {data.totalPages ? page + 1 : 0} / {data.totalPages}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next page"
          disabled={page + 1 >= data.totalPages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={17} />
        </Button>
      </div>
    </div>
  );
}
export function BillingQueryState({
  pending,
  error,
  retry,
  empty,
  children,
}: {
  pending: boolean;
  error: Error | null;
  retry: () => unknown;
  empty: boolean;
  children: ReactNode;
}) {
  if (pending)
    return (
      <p className="billing-empty" role="status">
        Loading billing records…
      </p>
    );
  if (error)
    return (
      <div className="billing-empty" role="alert">
        <p>{billingError(error)}</p>
        <Button variant="outline" onClick={() => void retry()}>
          Try again
        </Button>
      </div>
    );
  return empty ? <div className="billing-empty">{children}</div> : null;
}
export function BillingCustomerSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const customers = useInfiniteQuery({
    queryKey: ['billing', 'customer-options', debouncedSearch],
    initialPageParam: 0,
    getNextPageParam: (last: Awaited<ReturnType<typeof api.customers.list>>) =>
      last.page + 1 < last.totalPages ? last.page + 1 : undefined,
    queryFn: ({ pageParam }) =>
      api.customers.list(
        new URLSearchParams({
          q: debouncedSearch,
          page: String(pageParam),
          size: '20',
          sort: 'businessName,asc',
        }),
      ),
  });
  const selected = useQuery({
    queryKey: ['billing', 'customer', value],
    queryFn: () => api.customers.get(value),
    enabled: Boolean(value),
  });
  const rows = customers.data?.pages.flatMap((page) => page.content) ?? [];
  return (
    <div className="billing-customer-picker">
      <label>
        Find a customer
        <input
          value={search}
          disabled={disabled}
          placeholder="Search business name…"
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <label>
        Customer
        <Select
          aria-label="Customer"
          required
          disabled={disabled || customers.isPending}
          value={value}
          onValueChange={(nextValue) => onChange(nextValue)}
        >
          <SelectItem value="">Choose a customer</SelectItem>
          {selected.data &&
            !rows.some((row) => row.id === selected.data.id) && (
              <SelectItem value={selected.data.id}>
                {selected.data.businessName}
              </SelectItem>
            )}
          {rows.map((row) => (
            <SelectItem key={row.id} value={row.id}>
              {row.businessName}
            </SelectItem>
          ))}
        </Select>
      </label>
      {customers.error && (
        <p className="error" role="alert">
          {billingError(customers.error)}
        </p>
      )}
      {customers.hasNextPage && (
        <Button
          type="button"
          variant="outline"
          disabled={disabled || customers.isFetchingNextPage}
          onClick={() => void customers.fetchNextPage()}
        >
          {customers.isFetchingNextPage
            ? 'Loading customers…'
            : 'Load more customers'}
        </Button>
      )}
    </div>
  );
}
