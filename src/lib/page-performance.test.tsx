// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createQueryClient } from './query-client';
import { useDebouncedValue } from './use-debounced-value';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('reuses recent page data but fetches again after a saved change invalidates it', async () => {
  const client = createQueryClient();
  const fetchPage = vi.fn().mockResolvedValue({ totalElements: 6 });
  const options = { queryKey: ['customers'], queryFn: fetchPage };
  await client.fetchQuery(options);
  await client.fetchQuery(options);
  expect(fetchPage).toHaveBeenCalledTimes(1);
  await client.invalidateQueries({ queryKey: ['customers'] });
  await client.fetchQuery(options);
  expect(fetchPage).toHaveBeenCalledTimes(2);
  client.clear();
});

it('collapses rapid search input into the final server query value', () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(
    ({ value }) => useDebouncedValue(value),
    {
      initialProps: { value: '' },
    },
  );
  rerender({ value: 'h' });
  act(() => vi.advanceTimersByTime(100));
  rerender({ value: 'huat' });
  act(() => vi.advanceTimersByTime(249));
  expect(result.current).toBe('');
  act(() => vi.advanceTimersByTime(1));
  expect(result.current).toBe('huat');
});
