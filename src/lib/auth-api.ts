import type { User } from './types';
import { getApiBase } from './api-base';

export const TOKEN_KEY = 'kingg_token';

export type LoginResult =
  | { ok: true; user: User; token: string }
  | { ok: false; error: string };

export async function loginWithApi(email: string, password: string): Promise<LoginResult> {
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
    };
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || (res.status === 401 ? 'Invalid email or password.' : `Login failed (${res.status}).`),
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

/** Restore session from stored JWT (after refresh). */
export async function fetchCurrentUser(): Promise<User | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await fetch(`${getApiBase()}/api/auth/me`, { headers: authHeaders() });
    if (res.status === 404) {
      clearStoredToken();
      console.warn(
        'API /api/auth/me not found. Restart the API: cd server && npm start'
      );
      return null;
    }
    if (!res.ok) {
      clearStoredToken();
      return null;
    }
    const data = (await res.json()) as { user?: User };
    return data.user ?? null;
  } catch {
    clearStoredToken();
    return null;
  }
}
