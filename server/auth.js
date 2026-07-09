/**
 * Auth: Supabase Auth (production) + legacy JWT fallback (dev / migration).
 */
import { getUserByEmail, resolvePasswordResetRecipient, updateOwnProfile, changeOwnPassword, getUserById } from "./src/services/users.service.js";
import { credentialsValid } from "./src/lib/auth-credentials.js";
import { resolveBearerUser } from "./src/lib/auth-resolve.js";
import { legacyTokenTtlSec, signLegacyToken } from "./src/lib/auth-legacy.js";
import { isSupabaseAuthEnabled, signInWithSupabaseAuth } from "./src/lib/auth-supabase.js";
import { isResendConfigured, sendPasswordResetEmail } from "./src/services/email.service.js";
import { logRouteError, sendError } from "./src/lib/api-error.js";

/**
 * GET /api/auth/me — current user from Bearer token.
 */
export async function meHandler(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const profile = await getUserById(req.user.id);
    const user = profile
      ? {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          phone: profile.phone ?? null,
        }
      : {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          phone: req.user.phone ?? null,
        };
    return res.json({ user });
  } catch (e) {
    return sendError(res, "GET /api/auth/me", e, { fallback: "Failed to load profile" });
  }
}

export async function updateProfileHandler(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const body = req.body || {};
  try {
    const updated = await updateOwnProfile(req.user.id, {
      name: body.name,
      email: body.email,
      phone: body.phone,
    });
    return res.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        phone: updated.phone ?? null,
      },
    });
  } catch (e) {
    return sendError(res, "PATCH /api/auth/profile", e, { fallback: "Failed to update profile" });
  }
}

export async function changePasswordHandler(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const { currentPassword, newPassword } = req.body || {};
  try {
    await changeOwnPassword(req.user.id, { currentPassword, newPassword });
    return res.json({ ok: true });
  } catch (e) {
    return sendError(res, "PATCH /api/auth/password", e, { fallback: "Failed to change password" });
  }
}

export async function loginHandler(req, res) {
  const { email, password } = req.body || {};
  if (!email || !String(email).trim()) {
    return res.status(400).json({ error: "Email required" });
  }
  if (!password || !String(password).length) {
    return res.status(400).json({ error: "Password required" });
  }

  try {
    if (isSupabaseAuthEnabled()) {
      const supabaseResult = await signInWithSupabaseAuth(String(email).trim(), password);
      if (supabaseResult?.ok) {
        return res.json(supabaseResult);
      }
      if (supabaseResult && !supabaseResult.ok) {
        const msg = String(supabaseResult.error || "");
        if (/email not confirmed/i.test(msg)) {
          return res.status(401).json({
            error: "Please confirm your email before signing in.",
            hint: "Ask an owner to confirm your account, or use Forgot password.",
          });
        }
      }
      const profile = await getUserByEmail(String(email).trim());
      if (profile?.authUserId) {
        return res.status(401).json({
          error: "Invalid email or password.",
        });
      }
    }

    const user = await getUserByEmail(String(email).trim());
    if (!user || user.active === false || !credentialsValid(user, password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const payload = {
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      iat: Math.floor(Date.now() / 1000),
      exp: legacyTokenTtlSec(),
    };
    const token = signLegacyToken(payload);
    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (e) {
    return sendError(res, "POST /api/auth/login", e, { fallback: "Login failed" });
  }
}

/**
 * POST /api/auth/request-password-reset — send reset email via Resend for King G users.
 * Always returns ok when email format is valid (do not reveal whether account exists).
 */
export async function requestPasswordResetHandler(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const redirectTo = String(req.body?.redirectTo || "").trim();

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  if (!isResendConfigured()) {
    return res.status(503).json({
      error: "Password reset is not available right now. Contact an owner for help.",
    });
  }

  try {
    const recipient = await resolvePasswordResetRecipient(email);
    if (recipient) {
      await sendPasswordResetEmail(recipient.email, {
        redirectTo: redirectTo || undefined,
        name: recipient.name,
      });
    }
    return res.json({ ok: true });
  } catch (e) {
    return sendError(res, "POST /api/auth/request-password-reset", e, {
      fallback: "Failed to send password reset email",
    });
  }
}

/**
 * Middleware: Bearer token → req.user (Supabase JWT or legacy JWT).
 */
export function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith("Bearer ") ? auth.slice(7) : null;

  resolveBearerUser(token)
    .then((user) => {
      if (!user) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      req.user = user;
      next();
    })
    .catch((e) => {
      logRouteError("authMiddleware", e);
      res.status(401).json({ error: "Invalid or expired token" });
    });
}

/**
 * Optional auth: attach user when token valid; otherwise continue without req.user.
 */
export function optionalAuthMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) return next();

  resolveBearerUser(token)
    .then((user) => {
      if (user) req.user = user;
      next();
    })
    .catch(() => next());
}
