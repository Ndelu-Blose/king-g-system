import type { Session, SupabaseClient } from '@supabase/supabase-js';

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

function debugLog(location: string, message: string, data: Record<string, unknown>, hypothesisId: string) {
  // #region agent log
  const payload = {
    sessionId: 'cbab8b',
    runId: 'post-fix',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  try {
    const prev = JSON.parse(sessionStorage.getItem('dbg_cbab8b') || '[]');
    prev.push(payload);
    sessionStorage.setItem('dbg_cbab8b', JSON.stringify(prev.slice(-30)));
  } catch {
    /* ignore */
  }
  fetch('http://127.0.0.1:7353/ingest/efb20fee-084f-4ea9-9b4d-77b55a4189a3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'cbab8b' },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
}

/**
 * Wait for detectSessionInUrl / auth init to surface a session before we touch hash tokens.
 * Manual setSession on the same one-time tokens can race and leave the recovery session dead.
 */
function waitForAuthSession(supabase: SupabaseClient, timeoutMs: number): Promise<Session | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (session: Session | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription.unsubscribe();
      resolve(session);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      if (
        event === 'INITIAL_SESSION' ||
        event === 'PASSWORD_RECOVERY' ||
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED'
      ) {
        finish(session);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish(data.session);
    });

    const timer = window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data }) => finish(data.session ?? null));
    }, timeoutMs);
  });
}

/**
 * Exchange PKCE code or hash tokens from a Supabase email link into a client session.
 * Needed for production (especially mobile in-app browsers) where auto-detection can fail.
 */
export async function establishRecoverySession(supabase: SupabaseClient): Promise<boolean> {
  const hashLen = typeof window !== 'undefined' ? window.location.hash.length : 0;
  const hasCode = Boolean(
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('code'),
  );
  debugLog(
    'recovery-session.ts:establishRecoverySession',
    'establish start',
    { hashLen, hasCode, path: typeof window !== 'undefined' ? window.location.pathname : null },
    'K',
  );

  // Prefer auto-detect — do not race setSession against detectSessionInUrl.
  const detected = await waitForAuthSession(supabase, 2500);
  if (detected) {
    debugLog(
      'recovery-session.ts:establishRecoverySession',
      'session from auth init/detect',
      { hasUser: Boolean(detected.user), email: detected.user?.email ?? null },
      'K',
    );
    if (
      typeof window !== 'undefined' &&
      (window.location.hash || new URLSearchParams(window.location.search).get('code'))
    ) {
      cleanRecoveryUrl();
    }
    return true;
  }

  const code = new URLSearchParams(window.location.search).get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    debugLog(
      'recovery-session.ts:exchangeCode',
      'code exchange result',
      { ok: !error, error: error?.message || null },
      'H',
    );
    if (!error) {
      cleanRecoveryUrl();
      return true;
    }
  }

  const hash = parseHashParams();
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    debugLog(
      'recovery-session.ts:setSession',
      'hash setSession result',
      {
        ok: !error && Boolean(data.session),
        error: error?.message || null,
        hashType: hash.get('type'),
        refreshLen: refreshToken.length,
      },
      'H',
    );
    if (!error && data.session) {
      cleanRecoveryUrl();
      return true;
    }
  }

  const { data } = await supabase.auth.getSession();
  debugLog(
    'recovery-session.ts:final',
    'final session check',
    { hasSession: Boolean(data.session) },
    'K',
  );
  return Boolean(data.session);
}
