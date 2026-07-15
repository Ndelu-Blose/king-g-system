import * as Sentry from "@sentry/node";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { isSupabaseAdminEnabled } from "../lib/server-capabilities.js";
import {
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
  buildWelcomeEmail,
  KING_G_EMAIL_SUBJECTS,
  renderPlainText,
} from "../lib/email-template.js";

/** Report email failures without attaching bodies, tokens, or recipient PII. */
function captureEmailException(error) {
  const err = error instanceof Error ? error : new Error(String(error));
  Sentry.captureException(err, {
    tags: {
      service: "email",
      provider: "resend",
    },
  });
  return err;
}

const DEBUG_LOG = (location, message, data, hypothesisId) => {
  // #region agent log
  fetch("http://127.0.0.1:7353/ingest/efb20fee-084f-4ea9-9b4d-77b55a4189a3", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "cbab8b" },
    body: JSON.stringify({
      sessionId: "cbab8b",
      runId: "email-url-debug",
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
const PRODUCTION_APP_URL = "https://king-g-system.vercel.app";
const RAW_APP_URL = (process.env.APP_URL || process.env.VITE_APP_URL || PRODUCTION_APP_URL).replace(
  /\/$/,
  "",
);
// Never put localhost in outbound emails — production API may omit APP_URL.
const APP_URL = (() => {
  try {
    const host = new URL(RAW_APP_URL).hostname;
    if (/^(localhost|127\.0\.0\.1)$/i.test(host)) return PRODUCTION_APP_URL;
  } catch {
    return PRODUCTION_APP_URL;
  }
  return RAW_APP_URL;
})();

// #region agent log
DEBUG_LOG(
  "email.service.js:init",
  "APP_URL resolved at module load",
  {
    hasEnvAppUrl: Boolean((process.env.APP_URL || "").trim()),
    hasViteAppUrl: Boolean((process.env.VITE_APP_URL || "").trim()),
    rawAppUrl: RAW_APP_URL,
    resolvedAppUrl: APP_URL,
    isLocalFallback: /localhost|127\.0\.0\.1/i.test(APP_URL),
  },
  "A",
);
// #endregion

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
  let resolved = defaultUrl;
  if (target && /^https?:\/\//i.test(target)) {
    try {
      const url = new URL(target);
      const appUrl = new URL(APP_URL);
      const appIsProduction = !isLocalAppHost(appUrl.hostname);
      if (appIsProduction && isLocalAppHost(url.hostname)) {
        resolved = defaultUrl;
      } else if (isLocalAppHost(url.hostname)) {
        // Never emit localhost links in emails — always use production app URL.
        resolved = `${PRODUCTION_APP_URL}/reset-password`;
      } else {
        resolved = target;
      }
    } catch {
      resolved = defaultUrl;
    }
  }
  // #region agent log
  DEBUG_LOG(
    "email.service.js:getPasswordResetRedirectUrl",
    "resolved password reset redirect",
    {
      hasRedirectTo: Boolean(target),
      redirectHost: (() => {
        try {
          return target ? new URL(target).hostname : null;
        } catch {
          return "invalid";
        }
      })(),
      appUrlHost: (() => {
        try {
          return new URL(APP_URL).hostname;
        } catch {
          return "invalid";
        }
      })(),
      resolvedHost: (() => {
        try {
          return new URL(resolved).hostname;
        } catch {
          return "invalid";
        }
      })(),
      usesLocalhost: /localhost|127\.0\.0\.1/i.test(resolved),
    },
    "B",
  );
  // #endregion
  return resolved;
}

async function sendViaResend({ to, subject, html, text }) {
  if (!isResendConfigured()) {
    throw new Error("Resend is not configured (RESEND_API_KEY missing)");
  }

  const payload = {
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [to],
    subject,
    html,
  };
  if (text) payload.text = text;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
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

/**
 * Send password reset email via Resend (all King G users with Supabase Auth).
 */
export async function sendPasswordResetEmail(email, options = {}) {
  try {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      throw new Error("Valid email is required");
    }

    const link = await generateRecoveryLink(normalized, options.redirectTo);
    // #region agent log
    DEBUG_LOG(
      "email.service.js:sendPasswordResetEmail",
      "sending reset email",
      {
        linkHost: (() => {
          try {
            return new URL(link).hostname;
          } catch {
            return "invalid";
          }
        })(),
        footerAppUrl: APP_URL,
        footerIsLocal: /localhost|127\.0\.0\.1/i.test(APP_URL),
      },
      "C",
    );
    // #endregion
    const html = buildPasswordResetEmail({
      name: options.name,
      link,
      appUrl: APP_URL,
    });
    const text = renderPlainText({
      headline: "Password reset request",
      greetingName: options.name,
      paragraphs: [
        "We received a request to reset the password for your King G account.",
        "Use the link below to choose a new password.",
      ],
      ctaLabel: "Reset password",
      ctaUrl: link,
      appUrl: APP_URL,
    });

    const result = await sendViaResend({
      to: normalized,
      subject: options.subject || KING_G_EMAIL_SUBJECTS.recovery,
      html,
      text,
    });

    return { ok: true, resendId: result?.id ?? null };
  } catch (error) {
    throw captureEmailException(error);
  }
}

/**
 * Welcome email when an owner adds a new staff member.
 */
export async function sendWelcomeEmail({ email, name, role }) {
  try {
    const normalized = String(email || "").trim().toLowerCase();
    const displayName = String(name || "").trim() || normalized;
    const roleLabel = String(role || "staff").replace(/_/g, " ");

    const link = await generateRecoveryLink(normalized);
    // #region agent log
    DEBUG_LOG(
      "email.service.js:sendWelcomeEmail",
      "sending welcome email",
      {
        linkHost: (() => {
          try {
            return new URL(link).hostname;
          } catch {
            return "invalid";
          }
        })(),
        footerAppUrl: APP_URL,
        footerIsLocal: /localhost|127\.0\.0\.1/i.test(APP_URL),
      },
      "D",
    );
    // #endregion
    const html = buildWelcomeEmail({
      name: displayName,
      role: roleLabel,
      link,
      appUrl: APP_URL,
    });
    const text = renderPlainText({
      headline: "Welcome to the team",
      greetingName: displayName,
      paragraphs: [
        `Your King G account has been created as ${roleLabel}.`,
        "Set your password using the link below before your first sign-in.",
      ],
      ctaLabel: "Set your password",
      ctaUrl: link,
      appUrl: APP_URL,
    });

    const result = await sendViaResend({
      to: normalized,
      subject: KING_G_EMAIL_SUBJECTS.welcome,
      html,
      text,
    });

    return { ok: true, resendId: result?.id ?? null };
  } catch (error) {
    throw captureEmailException(error);
  }
}

/**
 * Notify user after an owner changes their password.
 */
export async function sendPasswordChangedEmail({ email, name }) {
  try {
    const normalized = String(email || "").trim().toLowerCase();
    const displayName = String(name || "").trim() || normalized;

    const link = await generateRecoveryLink(normalized);
    const html = buildPasswordChangedEmail({
      name: displayName,
      link,
      appUrl: APP_URL,
    });
    const text = renderPlainText({
      headline: "Your password was updated",
      greetingName: displayName,
      paragraphs: [
        "An administrator has changed the password on your King G account.",
        "If this was unexpected, secure your account using the link below.",
      ],
      ctaLabel: "Secure my account",
      ctaUrl: link,
      appUrl: APP_URL,
    });

    const result = await sendViaResend({
      to: normalized,
      subject: KING_G_EMAIL_SUBJECTS.passwordChanged,
      html,
      text,
    });

    return { ok: true, resendId: result?.id ?? null };
  } catch (error) {
    throw captureEmailException(error);
  }
}
