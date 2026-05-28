/**
 * Auth: Supabase Auth (production) + legacy JWT fallback (dev / migration).
 */
import { getUserByEmail } from "./src/services/users.service.js";
import { credentialsValid } from "./src/lib/auth-credentials.js";
import { resolveBearerUser } from "./src/lib/auth-resolve.js";
import { legacyTokenTtlSec, signLegacyToken } from "./src/lib/auth-legacy.js";
import { isSupabaseAuthEnabled, signInWithSupabaseAuth } from "./src/lib/auth-supabase.js";

/**
 * GET /api/auth/me — current user from Bearer token.
 */
export function meHandler(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  return res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
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
            hint: "Ask an owner to confirm the user in Supabase Authentication -> Users, or create the user from User Management.",
          });
        }
      }
      const profile = await getUserByEmail(String(email).trim());
      if (profile?.authUserId) {
        const hint =
          supabaseResult && !supabaseResult.ok
            ? `Supabase sign-in failed: ${supabaseResult.error}`
            : "This account uses Supabase sign-in. Check email/password in Authentication -> Users, or use Forgot password on the login page.";
        return res.status(401).json({
          error: "Invalid credentials",
          hint,
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
    console.error(e);
    return res.status(500).json({ error: "Login failed" });
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
      console.error(e);
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
