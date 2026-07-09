import { getSupabaseAdmin } from "../lib/supabase.js";
import { isSupabaseAdminEnabled } from "../lib/server-capabilities.js";

const DEBUG_LOG = (location, message, data, hypothesisId) => {
  // #region agent log
  fetch("http://127.0.0.1:7617/ingest/fe06f2ec-2a83-4b03-b45f-cadf002a9913", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a458c3" },
    body: JSON.stringify({
      sessionId: "a458c3",
      runId: "email-debug",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
};

const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim() || "";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";
const FROM_NAME = process.env.RESEND_FROM_NAME?.trim() || "King G";
const APP_URL = (process.env.APP_URL || process.env.VITE_APP_URL || "http://localhost:8080").replace(
  /\/$/,
  "",
);

const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function isResendConfigured() {
  return Boolean(RESEND_API_KEY);
}

export function isLocalAppHost(hostname) {
  return LOCAL_HOST_RE.test(String(hostname || "").trim());
}

/** Prefer production APP_URL when redirect target is localhost (e.g. dev machine triggered reset). */
export function getPasswordResetRedirectUrl(redirectTo) {
  const defaultUrl = `${APP_URL}/reset-password`;
  const target = String(redirectTo || "").trim();
  if (target && /^https?:\/\//i.test(target)) {
    try {
      const url = new URL(target);
      const appUrl = new URL(APP_URL);
      const appIsProduction = !isLocalAppHost(appUrl.hostname);
      if (appIsProduction && isLocalAppHost(url.hostname)) {
        return defaultUrl;
      }
      return target;
    } catch {
      /* fall through */
    }
  }
  return defaultUrl;
}

async function sendViaResend({ to, subject, html }) {
  if (!isResendConfigured()) {
    throw new Error("Resend is not configured (RESEND_API_KEY missing)");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.message || body?.error || `Resend send failed (${res.status})`;
    DEBUG_LOG("email.service.js:sendViaResend", "resend send failed", { status: res.status, error: msg }, "H3");
    throw new Error(msg);
  }
  return body;
}

async function generateRecoveryLink(email, redirectTo) {
  const adminReady = isSupabaseAdminEnabled();
  DEBUG_LOG("email.service.js:generateRecoveryLink", "recovery link precheck", { adminReady }, "H2");
  if (!adminReady) {
    throw new Error("Supabase Auth is not configured");
  }
  const client = getSupabaseAdmin();
  const { data, error } = await client.auth.admin.generateLink({
    type: "recovery",
    email: String(email).trim().toLowerCase(),
    options: { redirectTo: getPasswordResetRedirectUrl(redirectTo) },
  });
  if (error) {
    DEBUG_LOG("email.service.js:generateRecoveryLink", "generateLink failed", { error: error.message }, "H2");
    throw new Error(error.message || "Failed to generate reset link");
  }
  const link = data?.properties?.action_link;
  if (!link) throw new Error("No reset link returned from Supabase");
  DEBUG_LOG("email.service.js:generateRecoveryLink", "recovery link created", { hasLink: true }, "H2");
  return link;
}

function passwordResetHtml({ name, link, intro }) {
  const greeting = name ? `<p>Hi ${name},</p>` : "";
  return `${greeting}<p>${intro}</p><p><a href="${link}" style="color:#b8860b;font-weight:600">Open King G</a></p><p>If you did not request this, you can ignore this email.</p>`;
}

/**
 * Send password reset email via Resend (all King G users with Supabase Auth).
 */
export async function sendPasswordResetEmail(email, options = {}) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    throw new Error("Valid email is required");
  }

  const link = await generateRecoveryLink(normalized, options.redirectTo);
  const html = passwordResetHtml({
    name: options.name,
    link,
    intro: options.intro || "We received a request to reset your King G password.",
  });

  const result = await sendViaResend({
    to: normalized,
    subject: options.subject || "Reset your King G password",
    html,
  });

  return { ok: true, resendId: result?.id ?? null };
}

/**
 * Welcome email when an owner adds a new staff member.
 */
export async function sendWelcomeEmail({ email, name, role }) {
  const normalized = String(email || "").trim().toLowerCase();
  const displayName = String(name || "").trim() || normalized;
  const roleLabel = String(role || "staff").replace(/_/g, " ");

  const link = await generateRecoveryLink(normalized);
  const html = passwordResetHtml({
    name: displayName,
    link,
    intro: `Your King G account has been created as <strong>${roleLabel}</strong>. Use the link below to set your password and sign in.`,
  });

  const result = await sendViaResend({
    to: normalized,
    subject: "Welcome to King G — set your password",
    html,
  });

  return { ok: true, resendId: result?.id ?? null };
}

/**
 * Notify user after an owner changes their password.
 */
export async function sendPasswordChangedEmail({ email, name }) {
  const normalized = String(email || "").trim().toLowerCase();
  const displayName = String(name || "").trim() || normalized;

  const link = await generateRecoveryLink(normalized);
  const html = passwordResetHtml({
    name: displayName,
    link,
    intro: "Your King G password was changed by an administrator. If this was not expected, reset your password immediately using the link below.",
  });

  const result = await sendViaResend({
    to: normalized,
    subject: "Your King G password was changed",
    html,
  });

  return { ok: true, resendId: result?.id ?? null };
}
