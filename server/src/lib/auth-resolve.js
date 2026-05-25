import { resolveProfileFromAccessToken, toApiUser } from "./auth-supabase.js";
import { verifyLegacyToken } from "./auth-legacy.js";

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

  return {
    id: payload.userId,
    role: payload.role,
    name: payload.name,
    email: payload.email,
  };
}
