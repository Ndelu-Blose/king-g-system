/**
 * Permission catalogue and role–permission map for premium-lounge POS.
 * Aligned with Do/Approve/See matrix: Do = execute, Approve = authorise high-risk, See = view only.
 * UI: use canDo/canApprove/canSee to show vs hide vs disable actions.
 */

import type { UserRole } from '@/lib/mock-data';

// --- Permission constants (named strings for routes and API) ---
export const PERMISSIONS = {
  // Sales
  SALE_CREATE: 'sale.create',

  // Refund / Void
  REFUND_REQUEST: 'refund.request',
  REFUND_APPROVE: 'refund.approve',
  VOID_REQUEST: 'void.request',
  VOID_APPROVE: 'void.approve',

  // Discounts / Promos
  DISCOUNT_APPLY_AUTO: 'discount.apply.auto',
  DISCOUNT_APPLY_MANUAL: 'discount.apply.manual',
  DISCOUNT_APPROVE: 'discount.approve',
  PROMO_MANAGE: 'promo.manage',

  // Cash
  CASH_DRAWER_OPEN: 'cash.drawer.open',
  CASH_DRAWER_CLOSE: 'cash.drawer.close',
  CASH_DRAWER_REVIEW: 'cash.drawer.review',
  CASH_PAYOUT: 'cash.payout',

  // Inventory
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_RECEIVE: 'inventory.receive',
  INVENTORY_RECEIVE_POST: 'inventory.receive.post',
  INVENTORY_RECEIVE_APPROVE: 'inventory.receive.approve',
  INVENTORY_COUNT: 'inventory.count',
  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_ADJUST_APPROVE: 'inventory.adjust.approve',
  INVENTORY_TRANSFER: 'inventory.transfer',

  // Purchasing / AP
  PURCHASING_PO_CREATE: 'purchasing.po.create',
  PURCHASING_PO_APPROVE: 'purchasing.po.approve',
  PURCHASING_PO_SEND: 'purchasing.po.send',
  PURCHASING_INVOICE_MATCH: 'purchasing.invoice.match',
  PURCHASING_VIEW: 'purchasing.view',

  // Reporting
  REPORT_VIEW: 'report.view',
  REPORT_VIEW_OWN_SHIFT: 'report.view.own_shift',
  REPORT_EXPORT: 'report.export',

  // Audit / Discrepancies
  AUDIT_VIEW: 'audit.view',
  DISCREPANCY_VIEW: 'discrepancy.view',
  DISCREPANCY_RESOLVE: 'discrepancy.resolve',

  // Admin / Security
  ADMIN_USERS: 'admin.users',
  ADMIN_SETTINGS: 'admin.settings',
  ADMIN_DISCOUNT_RULES: 'admin.discount_rules',
  ADMIN_DEVICES: 'admin.devices',

  // Approvals queue (see and act)
  APPROVALS_VIEW: 'approvals.view',

  // Incidents
  INCIDENT_CREATE: 'incident.create',
  INCIDENT_VIEW: 'incident.view',

  // Host
  HOST_GUEST_LIST: 'host.guest_list',
  HOST_BOOKINGS: 'host.bookings',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Permissions that are "Approve" (high-risk) vs "Do" (execute) vs "See" (view only)
const APPROVE_PERMISSIONS = new Set<Permission>([
  PERMISSIONS.REFUND_APPROVE,
  PERMISSIONS.VOID_APPROVE,
  PERMISSIONS.DISCOUNT_APPROVE,
  PERMISSIONS.INVENTORY_RECEIVE_APPROVE,
  PERMISSIONS.INVENTORY_ADJUST_APPROVE,
  PERMISSIONS.PURCHASING_PO_APPROVE,
  PERMISSIONS.CASH_DRAWER_REVIEW,
  PERMISSIONS.DISCREPANCY_RESOLVE,
]);

/** Role → permissions (Do + Approve + See). Backend must mirror this map. */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    PERMISSIONS.SALE_CREATE,
    PERMISSIONS.REFUND_APPROVE,
    PERMISSIONS.VOID_APPROVE,
    PERMISSIONS.DISCOUNT_APPLY_AUTO,
    PERMISSIONS.DISCOUNT_APPLY_MANUAL,
    PERMISSIONS.DISCOUNT_APPROVE,
    PERMISSIONS.PROMO_MANAGE,
    PERMISSIONS.CASH_DRAWER_OPEN,
    PERMISSIONS.CASH_DRAWER_CLOSE,
    PERMISSIONS.CASH_DRAWER_REVIEW,
    PERMISSIONS.CASH_PAYOUT,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_RECEIVE,
    PERMISSIONS.INVENTORY_RECEIVE_POST,
    PERMISSIONS.INVENTORY_RECEIVE_APPROVE,
    PERMISSIONS.INVENTORY_COUNT,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_ADJUST_APPROVE,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.PURCHASING_VIEW,
    PERMISSIONS.PURCHASING_PO_CREATE,
    PERMISSIONS.PURCHASING_PO_APPROVE,
    PERMISSIONS.PURCHASING_PO_SEND,
    PERMISSIONS.PURCHASING_INVOICE_MATCH,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.DISCREPANCY_VIEW,
    PERMISSIONS.DISCREPANCY_RESOLVE,
    PERMISSIONS.ADMIN_USERS,
    PERMISSIONS.ADMIN_SETTINGS,
    PERMISSIONS.ADMIN_DISCOUNT_RULES,
    PERMISSIONS.ADMIN_DEVICES,
    PERMISSIONS.APPROVALS_VIEW,
    PERMISSIONS.INCIDENT_VIEW,
  ],
  senior_manager: [
    PERMISSIONS.SALE_CREATE,
    PERMISSIONS.REFUND_APPROVE,
    PERMISSIONS.VOID_APPROVE,
    PERMISSIONS.DISCOUNT_APPLY_AUTO,
    PERMISSIONS.DISCOUNT_APPLY_MANUAL,
    PERMISSIONS.DISCOUNT_APPROVE,
    PERMISSIONS.PROMO_MANAGE,
    PERMISSIONS.CASH_DRAWER_OPEN,
    PERMISSIONS.CASH_DRAWER_CLOSE,
    PERMISSIONS.CASH_DRAWER_REVIEW,
    PERMISSIONS.CASH_PAYOUT,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_RECEIVE,
    PERMISSIONS.INVENTORY_RECEIVE_POST,
    PERMISSIONS.INVENTORY_RECEIVE_APPROVE,
    PERMISSIONS.INVENTORY_COUNT,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_ADJUST_APPROVE,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.PURCHASING_VIEW,
    PERMISSIONS.PURCHASING_PO_CREATE,
    PERMISSIONS.PURCHASING_PO_SEND,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.DISCREPANCY_VIEW,
    PERMISSIONS.DISCREPANCY_RESOLVE,
    PERMISSIONS.APPROVALS_VIEW,
    PERMISSIONS.INCIDENT_VIEW,
  ],
  manager: [
    PERMISSIONS.SALE_CREATE,
    PERMISSIONS.REFUND_APPROVE,
    PERMISSIONS.VOID_APPROVE,
    PERMISSIONS.DISCOUNT_APPLY_AUTO,
    PERMISSIONS.DISCOUNT_APPLY_MANUAL,
    PERMISSIONS.DISCOUNT_APPROVE,
    PERMISSIONS.CASH_DRAWER_CLOSE,
    PERMISSIONS.CASH_DRAWER_REVIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.DISCREPANCY_VIEW,
    PERMISSIONS.APPROVALS_VIEW,
    PERMISSIONS.INCIDENT_VIEW,
  ],
  cashier: [
    PERMISSIONS.SALE_CREATE,
    PERMISSIONS.REFUND_REQUEST,
    PERMISSIONS.VOID_REQUEST,
    PERMISSIONS.DISCOUNT_APPLY_AUTO,
    PERMISSIONS.CASH_DRAWER_OPEN,
    PERMISSIONS.CASH_DRAWER_CLOSE,
    PERMISSIONS.REPORT_VIEW_OWN_SHIFT,
  ],
};

function getPermissions(role: UserRole): Set<Permission> {
  const list = ROLE_PERMISSIONS[role];
  return new Set(list ?? []);
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return getPermissions(role).has(permission);
}

export function canDo(role: UserRole, permission: Permission): boolean {
  return hasPermission(role, permission);
}

export function canApprove(role: UserRole, permission: Permission): boolean {
  return APPROVE_PERMISSIONS.has(permission) && hasPermission(role, permission);
}

export function canSee(role: UserRole, permission: Permission): boolean {
  return hasPermission(role, permission);
}

/** Check if user has any of the given permissions (for route/sidebar: show if any match). */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  const set = getPermissions(role);
  return permissions.some((p) => set.has(p));
}

/** Route path pattern -> permissions (user needs at least one to access). */
const ROUTE_PERMISSIONS: Array<{ pattern: RegExp | string; permissions: Permission[] }> = [
  { pattern: '/dashboard', permissions: [PERMISSIONS.REPORT_VIEW, PERMISSIONS.SALE_CREATE, PERMISSIONS.APPROVALS_VIEW, PERMISSIONS.AUDIT_VIEW] },
  { pattern: '/pos', permissions: [PERMISSIONS.SALE_CREATE] },
  { pattern: /^\/pos\/sales-history/, permissions: [PERMISSIONS.REPORT_VIEW_OWN_SHIFT] },
  { pattern: '/products', permissions: [PERMISSIONS.INVENTORY_VIEW] },
  { pattern: /^\/inventory/, permissions: [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_RECEIVE, PERMISSIONS.INVENTORY_COUNT, PERMISSIONS.INVENTORY_TRANSFER] },
  { pattern: '/refund-approvals', permissions: [PERMISSIONS.REFUND_APPROVE, PERMISSIONS.APPROVALS_VIEW] },
  { pattern: '/void-transactions', permissions: [PERMISSIONS.VOID_APPROVE, PERMISSIONS.APPROVALS_VIEW] },
  { pattern: '/voids-refunds', permissions: [PERMISSIONS.VOID_APPROVE, PERMISSIONS.REFUND_APPROVE, PERMISSIONS.APPROVALS_VIEW] },
  { pattern: /^\/suppliers/, permissions: [PERMISSIONS.PURCHASING_VIEW, PERMISSIONS.PURCHASING_PO_CREATE] },
  { pattern: /^\/reports/, permissions: [PERMISSIONS.REPORT_VIEW, PERMISSIONS.REPORT_EXPORT] },
  { pattern: '/shift-summary', permissions: [PERMISSIONS.CASH_DRAWER_REVIEW, PERMISSIONS.REPORT_VIEW] },
  { pattern: '/transactions', permissions: [PERMISSIONS.REPORT_VIEW, PERMISSIONS.AUDIT_VIEW] },
  { pattern: '/users', permissions: [PERMISSIONS.ADMIN_USERS] },
  { pattern: /^\/audit/, permissions: [PERMISSIONS.AUDIT_VIEW] },
  { pattern: '/variance-approvals', permissions: [PERMISSIONS.INVENTORY_RECEIVE_APPROVE, PERMISSIONS.DISCREPANCY_VIEW] },
  { pattern: '/notifications', permissions: [PERMISSIONS.APPROVALS_VIEW, PERMISSIONS.REPORT_VIEW] },
  { pattern: /^\/cash/, permissions: [PERMISSIONS.CASH_DRAWER_REVIEW, PERMISSIONS.REPORT_VIEW] },
  { pattern: /^\/admin/, permissions: [PERMISSIONS.ADMIN_SETTINGS, PERMISSIONS.ADMIN_DISCOUNT_RULES, PERMISSIONS.ADMIN_DEVICES] },
  { pattern: /^\/ops/, permissions: [PERMISSIONS.INVENTORY_RECEIVE, PERMISSIONS.APPROVALS_VIEW, PERMISSIONS.DISCREPANCY_VIEW, PERMISSIONS.INCIDENT_VIEW, PERMISSIONS.PROMO_MANAGE] },
];

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const perms = getPermissions(role);
  for (const { pattern, permissions } of ROUTE_PERMISSIONS) {
    const matches = typeof pattern === 'string' ? pathname === pattern || pathname.startsWith(pattern + '/') : pattern.test(pathname);
    if (matches) return permissions.some((p) => perms.has(p));
  }
  return true; // unknown route: allow (e.g. /)
}
