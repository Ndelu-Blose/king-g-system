import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabase.js";
import { getUserByAuthId, getUserByEmail } from "../services/users.service.js";

function isPlaceholderKey(value) {
  const v = String(value || "").trim().toLowerCase();
  return !v || v.includes("your_") || v.includes("your-") || v === "your_supabase_anon_key";
}

export function isSupabaseAuthEnabled() {
  const url = process.env.SUPABASE_URL;
  const anon =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && anon && !String(url).includes("your-project") && !isPlaceholderKey(anon));
}

function getAnonClient() {
  const url = process.env.SUPABASE_URL;
  const anon =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required for Auth sign-in");
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Map profile row to API user + attach role from public.users (never from JWT user_metadata). */
export function toApiUser(profile) {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    phone: profile.phone ?? null,
  };
}

/**
 * Verify Supabase access token and load app profile (role, active).
 * Returns null if token invalid or no active profile.
 */
export async function resolveProfileFromAccessToken(accessToken) {
  if (!accessToken) return null;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data?.user?.email) return null;

  const authId = data.user.id;
  const email = data.user.email.trim().toLowerCase();

  let profile = authId ? await getUserByAuthId(authId) : null;
  if (!profile) profile = await getUserByEmail(email);
  if (!profile || profile.active === false) return null;

  return profile;
}

/**
 * Email/password sign-in via Supabase Auth. Returns { token, user } or null.
 */
export async function signInWithSupabaseAuth(email, password) {
  if (!isSupabaseAuthEnabled()) return null;

  const client = getAnonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: String(email).trim().toLowerCase(),
    password: String(password),
  });
  if (error || !data.session?.access_token) {
    return {
      ok: false,
      error: error?.message || "Supabase sign-in failed",
    };
  }

  const profile = await resolveProfileFromAccessToken(data.session.access_token);
  if (!profile) {
    return {
      ok: false,
      error: "Signed in to Supabase, but no active King G profile found",
    };
  }

  return {
    ok: true,
    token: data.session.access_token,
    user: toApiUser(profile),
  };
}
