# King G – System Overview

**One place that explains how your app works.** Use this when you’re lost or when someone asks “what can who do?”

---

## 1. Roles (who is who)

| Role            | Who uses it   | Purpose |
|-----------------|---------------|---------|
| **Owner**       | Business owner| Full control: sales, inventory, suppliers, cash, reports, audit, users, settings. |
| **Senior Manager** | Thabo M.   | Day-to-day ops: approvals, receive stock, adjustments, discrepancies, promotions, reports, incident log. Controls inventory + floor risk. |
| **Manager**     | Lerato K.     | Same sidebar as Senior Manager (approvals, stock, discrepancies, reports, promotions, incident log). |
| **Cashier**     | Sipho N.      | POS only: scan, sell, take payment, print receipt, open/close shift, sales history, call for help. |

**Where it’s defined:** `src/lib/mock-data.ts` (`UserRole`, `mockUsers`), `src/lib/auth-context.tsx` (login sets `user.role`).

**Who can go where:** `src/components/AppLayout.tsx` (redirects by role), `src/lib/cashier-rules.ts` (cashier allowed paths).

---

## 2. What each role sees (sidebar)

### Owner
- **Dashboard** · **Alerts & Help**
- **Sales:** Transactions, Voids & Refunds
- **Inventory:** Stock Overview, Movements, Stock Takes, Adjustments
- **Suppliers:** Suppliers, Purchase Orders, Deliveries & Invoices, Variance Cases
- **Cash:** Reconciliation, Bank Deposits
- **Reports:** Sales, Inventory, Financial, Audit
- **Security & Audit:** Audit Log, User Activity
- **Owner (block):** Users & Roles, System Settings, Discount Rules, Devices & Terminals

### Senior Manager / Manager
- **Dashboard** · **Approvals** · **Alerts & Help**
- **Stock (expandable):** Receive Delivery, Stock Take, Stock Adjustments, Stock Movement History
- **Discrepancies** · **Reports** · **Promotions** · **Incident Log**

### Cashier
- **POS Terminal** · **Sales History**
- Open Shift · End shift / Cash-up · Help / Support

**Where it’s defined:** `src/components/AppSidebar.tsx` (all three sidebars).

---

## 3. Route access (who can open which URL)

| Route | Owner | Manager / Senior Manager | Cashier |
|-------|-------|--------------------------|---------|
| `/login` | ✓ | ✓ | ✓ |
| `/dashboard` | ✓ | ✓ | ✗ → `/pos` |
| `/notifications` | ✓ | ✓ | ✗ → `/pos` |
| `/pos`, `/pos/sales-history` | ✗ → `/dashboard` | ✗ → `/dashboard` | ✓ |
| `/ops/*` (approvals, receive-stock, discrepancies, incidents, promotions) | ✓ (owner sees more) | ✓ | ✗ → `/pos` |
| `/inventory/*` | ✓ | ✓ | ✗ → `/pos` |
| `/reports`, `/reports/:slug` | ✓ | ✓ | ✗ → `/pos` |
| `/suppliers/*`, `/cash/*`, `/audit/*`, `/users`, `/admin/*` | ✓ | ✗ → `/dashboard` | ✗ → `/pos` |

**Enforcement:**  
- Cashier: `isCashierAllowedPath()` in `AppLayout` and `cashier-rules.ts` (only `/pos` and `/pos/*`).  
- Manager/Senior Manager: `isManagerAllowedPath` in `AppLayout` (dashboard, notifications, reports, inventory, ops, etc.).  
- Owner: can access everything under `AppLayout`.

---

## 4. Main flows (what happens when)

### POS (Cashier)
1. Log in → land on `/pos`.
2. Open shift (if not open).
3. Scan/search items → cart → Payment → receipt; stock decreases on payment.
4. Sales History = own sales; Help = request manager support.

**Relevant:** `src/pages/POS.tsx`, `src/contexts/CartContext.tsx`, `src/contexts/ShiftContext.tsx`, `src/contexts/InventoryContext.tsx`, `cashier.md`.

### Receive delivery (Senior Manager / Manager)
1. **Stock → Receive Delivery** → `/ops/receive-stock`.
2. **Step 1:** Supplier, invoice number, delivery reference.
3. **Step 2:** Add expected lines (product, qty, optional cost/batch/date). Stock does **not** change yet.
4. **Step 3:** Physical verification: enter actual count; if mismatch, add discrepancy reason (short delivery, damaged, counting error).
5. **Step 4:** **Confirm Stock Intake** → stock increases; audit-style message (supplier, invoice, manager). No edit/delete of past intakes (owner-only for reverse/audit).

**Relevant:** `src/pages/ops/ReceiveStockPage.tsx`, `senior-manager.md`.

### Approvals (Manager / Senior Manager)
- **Approvals** → `/ops/approvals`: queue of pending removals, refunds, voids. Approve/reject with reason.

**Relevant:** `src/pages/ops/ApprovalsQueuePage.tsx`.

### Stock adjustments & stock take
- **Stock Adjustments** (`/inventory/stock-adjustments`): adjust quantities with reason.
- **Stock Take** (`/inventory/stock-take`): count and reconcile; managers can access it (redirect that blocked it was removed).

**Relevant:** `src/pages/StockAdjustments.tsx`, `src/pages/StockTake.tsx`, `InventoryContext`.

---

## 5. Where important logic lives

| What | Where |
|------|--------|
| **Auth & role** | `src/lib/auth-context.tsx`, `src/lib/mock-data.ts` (users, roles) |
| **Who can open which route** | `src/components/AppLayout.tsx`, `src/lib/cashier-rules.ts` |
| **Sidebar (what each role sees)** | `src/components/AppSidebar.tsx` |
| **All routes** | `src/App.tsx` (Routes) |
| **Inventory (stock levels, receive, transfer, stock take)** | `src/contexts/InventoryContext.tsx` |
| **Cart & POS** | `src/contexts/CartContext.tsx`, `src/pages/POS.tsx` |
| **Shifts** | `src/contexts/ShiftContext.tsx` |
| **Purchase orders / suppliers** | `src/contexts/PurchaseOrderContext.tsx`, `src/pages/Suppliers.tsx` |
| **Reports list & slugs** | `src/lib/report-config.ts` |

---

## 6. Docs that describe specific roles/flows

- **Cashier (POS, scan-first, payment):** `cashier.md`
- **Senior Manager (responsibilities, stock intake, sidebar, controls):** `senior-manager.md`
- **This system map:** `SYSTEM.md`

---

## 7. Quick reference: path → page

| Path | Page / purpose |
|------|-----------------|
| `/` | Redirect to `/login` |
| `/login` | Login |
| `/dashboard` | Dashboard |
| `/pos` | POS terminal |
| `/pos/sales-history` | Cashier sales history |
| `/ops/approvals` | Approvals queue |
| `/ops/receive-stock` | Receive delivery (4-step intake) |
| `/ops/discrepancies` | Discrepancies |
| `/ops/incidents` | Incident log |
| `/ops/promotions` | Promotions (placeholder) |
| `/ops/shifts` | Shifts / attendance |
| `/inventory` | Stock overview |
| `/inventory/movements` | Stock movement history |
| `/inventory/stock-take` | Stock take |
| `/inventory/stock-adjustments` | Stock adjustments |
| `/inventory/transfer` | Transfer stock |
| `/inventory/lounge`, `/inventory/warehouse` | Location views |
| `/suppliers`, `/suppliers/purchase-orders`, `/suppliers/deliveries` | Suppliers & deliveries |
| `/variance-approvals` | Variance cases |
| `/reports` | Reports list |
| `/reports/:reportSlug` | Single report (e.g. daily-sales, stock-level) |
| `/cash/reconciliation`, `/cash/bank-deposits` | Cash |
| `/audit`, `/audit/user-activity` | Audit |
| `/notifications` | Alerts & Help |
| `/users` | Users & roles (owner) |
| `/admin/settings`, `/admin/discount-rules`, `/admin/devices` | Admin (owner) |
| `/transactions`, `/voids-refunds`, `/refund-approvals`, `/void-transactions` | Sales/refunds/voids |

Use this file when you need to “make sense” of the system or explain it to someone else.
