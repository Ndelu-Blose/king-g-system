import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Keep this explicit so misconfiguration is easy to diagnose.
  console.warn('Supabase env vars missing: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// #region agent log
fetch('http://127.0.0.1:7625/ingest/426ed756-23b9-47e6-863b-620b6101b95c', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9e56b8' }, body: JSON.stringify({ sessionId: '9e56b8', runId: 'pre-fix', hypothesisId: 'H1', location: 'src/lib/supabase.ts:config', message: 'supabase env config check', data: { isSupabaseConfigured, supabaseUrlHost: supabaseUrl ? (() => { try { return new URL(supabaseUrl).host; } catch { return null; } })() : null, anonKeyLen: typeof supabaseAnonKey === 'string' ? supabaseAnonKey.length : 0 }, timestamp: Date.now() }) }).catch(() => {});
// #endregion
