import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function PaymentLink({ token }: { token: string }) {
  const valid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      token,
    );
  const query = useQuery({
    queryKey: ['payment-link', token],
    queryFn: () => api.billing.paymentLink(token),
    enabled: valid,
    retry: false,
    staleTime: 0,
  });
  const url = query.data?.status === 'READY' ? query.data.url : null;
  let safeUrl: string | null = null;
  try {
    if (url) {
      const parsed = new URL(url);
      if (
        parsed.protocol === 'https:' &&
        parsed.hostname === 'checkout.stripe.com' &&
        !parsed.username &&
        !parsed.password
      )
        safeUrl = url;
    }
  } catch {
    /* Invalid destinations must never redirect. */
  }
  useEffect(() => {
    if (safeUrl) window.location.replace(safeUrl);
  }, [safeUrl]);
  const completed = query.data?.status === 'COMPLETED';
  const loading = valid && query.isPending;
  return (
    <main className="billing-return">
      <section className="card">
        <h1>
          {loading || safeUrl
            ? 'Opening secure checkout'
            : completed
              ? 'Checkout already completed'
              : 'Payment link unavailable'}
        </h1>
        <p role="status">
          {loading || safeUrl
            ? 'Taking you to Stripe to complete your payment.'
            : completed
              ? 'This checkout has already been completed. Contact your service provider if you need payment confirmation.'
              : query.isError
                ? 'We could not load your payment link. Please retry or contact your service provider.'
                : 'This link may have expired or been cancelled. Please ask your service provider for a new payment link.'}
        </p>
        {safeUrl && (
          <a href={safeUrl} rel="noreferrer">
            Continue to Stripe
          </a>
        )}
        {query.isError && (
          <button onClick={() => void query.refetch()}>Try again</button>
        )}
        <p>No Staple OS account is required.</p>
      </section>
    </main>
  );
}
