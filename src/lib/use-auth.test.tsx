// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from './use-auth';

const mock = vi.hoisted(() => ({
  listener: null as null | ((event: string, session: unknown) => void),
  getSession: vi.fn(),
  signOut: vi.fn(),
  me: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock('./supabase', () => {
  const client = {
    auth: {
      getSession: mock.getSession,
      signOut: mock.signOut,
      onAuthStateChange: (listener: typeof mock.listener) => {
        mock.listener = listener;
        return { data: { subscription: { unsubscribe: mock.unsubscribe } } };
      },
    },
  };
  return { supabase: client, authClient: () => client };
});
vi.mock('./api', () => ({ api: { me: mock.me } }));

const profile = {
  id: 'shared-user-a',
  email: 'a@example.test',
  role: null,
  customers: [],
};
const provider = (access_token: string) => ({
  access_token,
  user: { id: profile.id },
});
function mount() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cache}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => useAuth(), { wrapper }), cache };
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.getSession.mockResolvedValue({
    data: { session: provider('initial') },
    error: null,
  });
  mock.me.mockResolvedValue(profile);
  mock.signOut.mockResolvedValue({ error: null });
  window.history.replaceState({}, '', '/');
});
afterEach(cleanup);

describe('shared authentication', () => {
  it('loads the backend profile without granting customers a staff role', async () => {
    const { result } = mount();
    await waitFor(() =>
      expect(result.current.session?.user.id).toBe(profile.id),
    );
    expect(result.current.session?.user.role).toBeNull();
    expect(result.current.loading).toBe(false);
  });
  it('accepts SDK token refresh and reloads the current permissions', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.session).not.toBeNull());
    mock.me.mockResolvedValue({ ...profile, role: 'FINANCE' });
    act(() => mock.listener?.('TOKEN_REFRESHED', provider('refreshed')));
    await waitFor(() =>
      expect(result.current.session?.user.role).toBe('FINANCE'),
    );
    expect(mock.me).toHaveBeenCalledTimes(2);
    expect(mock.signOut).not.toHaveBeenCalled();
  });
  it('ignores an old profile response after the signed-in identity changes', async () => {
    let resolveOld!: (value: typeof profile) => void;
    mock.me.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    const { result, cache } = mount();
    await waitFor(() => expect(mock.me).toHaveBeenCalledTimes(1));
    cache.setQueryData(['private-old-data'], { secret: true });
    mock.me.mockResolvedValue({ ...profile, id: 'shared-user-b' });
    act(() => mock.listener?.('SIGNED_IN', provider('different-account')));
    await waitFor(() =>
      expect(result.current.session?.user.id).toBe('shared-user-b'),
    );
    await act(async () => resolveOld(profile));
    expect(result.current.session?.user.id).toBe('shared-user-b');
    expect(cache.getQueryData(['private-old-data'])).toBeUndefined();
  });
  it('clears private state and cache on sign-out', async () => {
    const { result, cache } = mount();
    await waitFor(() => expect(result.current.session).not.toBeNull());
    cache.setQueryData(['private'], 'invoice');
    await act(async () => result.current.logout());
    expect(result.current.session).toBeNull();
    expect(cache.getQueryData(['private'])).toBeUndefined();
    expect(mock.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
  it('does not overwrite a new sign-in with a late restored session', async () => {
    let restore!: (value: unknown) => void;
    mock.getSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          restore = resolve;
        }),
    );
    const { result } = mount();
    mock.me.mockResolvedValue({ ...profile, id: 'new-account' });
    act(() => mock.listener?.('SIGNED_IN', provider('new-token')));
    await waitFor(() =>
      expect(result.current.session?.user.id).toBe('new-account'),
    );
    await act(async () =>
      restore({
        data: { session: provider('old-restored-token') },
        error: null,
      }),
    );
    expect(result.current.session?.user.id).toBe('new-account');
    expect(mock.me).toHaveBeenCalledTimes(1);
  });
  it('allows retry after an API outage without discarding a valid Auth session', async () => {
    mock.me.mockRejectedValueOnce(new Error('Temporarily unavailable'));
    const { result } = mount();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.hasProviderSession).toBe(true);
    act(() => result.current.retry());
    await waitFor(() =>
      expect(result.current.session?.user.id).toBe(profile.id),
    );
  });
  it('recognizes password recovery separately from normal sign-in', async () => {
    const { result } = mount();
    act(() => mock.listener?.('PASSWORD_RECOVERY', provider('recovery')));
    await waitFor(() => expect(result.current.recovering).toBe(true));
    act(() => result.current.finishRecovery());
    expect(result.current.recovering).toBe(false);
  });
});
