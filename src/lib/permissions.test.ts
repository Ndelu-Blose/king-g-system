import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  hasAnyPermission,
  canApprove,
  canAccessRoute,
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from './permissions';
import type { UserRole } from './mock-data';

describe('permissions', () => {
  it('owner has sale.create and refund.approve', () => {
    expect(hasPermission('owner', PERMISSIONS.SALE_CREATE)).toBe(true);
    expect(hasPermission('owner', PERMISSIONS.REFUND_APPROVE)).toBe(true);
  });

  it('cashier has sale.create and refund.request but not refund.approve', () => {
    expect(hasPermission('cashier', PERMISSIONS.SALE_CREATE)).toBe(true);
    expect(hasPermission('cashier', PERMISSIONS.REFUND_REQUEST)).toBe(true);
    expect(hasPermission('cashier', PERMISSIONS.REFUND_APPROVE)).toBe(false);
  });

  it('manager can approve void', () => {
    expect(hasPermission('manager', PERMISSIONS.VOID_APPROVE)).toBe(true);
    expect(canApprove('manager', PERMISSIONS.VOID_APPROVE)).toBe(true);
  });

  it('senior_manager has report.view and audit.view', () => {
    expect(hasPermission('senior_manager', PERMISSIONS.REPORT_VIEW)).toBe(true);
    expect(hasPermission('senior_manager', PERMISSIONS.AUDIT_VIEW)).toBe(true);
  });

  it('hasAnyPermission returns true if role has at least one of the permissions', () => {
    expect(hasAnyPermission('cashier', [PERMISSIONS.REPORT_VIEW, PERMISSIONS.REPORT_VIEW_OWN_SHIFT])).toBe(true);
    expect(hasAnyPermission('cashier', [PERMISSIONS.REPORT_VIEW])).toBe(false);
    expect(hasAnyPermission('owner', [PERMISSIONS.ADMIN_USERS])).toBe(true);
  });

  it('canAccessRoute allows cashier to access /pos', () => {
    expect(canAccessRoute('cashier', '/pos')).toBe(true);
    expect(canAccessRoute('cashier', '/pos/sales-history')).toBe(true);
  });

  it('canAccessRoute denies cashier from /users (admin)', () => {
    expect(canAccessRoute('cashier', '/users')).toBe(false);
  });

  it('canAccessRoute allows owner to access /audit and /users', () => {
    expect(canAccessRoute('owner', '/audit')).toBe(true);
    expect(canAccessRoute('owner', '/users')).toBe(true);
  });

  it('every current role has at least one permission', () => {
    const roles: UserRole[] = ['owner', 'senior_manager', 'manager', 'cashier'];
    for (const role of roles) {
      const perms = ROLE_PERMISSIONS[role];
      expect(Array.isArray(perms)).toBe(true);
      expect(perms.length).toBeGreaterThan(0);
    }
  });
});
