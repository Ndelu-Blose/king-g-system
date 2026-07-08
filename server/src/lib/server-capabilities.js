import { isResendConfigured } from "../services/email.service.js";

function hasServiceRole() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  return Boolean(key && !/your_|your-/i.test(key));
}

function hasSupabaseUrl() {
  const url = process.env.SUPABASE_URL?.trim() || "";
  return Boolean(url && !url.includes("your-project"));
}

/** Non-secret capability flags for /api/health diagnostics. */
export function getServerCapabilities() {
  const resend = isResendConfigured();
  const supabaseAdmin = hasSupabaseUrl() && hasServiceRole();
  return {
    resend,
    supabaseAdmin,
    appUrl: (process.env.APP_URL || "").trim() || null,
    userEmailsReady: resend && supabaseAdmin,
  };
}
