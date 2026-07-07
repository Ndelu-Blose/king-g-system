import type { User, UserRole } from './types';
import { getApiBase, usesLocalApiProxy } from './api-base';
import { getSupabase, isSupabaseConfigured } from './supabase';

export const TOKEN_KEY = 'kingg_token';

const USE_DIRECT_SUPABASE =
  isSupabaseConfigured && import.meta.env.VITE_USE_DIRECT_SUPABASE === 'true';

export type LoginResult =
  | { ok: true; user: User; token: string }
  | { ok: false; error: string };

function mapAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return 'Invalid email or password.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'Please confirm your email before signing in.';
  }
  return message || 'Sign-in failed.';
}

async function loadUserProfileFromSupabase(): Promise<User | null> {
  const { data: sessionData } = await getSupabase().auth.getSession();
  const authId = sessionData.session?.user?.id;
  const email = sessionData.session?.user?.email?.trim().toLowerCase();
  if (!authId && !email) return null;

  let query = getSupabase()
    .from('users')
    .select('id,name,email,role,active')
    .eq('active', true);

  if (authId) query = query.eq('auth_user_id', authId);
  else if (email) query = query.eq('email', email);

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role as UserRole,
  };
}

async function loadUserFromToken(token: string): Promise<User | null> {
  if (USE_DIRECT_SUPABASE) {
    return loadUserProfileFromSupabase();
  }

  const res = await fetch(`${getApiBase()}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { user?: User };
  return data.user ?? null;
}

async function loginWithSupabase(email: string, password: string): Promise<LoginResult> {
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) {
    return { ok: false, error: mapAuthError(error.message) };
  }
  const token = data.session?.access_token;
  if (!token) {
    return { ok: false, error: 'No session returned. Try again.' };
  }
  const user = await loadUserFromToken(token);
  if (!user) {
    await getSupabase().auth.signOut();
    return {
      ok: false,
      error:
        'Signed in to Supabase, but no active King G profile found. Ask an owner to add your role in User Management.',
    };
  }
  return { ok: true, user, token };
}

export async function loginWithApi(email: string, password: string): Promise<LoginResult> {
  if (isSupabaseConfigured) {
    const supabaseResult = await loginWithSupabase(email, password);
    if (supabaseResult.ok) return supabaseResult;

    // When using direct Supabase for data, only fall back to a remote API if one is configured.
    if (!USE_DIRECT_SUPABASE || getApiBase()) {
      try {
        const apiResult = await loginWithApiFallback(email, password);
        if (apiResult.ok) return apiResult;
        const mergedMessage =
          apiResult.error && apiResult.error !== supabaseResult.error
            ? `${supabaseResult.error} ${apiResult.error}`
            : supabaseResult.error;
        return { ok: false, error: mergedMessage };
      } catch (e) {
        const msg = e instanceof Error ? e.message : supabaseResult.error;
        return { ok: false, error: msg };
      }
    }

    // Vite dev: try same-origin /api login (legacy hash or richer server errors)
    if (usesLocalApiProxy()) {
      try {
        const apiResult = await loginWithApiFallback(email, password);
        if (apiResult.ok) return apiResult;
        if (apiResult.error && apiResult.error !== supabaseResult.error) {
          return { ok: false, error: apiResult.error };
        }
      } catch {
        /* ignore */
      }
    }

    return { ok: false, error: supabaseResult.error };
  }

  return loginWithApiFallback(email, password);
}

async function loginWithApiFallback(email: string, password: string): Promise<LoginResult> {

  try {
    const res = await fetch(`${getApiBase()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      token?: string;
      user?: User;
      error?: string;
      hint?: string;
    };
    if (!res.ok) {
      const serverMessage = [data.error, data.hint].filter(Boolean).join(' ');
      return {
        ok: false,
        error:
          serverMessage ||
          (res.status === 401 ? 'Invalid email or password.' : `Login failed (${res.status}).`),
      };
    }
    if (!data.token || !data.user) {
      return { ok: false, error: 'Invalid response from server.' };
    }
    return { ok: true, user: data.user, token: data.token };
  } catch {
    return {
      ok: false,
      error: 'Cannot reach the API. Start the server (cd server && npm start) and refresh this page.',
    };
  }
}

/** Send Supabase password-reset email (owner can also reset from Supabase dashboard). */
export async function requestPasswordReset(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Password reset requires Supabase. Contact an owner to change your password.' };
  }
  const redirectTo = `${window.location.origin}/login`;
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  });
  if (error) return { ok: false, error: mapAuthError(error.message) };
  return { ok: true };
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearStoredToken(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
}

export function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export function isAuthFailureStatus(status: number): boolean {
  return status === 401 || status === 403;
}

/** Restore session from Supabase or stored JWT (after refresh). */
export async function fetchCurrentUser(): Promise<User | null> {
  if (isSupabaseConfigured) {
    try {
      const { data } = await getSupabase().auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        clearStoredToken();
        return null;
      }
      storeToken(token);
      const user = await loadUserFromToken(token);
      if (!user) {
        clearStoredToken();
        await getSupabase().auth.signOut();
      }
      return user;
    } catch {
      clearStoredToken();
      return null;
    }
  }

  const token = getStoredToken();
  if (!token) return null;
  try {
    const user = await loadUserFromToken(token);
    if (!user) clearStoredToken();
    return user;
  } catch {
    clearStoredToken();
    return null;
  }
}

export async function signOutAuth(): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      await getSupabase().auth.signOut();
    } catch {
      /* ignore */
    }
  }
  clearStoredToken();
}
