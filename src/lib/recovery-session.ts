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
  // #region agent log
  const hashLen = (typeof window !== 'undefined' ? window.location.hash : '').length;
  const hasCode = Boolean(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('code'));
  fetch('http://127.0.0.1:7353/ingest/efb20fee-084f-4ea9-9b4d-77b55a4189a3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cbab8b'},body:JSON.stringify({sessionId:'cbab8b',runId:'post-fix',hypothesisId:'G',location:'recovery-session.ts:establishRecoverySession',message:'establish start',data:{hashLen,hasCode,path:typeof window!=='undefined'?window.location.pathname:null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  // Let detectSessionInUrl finish before we read/clear the hash (avoids Strict Mode races).
  const existing = await supabase.auth.getSession();
  if (existing.data.session) {
    // #region agent log
    fetch('http://127.0.0.1:7353/ingest/efb20fee-084f-4ea9-9b4d-77b55a4189a3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cbab8b'},body:JSON.stringify({sessionId:'cbab8b',runId:'post-fix',hypothesisId:'G',location:'recovery-session.ts:establishRecoverySession',message:'existing session found',data:{hasUser:Boolean(existing.data.session.user)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (typeof window !== 'undefined' && (window.location.hash || new URLSearchParams(window.location.search).get('code'))) {
      cleanRecoveryUrl();
    }
    return true;
  }

  const code = new URLSearchParams(window.location.search).get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // #region agent log
    fetch('http://127.0.0.1:7353/ingest/efb20fee-084f-4ea9-9b4d-77b55a4189a3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cbab8b'},body:JSON.stringify({sessionId:'cbab8b',runId:'post-fix',hypothesisId:'H',location:'recovery-session.ts:exchangeCode',message:'code exchange result',data:{ok:!error,error:error?.message||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7353/ingest/efb20fee-084f-4ea9-9b4d-77b55a4189a3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cbab8b'},body:JSON.stringify({sessionId:'cbab8b',runId:'post-fix',hypothesisId:'H',location:'recovery-session.ts:setSession',message:'hash setSession result',data:{ok:!error,error:error?.message||null,hashType:hash.get('type')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!error) {
      cleanRecoveryUrl();
      return true;
    }
  }

  // One more read after auto-detect / setSession attempts.
  const { data } = await supabase.auth.getSession();
  // #region agent log
  fetch('http://127.0.0.1:7353/ingest/efb20fee-084f-4ea9-9b4d-77b55a4189a3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cbab8b'},body:JSON.stringify({sessionId:'cbab8b',runId:'post-fix',hypothesisId:'G',location:'recovery-session.ts:final',message:'final session check',data:{hasSession:Boolean(data.session)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return Boolean(data.session);
}
