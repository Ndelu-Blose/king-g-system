import type { ManagedUser, UserRole } from './types';
import { authHeaders, clearStoredToken, isAuthFailureStatus } from './auth-api';
import { getApiBase, usesLocalApiProxy } from './api-base';
import { getSupabase, isSupabaseConfigured } from './supabase';

const USE_DIRECT_SUPABASE =
  isSupabaseConfigured && import.meta.env.VITE_USE_DIRECT_SUPABASE === 'true';

/** Hosted API (same Supabase project) — used for user writes when local API is not running. */
const HOSTED_API_URL = 'https://king-g-api.vercel.app';

function getUsersWriteBase(): string {
  const configured = getApiBase();
  if (configured) return configured;
  if (USE_DIRECT_SUPABASE) {
    // Local API has service role and creates Supabase Auth users; hosted API often does not.
    if (usesLocalApiProxy()) return '';
    return HOSTED_API_URL;
  }
  return '';
}

export class ApiAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiAuthError';
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === 'string') return body.error;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}

async function handleResponse(res: Response): Promise<void> {
  if (!res.ok) {
    const message = await parseError(res);
    if (isAuthFailureStatus(res.status)) {
      clearStoredToken();
      throw new ApiAuthError(message);
    }
    throw new Error(message);
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, { headers: authHeaders() });
  await handleResponse(res);
  return res.json();
}

async function usersWritePost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getUsersWriteBase()}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  await handleResponse(res);
  return res.json();
}

async function usersWritePatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getUsersWriteBase()}${path}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  await handleResponse(res);
  return res.json();
}

async function usersWriteDelete(path: string): Promise<void> {
  const res = await fetch(`${getUsersWriteBase()}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handleResponse(res);
}

function mapManagedUser(row: {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean | null;
}): ManagedUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    active: row.active !== false,
  };
}

export async function fetchUsers(): Promise<ManagedUser[]> {
  if (USE_DIRECT_SUPABASE) {
    const { data, error } = await getSupabase()
      .from('users')
      .select('id,name,email,role,active')
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapManagedUser);
  }
  return apiGet<ManagedUser[]>('/api/users');
}

export type CreateUserResult = ManagedUser & {
  authUserId?: string | null;
  emailSent?: boolean;
  emailError?: string | null;
};

export async function createUser(payload: {
  name: string;
  email: string;
  role: UserRole;
  password: string;
}): Promise<CreateUserResult> {
  const created = await usersWritePost<CreateUserResult>('/api/users', payload);
  if (!created.authUserId) {
    throw new Error(
      created.emailError ||
        'User profile saved, but login was not created. Add SUPABASE_SERVICE_ROLE_KEY on king-g-api (Vercel) and try again.',
    );
  }
  return created;
}

export async function sendUserWelcomeEmail(id: string): Promise<void> {
  await usersWritePost(`/api/users/${encodeURIComponent(id)}/send-welcome`, {});
}

export async function updateUser(
  id: string,
  payload: Partial<{ name: string; email: string; role: UserRole; active: boolean }>
): Promise<ManagedUser> {
  return usersWritePatch<ManagedUser>(`/api/users/${encodeURIComponent(id)}`, payload);
}

export async function changeUserPassword(id: string, password: string): Promise<void> {
  await usersWritePatch(`/api/users/${encodeURIComponent(id)}/password`, { password });
}

export async function deleteUser(id: string): Promise<void> {
  await usersWriteDelete(`/api/users/${encodeURIComponent(id)}`);
}
