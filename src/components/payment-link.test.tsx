// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { PaymentLink } from './payment-link';
const resolve = vi.hoisted(() => vi.fn());
vi.mock('../lib/api', () => ({ api: { billing: { paymentLink: resolve } } }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function show(token = '12345678-1234-4234-8234-123456789012') {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <PaymentLink token={token} />
    </QueryClientProvider>,
  );
}
it('shows expired links without requiring login', async () => {
  resolve.mockResolvedValue({ status: 'EXPIRED', url: null });
  show();
  expect(await screen.findByText(/may have expired/)).toBeTruthy();
  expect(screen.getByText(/No Staple OS account/)).toBeTruthy();
});
it('does not claim a completed checkout was paid', async () => {
  resolve.mockResolvedValue({ status: 'COMPLETED', url: null });
  show();
  expect(await screen.findByText('Checkout already completed')).toBeTruthy();
});
it('rejects malformed tokens without calling the API', () => {
  show('invalid');
  expect(resolve).not.toHaveBeenCalled();
  expect(screen.getByText('Payment link unavailable')).toBeTruthy();
});
it('does not redirect to an unexpected destination', async () => {
  resolve.mockResolvedValue({
    status: 'READY',
    url: 'https://evil.example/pay',
  });
  show();
  expect(await screen.findByText('Payment link unavailable')).toBeTruthy();
  expect(screen.queryByText('Continue to Stripe')).toBeNull();
});
it('offers retry after a network failure', async () => {
  resolve.mockRejectedValue(new Error('network'));
  show();
  expect(await screen.findByText('Try again')).toBeTruthy();
});
