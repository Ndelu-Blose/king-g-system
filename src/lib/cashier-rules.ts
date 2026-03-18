/**
 * Cashier permissions: what they CAN and CANNOT do.
 * Enforced by AppLayout (allowed routes) and sidebar (cashier-only nav).
 *
 * Cashier CAN:
 * - New sale (POS terminal)
 * - Scan / manual item entry
 * - Take payment + show change
 * - Print receipt
 * - End own shift / cash-up (basic)
 * - Sales History (my shift / today)
 * - Open shift / Help (call manager)
 *
 * Cashier CANNOT:
 * - Create or edit products
 * - Do refunds or voids without approval (no access to refund/void screens)
 * - See full business reports (only own sales history)
 */

export const CASHIER_ALLOWED_PATHS = ['/pos', '/pos/sales-history'] as const;

export function isCashierAllowedPath(pathname: string): boolean {
  return (
    CASHIER_ALLOWED_PATHS.includes(pathname as (typeof CASHIER_ALLOWED_PATHS)[number]) ||
    pathname.startsWith('/pos/')
  );
}
