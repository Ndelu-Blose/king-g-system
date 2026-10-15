import crypto from "crypto";

// Development-only fallback. In production a missing JWT_SECRET disables
// legacy tokens instead: this default is in the repository, so anyone could
// sign tokens with it.
const DEV_SECRET = "kingg-pos-dev-secret-change-in-production";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

let warnedMissingSecret = false;

function getSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!warnedMissingSecret) {
      console.error("JWT_SECRET is not set: legacy sign-in is disabled in production.");
      warnedMissingSecret = true;
    }
    return null;
  }
  return DEV_SECRET;
}

export function isLegacyAuthAvailable() {
  return Boolean(getSecret());
}

export function signLegacyToken(payload) {
  const secret = getSecret();
  if (!secret) throw new Error("Legacy sign-in is not configured (JWT_SECRET missing)");
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifyLegacyToken(token) {
  const secret = getSecret();
  if (!secret) return null;
  if (!token || typeof token !== "string") return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function legacyTokenTtlSec() {
  return Math.floor((Date.now() + TOKEN_TTL_MS) / 1000);
}
