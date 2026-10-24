import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_AUTH_URL;
const key = import.meta.env.VITE_SUPABASE_AUTH_PUBLISHABLE_KEY;

// This client is for authentication only. Business data goes through Spring Boot.
export const supabase =
  url && key && !key.startsWith('sb_secret_')
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
          storageKey: 'staple-os-auth',
          flowType: 'pkce',
        },
      })
    : null;

export function authClient() {
  if (!supabase)
    throw new Error(
      'Sign-in is not configured. Set the Supabase Auth URL and publishable key.',
    );
  return supabase;
}
