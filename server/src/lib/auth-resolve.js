import { resolveProfileFromAccessToken, toApiUser } from "./auth-supabase.js";
import { verifyLegacyToken } from "./auth-legacy.js";
import { getUserById } from "../services/users.service.js";

/**
 * Resolve Bearer token to app user { id, role, name, email }.
 * Tries Supabase Auth JWT first, then legacy HMAC JWT.
 */
export async function resolveBearerUser(token) {
  if (!token) return null;

  const fromSupabase = await resolveProfileFromAccessToken(token);
  if (fromSupabase) return toApiUser(fromSupabase);

  const payload = verifyLegacyToken(token);
  if (!payload?.userId) return null;

  // Role and active state come from public.users on every request, never from
  // the token, so a deactivated or demoted user loses access immediately.
  const profile = await getUserById(payload.userId);
  if (!profile || profile.active === false) return null;

  return {
    id: profile.id,
    role: profile.role,
    name: profile.name,
    email: profile.email,
  };
}
