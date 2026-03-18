# Roles and Permissions (Do / Approve / See)

This document describes the role catalogue and permission matrix for King G POS, aligned with premium-lounge RBAC.

## Role catalogue

| Role | Label | Description |
|------|--------|-------------|
| owner | Owner | Ultimate control; admin, security, financial visibility |
| general_manager | General Manager | Full operational control; limited system security changes |
| senior_manager | Senior Manager | Service + stock + approvals; primary on-site control |
| manager | Supervisor | Floor-level approvals (PIN overrides), shift interventions |
| cashier | Cashier / Bartender | Fast sales; requests approvals; limited reporting |
| stock_clerk | Stock Clerk | Receiving, transfers, counts; cannot approve write-offs |
| host | Host | Seating/reservations/guest flow; minimal POS financial |
| security | Security | Incident capture, banned list, limited monitoring |
| accountant | Accountant | Reporting, reconciliation, vendor invoices; no POS selling |

## Permission constants

See `src/lib/permissions.ts` for the full list. Key permissions:

- **Sales:** `sale.create`
- **Refund/Void:** `refund.request`, `refund.approve`, `void.request`, `void.approve`
- **Discounts:** `discount.apply.auto`, `discount.apply.manual`, `discount.approve`, `promo.manage`
- **Cash:** `cash.drawer.open`, `cash.drawer.close`, `cash.drawer.review`, `cash.payout`
- **Inventory:** `inventory.view`, `inventory.receive`, `inventory.receive.post`, `inventory.receive.approve`, `inventory.count`, `inventory.adjust`, `inventory.adjust.approve`, `inventory.transfer`
- **Purchasing:** `purchasing.po.create`, `purchasing.po.approve`, `purchasing.po.send`, `purchasing.invoice.match`, `purchasing.view`
- **Reporting:** `report.view`, `report.view.own_shift`, `report.export`
- **Audit:** `audit.view`, `discrepancy.view`, `discrepancy.resolve`
- **Admin:** `admin.users`, `admin.settings`, `admin.discount_rules`, `admin.devices`
- **Approvals:** `approvals.view`
- **Incidents:** `incident.create`, `incident.view`
- **Host:** `host.guest_list`, `host.bookings`

## Do / Approve / See matrix (summary)

- **Do:** execute the action (e.g. create sale, receive stock).
- **Approve:** authorise high-risk actions (refunds, voids, manual discounts, write-offs).
- **See:** view data only (reports, audit, discrepancies).

Approval permissions (require step-up e.g. PIN where configured): `refund.approve`, `void.approve`, `discount.approve`, `inventory.receive.approve`, `inventory.adjust.approve`, `purchasing.po.approve`, `cash.drawer.review`, `discrepancy.resolve`.

## Enforcement

- **UI:** Sidebar and routes are gated by `hasAnyPermission(role, requiredPermissions)`. Unauthorised modules are hidden.
- **API:** Every write endpoint uses `authMiddleware` and `requirePermission(permission)`. Identity comes from the JWT; never trust `actorId`/`actorRole` from the request body.
- **Audit:** All approval and config changes are logged with `actorId`, `actorRole`, and when applicable `approverId`, `reasonCode`, `entityType`, `entityId`.

## Sync with backend

The backend permission map in `server/permissions.js` must stay in sync with `src/lib/permissions.ts`. When adding or changing a permission or role, update both files.
