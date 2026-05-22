import type { ManagedUser, UserRole } from './types';
import { authHeaders, clearStoredToken, isAuthFailureStatus } from './auth-api';
import { getApiBase } from './api-base';

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

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  await handleResponse(res);
  return res.json();
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  await handleResponse(res);
  return res.json();
}

async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handleResponse(res);
}

export async function fetchUsers(): Promise<ManagedUser[]> {
  return apiGet<ManagedUser[]>('/api/users');
}

export async function createUser(payload: {
  name: string;
  email: string;
  role: UserRole;
  password: string;
}): Promise<ManagedUser> {
  return apiPost<ManagedUser>('/api/users', payload);
}

export async function updateUser(
  id: string,
  payload: Partial<{ name: string; email: string; role: UserRole; active: boolean }>
): Promise<ManagedUser> {
  return apiPatch<ManagedUser>(`/api/users/${encodeURIComponent(id)}`, payload);
}

export async function changeUserPassword(id: string, password: string): Promise<void> {
  await apiPatch(`/api/users/${encodeURIComponent(id)}/password`, { password });
}

export async function deleteUser(id: string): Promise<void> {
  await apiDelete(`/api/users/${encodeURIComponent(id)}`);
}
