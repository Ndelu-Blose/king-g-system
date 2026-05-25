import { getSupabaseAdmin } from "./supabase.js";

let authUserIdColumnReady = null;

/** True when `public.users.auth_user_id` exists (migration applied). */
export async function hasAuthUserIdColumn() {
  if (authUserIdColumnReady !== null) return authUserIdColumnReady;
  const client = getSupabaseAdmin();
  const { error } = await client.from("users").select("auth_user_id").limit(1);
  authUserIdColumnReady = !error || !/auth_user_id/i.test(error.message);
  return authUserIdColumnReady;
}

export function resetAuthSchemaCache() {
  authUserIdColumnReady = null;
}
