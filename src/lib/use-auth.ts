import { useEffect, useState } from 'react';
import type { Session as ProviderSession } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Session } from './api';
import { authClient, supabase } from './supabase';

export function useAuth() {
  const cache = useQueryClient();
  const [provider, setProvider] = useState<ProviderSession | null>();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [recovering, setRecovering] = useState(
    () => window.location.pathname === '/auth/reset',
  );

  useEffect(() => {
    if (!supabase) {
      setError(
        new Error(
          'Sign-in is not configured. Set the Supabase Auth URL and publishable key.',
        ),
      );
      setLoading(false);
      return;
    }
    let active = true;
    let receivedAuthEvent = false;
    // Keep SDK callbacks synchronous; loading the API profile happens in a separate effect.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, value) => {
      if (!active) return;
      receivedAuthEvent = true;
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setProvider(value);
    });
    void supabase.auth
      .getSession()
      .then(({ data, error: authError }) => {
        if (!active || receivedAuthEvent) return;
        if (authError) setError(authError);
        setProvider(data.session);
      })
      .catch((cause: unknown) => {
        if (active && !receivedAuthEvent) {
          setError(cause);
          setProvider(null);
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (provider === undefined) return;
    let active = true;
    setSession(null);
    cache.clear();
    if (!provider) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void api
      .me()
      .then((user) => {
        if (active) setSession({ user });
      })
      .catch((cause: unknown) => {
        if (active) setError(cause);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [provider?.access_token, provider === undefined, retryKey, cache]);

  async function logout() {
    // Clear private state immediately, even if provider revocation fails.
    setSession(null);
    setProvider(null);
    cache.clear();
    const { error: authError } = await authClient().auth.signOut({
      scope: 'local',
    });
    if (authError) setError(authError);
  }
  useEffect(() => {
    const expire = () => {
      void logout();
    };
    window.addEventListener('session-expired', expire);
    return () => window.removeEventListener('session-expired', expire);
  }, []);

  function finishRecovery() {
    setRecovering(false);
    window.history.replaceState({}, '', '/');
  }
  return {
    session,
    loading,
    error,
    recovering,
    logout,
    retry: () => setRetryKey((value) => value + 1),
    finishRecovery,
    hasProviderSession: Boolean(provider),
  };
}
