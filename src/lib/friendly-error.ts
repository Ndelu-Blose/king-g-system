const GENERIC = 'Something went wrong. Please try again or ask a manager.';

/** Turn a server or database message into wording a cashier or manager can act on. */
export function toFriendlyMessage(raw: string): string {
  const msg = raw.trim();
  if (!msg) return GENERIC;

  if (
    /invalid or expired token|jwt|unauthori[sz]ed|session expired|authentication required|not signed in/i.test(
      msg
    ) ||
    /^API 401$/.test(msg) ||
    /request failed \(401\)/i.test(msg)
  ) {
    return 'Your session expired. Sign out and sign in again.';
  }
  if (/insufficient permission|permission denied|row-level security|^API 403$/i.test(msg)) {
    return "You don't have permission to do that. Ask a manager.";
  }
  if (/failed to fetch|networkerror|network request failed|load failed|timeout/i.test(msg)) {
    return "The system couldn't be reached. Check the internet and try again.";
  }
  if (/not enough stock|insufficient stock/i.test(msg)) {
    return "There isn't enough of that item in the lounge.";
  }
  if (/stock changed while saving/i.test(msg)) {
    return 'The stock changed while this was saving. Check the quantity and try again.';
  }
  if (/cashreceived is less than total/i.test(msg)) {
    return 'The cash received is less than the amount due.';
  }
  if (/invalid quantity/i.test(msg)) {
    return 'Check the quantity and try again.';
  }
  if (/inventory row not found/i.test(msg)) {
    return 'That product is missing from stock. Ask a manager.';
  }
  if (
    /invalid linetotal|invalid sale|subtotal mismatch|total mismatch|invalid unitprice|invalid payment|invalid cashreceived|invalid change|payment amount must equal/i.test(
      msg
    )
  ) {
    return "The payment doesn't match the sale. Close it and try again.";
  }
  if (
    /^API \d{3}$/i.test(msg) ||
    /failed \(\d{3}\)$/i.test(msg) ||
    /request failed \(\d{3}\)/i.test(msg) ||
    /prisma|supabase|postgres|pgrst|duplicate key|violates|syntax error|bearer |econn|vercel|service role|relation "|column "|null value in column|\buuid\b/i.test(
      msg
    )
  ) {
    return GENERIC;
  }
  return msg;
}

export function friendlyErrorMessage(error: unknown, fallback = GENERIC): string {
  if (error instanceof Error && error.message.trim()) return toFriendlyMessage(error.message);
  if (typeof error === 'string' && error.trim()) return toFriendlyMessage(error);
  return fallback;
}
