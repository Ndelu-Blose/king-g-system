import { isResendConfigured } from "../services/email.service.js";
import { isSupabaseAuthEnabled } from "./auth-supabase.js";

function hasServiceRole() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  return Boolean(key && !/your_|your-/i.test(key));
}

function hasSupabaseUrl() {
  const url = process.env.SUPABASE_URL?.trim() || "";
  return Boolean(url && !url.includes("your-project"));
}

function getSupabaseProjectRef() {
  const url = process.env.SUPABASE_URL?.trim() || "";
  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

const KING_G_PROJECT_REF = "tpydiklyduxjkvenfvzd";

/** Service role + project URL — enough for admin auth and recovery links. */
export function isSupabaseAdminEnabled() {
  return hasSupabaseUrl() && hasServiceRole();
}

/** Non-secret capability flags for /api/health diagnostics. */
export function getServerCapabilities() {
  const resend = isResendConfigured();
  const supabaseAdmin = isSupabaseAdminEnabled();
  const supabaseAuth = isSupabaseAuthEnabled();
  const supabaseProjectRef = getSupabaseProjectRef();
  return {
    resend,
    supabaseAdmin,
    supabaseAuth,
    appUrl: (process.env.APP_URL || "").trim() || null,
    supabaseProjectRef,
    kingGProjectConfigured: supabaseProjectRef === KING_G_PROJECT_REF,
    userEmailsReady: resend && supabaseAdmin,
  };
}
