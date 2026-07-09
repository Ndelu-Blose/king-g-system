const DEFAULT_FALLBACK = "Something went wrong. Please try again or contact support.";

const SAFE_CLIENT_PATTERN =
  /required|invalid|not found|insufficient|cannot|already exists|already in use|must be|too short|too long|mismatch|less than|empty/i;

/**
 * Log route errors with context for server-side debugging.
 */
export function logRouteError(route, error) {
  console.error(`[${route}]`, error);
}

/**
 * Map an error to a safe HTTP status + client body. Full error is always logged.
 */
export function clientError(error, { route, fallback = DEFAULT_FALLBACK } = {}) {
  if (route) logRouteError(route, error);
  const msg = error instanceof Error ? error.message : String(error ?? "");
  if (SAFE_CLIENT_PATTERN.test(msg)) {
    const status = /not found/i.test(msg) ? 404 : 400;
    return { status, body: { error: msg } };
  }
  return { status: 500, body: { error: fallback } };
}

/**
 * Send a safe error response from an Express route handler.
 */
export function sendError(res, route, error, options = {}) {
  const { status, body } = clientError(error, { route, ...options });
  return res.status(status).json(body);
}
