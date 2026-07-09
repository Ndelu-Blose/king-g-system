import type { User } from './types';
import { authHeaders, getStoredToken } from './auth-api';
import { getApiBase, usesLocalApiProxy } from './api-base';
import { getSupabase, isSupabaseConfigured } from './supabase';

export type ProfileUpdateInput = {
  name?: string;
  email?: string;
  phone?: string | null;
};

function mapProfileRow(data: {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
}): User {
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role as User['role'],
    phone: data.phone ?? null,
  };
}

async function updateProfileViaSupabase(
  userId: string,
  input: ProfileUpdateInput,
): Promise<User> {
  const patch: Record<string, string | null> = {};
  if (input.name !== undefined) {
    const trimmed = String(input.name).trim();
    if (!trimmed) throw new Error('Name is required');
    patch.name = trimmed;
  }
  if (input.email !== undefined) {
    const trimmed = String(input.email).trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) throw new Error('Valid email is required');
    patch.email = trimmed;
  }
  if (input.phone !== undefined) {
    patch.phone = String(input.phone || '').trim() || null;
  }
  if (Object.keys(patch).length === 0) {
    throw new Error('No changes to save');
  }

  const { data, error } = await getSupabase()
    .from('users')
    .update(patch)
    .eq('id', userId)
    .select('id,name,email,role,phone')
    .single();
  if (error) throw new Error(error.message || 'Failed to update profile');
  return mapProfileRow(data);
}

async function changePasswordViaSupabase(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const { error: signInError } = await getSupabase().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: currentPassword,
  });
  if (signInError) throw new Error('Current password is incorrect');

  const { error } = await getSupabase().auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message || 'Failed to change password');
}

export async function fetchProfile(): Promise<User | null> {
  const token = getStoredToken();
  if (!token) return null;

  const apiBase = getApiBase();
  if (apiBase || usesLocalApiProxy()) {
    try {
      const res = await fetch(`${apiBase}/api/auth/me`, { headers: authHeaders() });
      if (res.ok) {
        const data = (await res.json()) as { user?: User };
        return data.user ?? null;
      }
    } catch {
      /* fall through */
    }
  }

  if (!isSupabaseConfigured) return null;

  const { data: sessionData } = await getSupabase().auth.getSession();
  const authId = sessionData.session?.user?.id;
  if (!authId) return null;

  const { data, error } = await getSupabase()
    .from('users')
    .select('id,name,email,role,phone')
    .eq('auth_user_id', authId)
    .eq('active', true)
    .maybeSingle();
  if (error || !data) return null;
  return mapProfileRow(data);
}

export async function updateProfile(input: ProfileUpdateInput): Promise<User> {
  const apiBase = getApiBase();
  if (apiBase || usesLocalApiProxy()) {
    const res = await fetch(`${apiBase}/api/auth/profile`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => ({}))) as { user?: User; error?: string };
    if (res.ok && data.user) return data.user;
    if (res.status >= 400 && res.status < 500) {
      throw new Error(data.error || 'Failed to update profile');
    }
  }

  if (!isSupabaseConfigured) {
    throw new Error('Profile update requires the API or Supabase.');
  }

  const { data: sessionData } = await getSupabase().auth.getSession();
  const authId = sessionData.session?.user?.id;
  if (!authId) throw new Error('Not signed in');

  const { data: row } = await getSupabase()
    .from('users')
    .select('id')
    .eq('auth_user_id', authId)
    .maybeSingle();
  if (!row?.id) throw new Error('Profile not found');

  return updateProfileViaSupabase(row.id, input);
}

export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const apiBase = getApiBase();
  if (apiBase || usesLocalApiProxy()) {
    const res = await fetch(`${apiBase}/api/auth/password`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.ok) return;
    if (res.status >= 400 && res.status < 500) {
      throw new Error(data.error || 'Failed to change password');
    }
  }

  if (!isSupabaseConfigured) {
    throw new Error('Password change requires the API or Supabase.');
  }

  await changePasswordViaSupabase(email, currentPassword, newPassword);
}
