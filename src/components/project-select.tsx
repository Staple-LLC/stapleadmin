import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useDebouncedValue } from '../lib/use-debounced-value';
import { Select, SelectItem } from './ui/select';
import { Button } from './ui/button';

export function ProjectSelect({
  currency,
  value,
  onChange,
}: {
  currency: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search);
  const query = useInfiniteQuery({
    queryKey: ['projects', 'options', currency, q],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.projects.list(
        new URLSearchParams({
          currency,
          q,
          page: String(pageParam),
          size: '20',
        }),
      ),
    getNextPageParam: (last: Awaited<ReturnType<typeof api.projects.list>>) =>
      last.page + 1 < last.totalPages ? last.page + 1 : undefined,
  });
  const rows = query.data?.pages.flatMap((page) => page.content) ?? [];
  return (
    <div className="col-span-full project-picker">
      <label>
        Find project (optional)
        <input
          value={search}
          maxLength={200}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search project or customer…"
        />
      </label>
      <label>
        Cost allocation
        <Select
          aria-label="Cost allocation"
          value={value}
          onValueChange={onChange}
          disabled={query.isPending || query.isError}
        >
          <SelectItem value="">No project (unassigned)</SelectItem>
          {value && !rows.some((project) => project.id === value) && (
            <SelectItem value={value}>Selected project</SelectItem>
          )}
          {rows.map((project) => (
            <SelectItem
              key={project.id}
              value={project.id}
              disabled={project.status === 'ARCHIVED'}
            >
              {project.name} · {project.customerName}
            </SelectItem>
          ))}
        </Select>
      </label>
      <small className="muted">
        Unassigned ChatGPT and Claude subscriptions count as shared expenses.
        Other costs remain unassigned until linked to a project.
      </small>
      {query.hasNextPage && (
        <Button
          type="button"
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Load more projects
        </Button>
      )}
      {query.isError && (
        <p role="alert">
          Could not load projects.{' '}
          <button type="button" onClick={() => void query.refetch()}>
            Retry
          </button>
        </p>
      )}
    </div>
  );
}
