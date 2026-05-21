import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let client: SupabaseClient | null = null;

/** Supabase client; only use when `isSupabaseConfigured` is true. */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase env vars missing: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  }
  if (!client) {
    client = createClient(supabaseUrl!, supabaseAnonKey!);
  }
  return client;
}

/** @deprecated Use getSupabase() inside `isSupabaseConfigured` branches. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const real = getSupabase();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});
