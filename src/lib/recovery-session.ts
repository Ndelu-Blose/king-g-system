import type { SupabaseClient } from '@supabase/supabase-js';

/** True when the user is on the password-reset route or URL still has recovery tokens. */
export function isPasswordRecoveryFlow(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.pathname === '/reset-password') return true;

  const hash = window.location.hash || '';
  if (hash.includes('type=recovery') || hash.includes('access_token')) return true;

  return Boolean(new URLSearchParams(window.location.search).get('code'));
}

function parseHashParams(): URLSearchParams {
  const raw = window.location.hash.replace(/^#/, '');
  return raw ? new URLSearchParams(raw) : new URLSearchParams();
}

/** Strip tokens from the address bar after a successful exchange. */
function cleanRecoveryUrl(): void {
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
}

/**
 * Exchange PKCE code or hash tokens from a Supabase email link into a client session.
 * Needed for production (especially mobile in-app browsers) where auto-detection can fail.
 */
export async function establishRecoverySession(supabase: SupabaseClient): Promise<boolean> {
  const code = new URLSearchParams(window.location.search).get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      cleanRecoveryUrl();
      return true;
    }
  }

  const hash = parseHashParams();
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (!error) {
      cleanRecoveryUrl();
      return true;
    }
  }

  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}
