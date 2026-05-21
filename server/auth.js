/**
 * Auth: login (issue JWT) and middleware to attach user to req.
 * Uses Node crypto for HMAC-SHA256 signed tokens (no external JWT lib).
 */
import crypto from 'crypto';
import { getUserByEmail } from './src/services/users.service.js';
import { credentialsValid } from './src/lib/auth-credentials.js';

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
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * GET /api/auth/me — current user from Bearer token.
 */
export function meHandler(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
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

export function loginHandler(req, res) {
  const { email, password } = req.body || {};
  if (!email || !String(email).trim()) {
    return res.status(400).json({ error: 'Email required' });
  }
  if (!password || !String(password).length) {
    return res.status(400).json({ error: 'Password required' });
  }

  getUserByEmail(String(email).trim())
    .then((user) => {
      if (!user || user.active === false || !credentialsValid(user, password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const payload = {
        userId: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor((Date.now() + TOKEN_TTL_MS) / 1000),
      };
      const token = sign(payload);
      return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    })
    .catch((e) => {
      console.error(e);
      return res.status(500).json({ error: 'Login failed' });
    });
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
