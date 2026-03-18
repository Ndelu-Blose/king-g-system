/**
 * Auth: login (issue JWT) and middleware to attach user to req.
 * Uses Node crypto for HMAC-SHA256 signed tokens (no external JWT lib).
 */
import crypto from 'crypto';
import * as db from './db.js';

const SECRET = process.env.JWT_SECRET || 'kingg-pos-dev-secret-change-in-production';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function sign(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/login body: { email, password }.
 * Returns { token, user: { id, name, email, role } }. Password ignored for dev (no hash stored).
 */
export function loginHandler(req, res) {
  const { email, password } = req.body || {};
  if (!email || !String(email).trim()) {
    return res.status(400).json({ error: 'Email required' });
  }
  const user = db.getUserByEmail(String(email).trim());
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // In production: verify password against user.password_hash. For dev we accept any.
  const payload = {
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((Date.now() + TOKEN_TTL_MS) / 1000),
  };
  const token = sign(payload);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}

/**
 * Middleware: parse Authorization: Bearer <token>, verify, set req.user = { id, role, name, email }.
 */
export function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = verify(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = {
    id: payload.userId,
    role: payload.role,
    name: payload.name,
    email: payload.email,
  };
  next();
}

/**
 * Optional middleware: if Authorization present, attach user; else leave req.user undefined.
 * Use for routes that work both authenticated and unauthenticated (e.g. some reads).
 */
export function optionalAuthMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = token ? verify(token) : null;
  if (payload) {
    req.user = {
      id: payload.userId,
      role: payload.role,
      name: payload.name,
      email: payload.email,
    };
  }
  next();
}
