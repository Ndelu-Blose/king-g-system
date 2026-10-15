/**
 * Request validation for endpoints that accept loosely shaped client input.
 * Kept free of I/O so the rules can be unit-tested without a database.
 */

// Client-written audit rows are informational only ("client.*"). Anything that
// claims an approval, an entity change or a timestamp is written by the server.
const CLIENT_AUDIT_ACTION = /^client\.[a-z0-9_.-]{1,60}$/;
const CLIENT_AUDIT_MAX_DETAIL_BYTES = 4096;

export function sanitizeClientAuditEntry(entry) {
  if (!entry || typeof entry !== "object") return { error: "Invalid audit entry: need action" };
  const action = String(entry.action ?? "").trim();
  if (!action) return { error: "Invalid audit entry: need action" };
  if (!CLIENT_AUDIT_ACTION.test(action)) {
    return { error: 'Only informational "client.*" audit actions can be written from the app' };
  }

  const details = entry.details ?? entry.after ?? {};
  let serialized;
  try {
    serialized = JSON.stringify(details);
  } catch {
    return { error: "Invalid audit details" };
  }
  if (Buffer.byteLength(serialized ?? "", "utf8") > CLIENT_AUDIT_MAX_DETAIL_BYTES) {
    return { error: "Audit details are too large" };
  }

  const reason = entry.reasonCode == null ? null : String(entry.reasonCode).slice(0, 100);
  return { action, after: details, reasonCode: reason };
}

// Approval and cash-control thresholds: owner only (the owner controls
// thresholds and sensitive operations). Pricing keys go through /api/pricing.
const OWNER_ONLY_SETTINGS = {
  manual_discount_max_percent: "percent",
  manual_discount_max_amount: "amount",
  refund_threshold_amount: "amount",
  void_requires_approval_always: "boolean",
  stock_variance_percent_threshold: "percent",
  blind_cash_close_enabled: "boolean",
};

// Operational settings any admin.settings holder may change.
const ADMIN_SETTINGS = {
  low_stock_threshold: "count",
};

function normalizeSettingValue(kind, raw) {
  const text = String(raw).trim();
  if (kind === "boolean") {
    return text === "true" || text === "false" ? text : null;
  }
  if (text === "" || !/^\d+(\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return null;
  if (kind === "percent" && n > 100) return null;
  if (kind === "count" && !Number.isInteger(n)) return null;
  return text;
}

/**
 * Validate a PUT /api/settings body for the given role.
 * Returns { updates: [[key, value], ...] } or { status, error }.
 */
export function validateSettingsUpdate(body, role) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { status: 400, error: "Settings must be an object" };
  }
  const updates = [];
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    const ownerKind = OWNER_ONLY_SETTINGS[key];
    const adminKind = ADMIN_SETTINGS[key];
    if (!ownerKind && !adminKind) return { status: 400, error: `Unknown setting: ${key}` };
    if (ownerKind && role !== "owner") {
      return { status: 403, error: `Only the owner can change ${key}` };
    }
    const normalized = normalizeSettingValue(ownerKind || adminKind, value);
    if (normalized == null) return { status: 400, error: `Invalid value for ${key}` };
    updates.push([key, normalized]);
  }
  if (!updates.length) return { status: 400, error: "No settings to update" };
  return { updates };
}

/** Allowed browser origins, from CORS_ORIGINS (comma-separated). Empty = allow any. */
export function corsOriginsFromEnv(env = process.env) {
  return String(env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
}
