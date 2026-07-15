import express from "express";
import cors from "cors";
import multer from "multer";
import "./instrument.js";
import * as Sentry from "@sentry/node";

import { loginHandler, meHandler, requestPasswordResetHandler, updateProfileHandler, changePasswordHandler, authMiddleware } from "../auth.js";
import { requirePermission, requireAuth } from "../permissions.js";
import { listReports } from "./services/reports.service.js";
import { getServerCapabilities } from "./lib/server-capabilities.js";
import * as pos from "./services/pos.service.js";
import * as users from "./services/users.service.js";
import * as receiving from "./services/receiving.service.js";
import * as deliveries from "./services/deliveries.service.js";
import * as notifications from "./services/notifications.service.js";
import { sendError } from "./lib/api-error.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // --- Auth (no auth middleware) ---
  app.post("/api/auth/login", loginHandler);
  app.post("/api/auth/request-password-reset", requestPasswordResetHandler);
  app.get("/api/auth/me", authMiddleware, meHandler);
  app.patch("/api/auth/profile", authMiddleware, updateProfileHandler);
  app.patch("/api/auth/password", authMiddleware, changePasswordHandler);

  // --- Products (Supabase) ---
  app.get("/api/products", async (_req, res) => {
    try {
      const products = await pos.getAllProducts();
      res.json(products);
    } catch (e) {
      return sendError(res, "GET /api/products", e, { fallback: "Failed to load products" });
    }
  });

  app.get("/api/products/barcode/:barcode", async (req, res) => {
    const barcode = (req.params.barcode || "").trim();
    if (!barcode) return res.status(400).json({ error: "Barcode required" });
    try {
      const product = await pos.getProductByBarcode(barcode);
      if (!product) return res.status(404).json(null);
      res.json(product);
    } catch (e) {
      return sendError(res, "GET /api/products/barcode/:barcode", e, { fallback: "Failed to load product" });
    }
  });

  app.get("/api/products/search", async (req, res) => {
    const q = (req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    try {
      const products = await pos.searchProducts(q, limit);
      res.json(products);
    } catch (e) {
      return sendError(res, "GET /api/products/search", e, { fallback: "Failed to search products" });
    }
  });

  app.post("/api/products/seed-beverages", authMiddleware, async (req, res) => {
    if (!req.user || !["owner", "senior_manager"].includes(req.user.role)) {
      return res.status(403).json({ error: "Only owner or senior manager can seed products" });
    }
    try {
      const result = await pos.seedBeverageCatalog();
      res.json({ ok: true, ...result });
    } catch (e) {
      return sendError(res, "POST /api/products/seed-beverages", e, { fallback: "Failed to seed beverage catalog" });
    }
  });

  function canManageProducts(user) {
    return user && ["owner", "senior_manager"].includes(user.role);
  }

  app.post("/api/products", authMiddleware, async (req, res) => {
    if (!canManageProducts(req.user)) {
      return res.status(403).json({ error: "Only owner or senior manager can add products" });
    }
    try {
      const product = await pos.createProduct(req.body);
      res.status(201).json(product);
    } catch (e) {
      return sendError(res, "POST /api/products", e, { fallback: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", authMiddleware, async (req, res) => {
    if (!canManageProducts(req.user)) {
      return res.status(403).json({ error: "Only owner or senior manager can edit products" });
    }
    try {
      const product = await pos.updateProduct(req.params.id, req.body);
      res.json(product);
    } catch (e) {
      return sendError(res, "PUT /api/products/:id", e, { fallback: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", authMiddleware, async (req, res) => {
    if (!canManageProducts(req.user)) {
      return res.status(403).json({ error: "Only owner or senior manager can delete products" });
    }
    try {
      const result = await pos.deleteProduct(req.params.id);
      res.json({ ok: true, ...result });
    } catch (e) {
      return sendError(res, "DELETE /api/products/:id", e, { fallback: "Failed to delete product" });
    }
  });

  app.get("/api/inventory/balances", async (_req, res) => {
    try {
      const balances = await pos.getInventoryBalances();
      res.json(balances);
    } catch (e) {
      return sendError(res, "GET /api/inventory/balances", e, { fallback: "Failed to load inventory" });
    }
  });

  app.get("/api/categories", async (_req, res) => {
    try {
      const categories = await pos.getCategories();
      res.json(categories);
    } catch (e) {
      return sendError(res, "GET /api/categories", e, { fallback: "Failed to load categories" });
    }
  });

  // --- Transactions (real-time from database) ---
  app.get("/api/transactions", async (req, res) => {
    const cashierId = req.query.cashierId || null;
    try {
      const transactions = await pos.getAllTransactions(cashierId);
      res.json(transactions);
    } catch (e) {
      return sendError(res, "GET /api/transactions", e, { fallback: "Failed to load transactions" });
    }
  });

  // --- Sales (Supabase) — require auth + sale.create ---
  app.post("/api/sales", authMiddleware, requirePermission("sale.create"), async (req, res) => {
    const payload = req.body;
    if (!payload || !Array.isArray(payload.items)) {
      return res.status(400).json({ error: "Invalid sale payload: need items" });
    }
    if (payload.items.length === 0) {
      return res.status(400).json({ error: "Invalid sale payload: items cannot be empty" });
    }
    if (!Array.isArray(payload.payments) || payload.payments.length === 0) {
      return res.status(400).json({ error: "Invalid sale payload: payments required" });
    }

    const EPS = 0.01;
    const normalizedItems = [];
    for (const item of payload.items) {
      const productId = String(item?.productId ?? "").trim();
      const name = String(item?.name ?? "");
      const qty = Number(item?.qty ?? 0);
      const unitPrice = Number(item?.unitPrice ?? 0);
      const lineTotalSent = item?.lineTotal != null ? Number(item.lineTotal) : qty * unitPrice;
      const lineTotalComputed = qty * unitPrice;

      if (!productId) return res.status(400).json({ error: "Invalid sale payload: productId required" });
      if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: "Invalid quantity" });
      if (!Number.isFinite(unitPrice) || unitPrice < 0) return res.status(400).json({ error: "Invalid unitPrice" });
      if (Math.abs(lineTotalSent - lineTotalComputed) > EPS) {
        return res.status(400).json({ error: "Invalid lineTotal" });
      }

      normalizedItems.push({ productId, name, qty, unitPrice, lineTotal: lineTotalSent });
    }

    const computedSubtotal = normalizedItems.reduce((sum, it) => sum + it.lineTotal, 0);
    const sentSubtotal = Number(payload.subtotal ?? computedSubtotal);
    const sentVat = Number(payload.vat ?? 0);
    const sentTotal = Number(payload.total ?? computedSubtotal + sentVat);

    if (Math.abs(sentSubtotal - computedSubtotal) > EPS) {
      return res.status(400).json({ error: "Invalid sale totals: subtotal mismatch" });
    }
    if (sentVat < 0 || sentTotal < 0 || sentSubtotal < 0) {
      return res.status(400).json({ error: "Invalid sale totals" });
    }
    if (Math.abs(sentTotal - (computedSubtotal + sentVat)) > EPS) {
      return res.status(400).json({ error: "Invalid sale totals: total mismatch" });
    }

    const firstPayment = payload.payments[0] ?? {};
    const method = String(firstPayment.method ?? "").toLowerCase();
    if (!method) return res.status(400).json({ error: "Invalid payment method" });

    if (method === "cash") {
      const cashReceived = Number(firstPayment.cashReceived);
      const changeGiven = Number(firstPayment.change);
      if (!Number.isFinite(cashReceived)) return res.status(400).json({ error: "Invalid cashReceived" });
      if (!Number.isFinite(changeGiven)) return res.status(400).json({ error: "Invalid change" });
      if (cashReceived + EPS < sentTotal) return res.status(400).json({ error: "cashReceived is less than total" });
      const expectedChange = cashReceived - sentTotal;
      if (Math.abs(changeGiven - expectedChange) > EPS) return res.status(400).json({ error: "Invalid change" });
    } else {
      // card / eft / etc: amount must match total
      const amount = Number(firstPayment.amount);
      if (!Number.isFinite(amount)) return res.status(400).json({ error: "Invalid payment amount" });
      if (Math.abs(amount - sentTotal) > EPS) return res.status(400).json({ error: "Payment amount must equal total" });
    }

    const cashierId = req.user.id;
    const cashierName = req.user.name || "";

    const payloadWithActor = {
      ...payload,
      idempotencyKey: req.headers["idempotency-key"] || payload.idempotencyKey,
      cashierId,
      cashierName,
      items: normalizedItems,
      subtotal: computedSubtotal,
      vat: sentVat,
      total: computedSubtotal + sentVat,
    };

    try {
      const result = await pos.createSale(payloadWithActor, cashierName);
      if (result?.created) {
        await pos.writeAudit({
          action: "sale_completed",
          actorId: req.user.id,
          actorRole: req.user.role,
          after: {
            saleId: result.id,
            cashierId: req.user.id,
            subtotal: payloadWithActor.subtotal,
            total: payloadWithActor.total,
            vat: payloadWithActor.vat,
            itemsCount: payloadWithActor.items.length,
            payments: payloadWithActor.payments,
          },
          timestamp: result.createdAt,
        });
      }
      res.status(201).json({ id: result.id, createdAt: result.createdAt });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes("Insufficient stock") ||
        msg.includes("Invalid quantity") ||
        msg.includes("Invalid sale items") ||
        msg.includes("Invalid lineTotal") ||
        msg.includes("Invalid productId")
      ) {
        return res.status(400).json({ error: msg });
      }
      return sendError(res, "POST /api/sales", e, { fallback: "Failed to create sale" });
    }
  });

  // --- Help requests (cashier calls manager) — require auth ---
  app.post("/api/help-requests", authMiddleware, requireAuth, async (req, res) => {
    const body = req.body || {};
    const cashierId = req.user.id;
    try {
      const { id, createdAt } = await pos.createHelpRequest({
        cashierId,
        cashierName: req.user.name || cashierId,
        message: body.message || "",
      });
      res.status(201).json({ id, createdAt });
    } catch (e) {
      return sendError(res, "POST /api/help-requests", e, { fallback: "Failed to create help request" });
    }
  });

  app.get("/api/help-requests", async (req, res) => {
    const status = req.query.status || null;
    try {
      const list = await pos.getHelpRequests(status);
      res.json(list);
    } catch (e) {
      return sendError(res, "GET /api/help-requests", e, { fallback: "Failed to load help requests" });
    }
  });

  app.patch("/api/help-requests/:id/acknowledge", authMiddleware, requireAuth, async (req, res) => {
    const { id } = req.params;
    const acknowledgedBy = req.user.name || req.user.id;
    if (!id) return res.status(400).json({ error: "id required" });
    try {
      await pos.markHelpRequestAcknowledged(id, acknowledgedBy);
      res.json({ ok: true });
    } catch (e) {
      return sendError(res, "PATCH /api/help-requests/:id/acknowledge", e, { fallback: "Failed to acknowledge" });
    }
  });

  // --- Notifications (unified help + stock/variance alerts) ---
  app.get("/api/notifications", authMiddleware, requireAuth, async (_req, res) => {
    try {
      const list = await notifications.listNotifications();
      res.json(list);
    } catch (e) {
      return sendError(res, "GET /api/notifications", e, { fallback: "Failed to load notifications" });
    }
  });

  app.get("/api/notifications/unread-count", authMiddleware, requireAuth, async (_req, res) => {
    try {
      const count = await notifications.getUnreadNotificationCount();
      res.json({ count });
    } catch (e) {
      return sendError(res, "GET /api/notifications/unread-count", e, { fallback: "Failed to load unread count" });
    }
  });

  app.patch("/api/notifications/:id/read", authMiddleware, requireAuth, async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "id required" });
    try {
      const result = await notifications.markNotificationRead(id);
      res.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("not found")) return res.status(404).json({ error: msg });
      return sendError(res, "PATCH /api/notifications/:id/read", e, { fallback: "Failed to mark as read" });
    }
  });

  app.patch("/api/notifications/:id/unread", authMiddleware, requireAuth, async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "id required" });
    try {
      const result = await notifications.markNotificationUnread(id);
      res.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("not found")) return res.status(404).json({ error: msg });
      return sendError(res, "PATCH /api/notifications/:id/unread", e, { fallback: "Failed to mark as unread" });
    }
  });

  app.post("/api/notifications/mark-all-read", authMiddleware, requireAuth, async (_req, res) => {
    try {
      const result = await notifications.markAllNotificationsRead();
      res.json(result);
    } catch (e) {
      return sendError(res, "POST /api/notifications/mark-all-read", e, { fallback: "Failed to mark all as read" });
    }
  });

  // --- Void sale (manager approval) ---
  app.post("/api/sales/:id/void", authMiddleware, requirePermission("void.approve"), async (req, res) => {
    const { id } = req.params;
    const { reasonCode, reasonText } = req.body || {};
    if (!id) return res.status(400).json({ error: "Sale id required" });
    try {
      const result = await pos.voidSale(id, {
        approverId: req.user.id,
        approverRole: req.user.role,
        reasonCode: reasonCode || reasonText || "void_approved",
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      res.json({ ok: true });
    } catch (e) {
      return sendError(res, "POST /api/sales/:id/void", e, { fallback: "Failed to void sale" });
    }
  });

  // --- Refund sale (manager approval) ---
  app.post("/api/sales/:id/refund", authMiddleware, requirePermission("refund.approve"), async (req, res) => {
    const { id } = req.params;
    const { reasonCode, reasonText, amount } = req.body || {};
    if (!id) return res.status(400).json({ error: "Sale id required" });
    try {
      const result = await pos.refundSale(id, {
        approverId: req.user.id,
        approverRole: req.user.role,
        reasonCode: reasonCode || reasonText || "refund_approved",
        amount,
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      res.json({ ok: true });
    } catch (e) {
      return sendError(res, "POST /api/sales/:id/refund", e, { fallback: "Failed to process refund" });
    }
  });

  // --- Inventory: receive stock ---
  app.post("/api/inventory/receive", authMiddleware, requirePermission("inventory.receive.post"), async (req, res) => {
    const { productId, qty, location, invoiceNumber } = req.body || {};
    if (!productId || qty == null) return res.status(400).json({ error: "productId and qty required" });
    try {
      const result = await pos.receiveStock(productId, qty, location, {
        actorId: req.user.id,
        actorRole: req.user.role,
        invoiceNumber: invoiceNumber || null,
        idempotencyKey: req.headers["idempotency-key"] || null,
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      res.status(201).json(result);
    } catch (e) {
      return sendError(res, "POST /api/inventory/receive", e, { fallback: "Failed to receive stock" });
    }
  });

  // --- Inventory: stock adjustment ---
  app.post("/api/inventory/adjustments", authMiddleware, requirePermission("inventory.adjust"), async (req, res) => {
    const { productId, delta, reasonCode } = req.body || {};
    if (!productId || delta == null) return res.status(400).json({ error: "productId and delta required" });
    try {
      const result = await pos.postStockAdjustment(productId, delta, reasonCode || "adjustment", {
        actorId: req.user.id,
        actorRole: req.user.role,
        approverId: req.user.id,
        approverRole: req.user.role,
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      res.status(201).json(result);
    } catch (e) {
      return sendError(res, "POST /api/inventory/adjustments", e, { fallback: "Failed to post adjustment" });
    }
  });

  // --- Audit — require auth; use identity from token ---
  app.post("/api/audit", authMiddleware, requireAuth, async (req, res) => {
    const entry = req.body;
    if (!entry || !entry.action) {
      return res.status(400).json({ error: "Invalid audit entry: need action" });
    }
    try {
      await pos.writeAudit({
        ...entry,
        actorId: req.user.id,
        actorRole: req.user.role,
      });
      res.status(201).json({ ok: true });
    } catch (e) {
      return sendError(res, "POST /api/audit", e, { fallback: "Failed to write audit" });
    }
  });

  // --- User management (owner) ---
  app.get("/api/users", authMiddleware, requirePermission("admin.users"), async (_req, res) => {
    try {
      res.json(await users.listUsers());
    } catch (e) {
      return sendError(res, "GET /api/users", e, { fallback: "Failed to load users" });
    }
  });

  app.post("/api/users", authMiddleware, requirePermission("admin.users"), async (req, res) => {
    const idempotencyKey = req.headers["idempotency-key"] || null;
    try {
      const created = await users.createUser(req.body || {}, { idempotencyKey });
      res.status(201).json(created);
    } catch (e) {
      return sendError(res, "POST /api/users", e, { fallback: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", authMiddleware, requirePermission("admin.users"), async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};
    if (body.active === false && req.user?.id === id) {
      return res.status(400).json({ error: "You cannot deactivate your own account" });
    }
    try {
      res.json(await users.updateUser(id, body));
    } catch (e) {
      return sendError(res, "PATCH /api/users/:id", e, { fallback: "Failed to update user" });
    }
  });

  app.patch("/api/users/:id/password", authMiddleware, requirePermission("admin.users"), async (req, res) => {
    const { id } = req.params;
    const password = req.body?.password;
    try {
      await users.updateUserPassword(id, password);
      res.json({ ok: true });
    } catch (e) {
      return sendError(res, "PATCH /api/users/:id/password", e, { fallback: "Failed to change password" });
    }
  });

  app.post("/api/users/:id/send-welcome", authMiddleware, requirePermission("admin.users"), async (req, res) => {
    const { id } = req.params;
    try {
      const result = await users.sendUserWelcomeEmail(id);
      res.json(result);
    } catch (e) {
      return sendError(res, "POST /api/users/:id/send-welcome", e, { fallback: "Failed to send welcome email" });
    }
  });

  app.delete("/api/users/:id", authMiddleware, requirePermission("admin.users"), async (req, res) => {
    const { id } = req.params;
    if (req.user?.id === id) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }
    try {
      await users.deleteUser(id);
      res.json({ ok: true });
    } catch (e) {
      return sendError(res, "DELETE /api/users/:id", e, { fallback: "Failed to delete user" });
    }
  });

  // --- Settings (thresholds and venue config) ---
  app.get("/api/settings", authMiddleware, async (_req, res) => {
    try {
      const settings = await pos.getSettings();
      res.json(settings);
    } catch (e) {
      return sendError(res, "GET /api/settings", e, { fallback: "Failed to load settings" });
    }
  });

  app.put("/api/settings", authMiddleware, requirePermission("admin.settings"), async (req, res) => {
    const body = req.body || {};
    if (typeof body !== "object") return res.status(400).json({ error: "Settings must be an object" });
    try {
      for (const [key, value] of Object.entries(body)) {
        if (key && value !== undefined) await pos.setSetting(key, String(value));
      }
      res.json(await pos.getSettings());
    } catch (e) {
      return sendError(res, "PUT /api/settings", e, { fallback: "Failed to save settings" });
    }
  });

  // --- Discrepancy cases ---
  app.get("/api/discrepancies", authMiddleware, requirePermission("discrepancy.view"), async (req, res) => {
    const status = req.query.status || null;
    try {
      const list = await pos.getDiscrepancyCases(status);
      res.json(list);
    } catch (e) {
      return sendError(res, "GET /api/discrepancies", e, { fallback: "Failed to load discrepancies" });
    }
  });

  app.post("/api/discrepancies", authMiddleware, requirePermission("discrepancy.resolve"), async (req, res) => {
    const { type, severity, notes } = req.body || {};
    try {
      const { id, createdAt } = await pos.createDiscrepancyCase({
        type: type || "cash",
        severity: severity || "medium",
        createdBy: req.user.id,
        notes: notes || null,
      });
      res.status(201).json({ id, createdAt });
    } catch (e) {
      return sendError(res, "POST /api/discrepancies", e, { fallback: "Failed to create discrepancy case" });
    }
  });

  app.patch("/api/discrepancies/:id/close", authMiddleware, requirePermission("discrepancy.resolve"), async (req, res) => {
    const { id } = req.params;
    const { resolutionNotes } = req.body || {};
    if (!id) return res.status(400).json({ error: "id required" });
    try {
      await pos.closeDiscrepancyCase(id, req.user.id, resolutionNotes);
      res.json({ ok: true });
    } catch (e) {
      return sendError(res, "PATCH /api/discrepancies/:id/close", e, { fallback: "Failed to close case" });
    }
  });

  // --- Inventory receiving (delivery intakes + blind transfer copies) ---
  app.get("/api/intakes/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const intake = await receiving.getIntakeById(id);
      if (!intake) return res.status(404).json(null);
      res.json(intake);
    } catch (e) {
      return sendError(res, "GET /api/intakes/:id", e, { fallback: "Failed to load intake" });
    }
  });

  app.get("/api/blind-copies/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const copy = await receiving.getBlindCopyById(id);
      if (!copy) return res.status(404).json(null);
      res.json(copy);
    } catch (e) {
      return sendError(res, "GET /api/blind-copies/:id", e, { fallback: "Failed to load blind copy" });
    }
  });

  app.post("/api/intakes/draft", authMiddleware, requirePermission("inventory.receive.post"), async (req, res) => {
    const body = req.body || {};
    try {
      if (!body.supplier || !body.invoiceNumber || !body.deliveryReference || !body.deliveryDate || !body.branchSite) {
        return res.status(400).json({ error: "Missing required intake fields" });
      }
      if (!body.receiveIntoLocation || !body.receivedBy) return res.status(400).json({ error: "Missing receiveIntoLocation/receivedBy" });
      const result = await receiving.saveIntakeDraft({ payload: body, user: req.user });
      res.status(201).json(result);
    } catch (e) {
      return sendError(res, "POST /api/intakes/draft", e, { fallback: "Failed to save intake draft" });
    }
  });

  app.put("/api/intakes/:id/draft", authMiddleware, requirePermission("inventory.receive.post"), async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};
    try {
      body.id = body.id || id;
      const result = await receiving.saveIntakeDraft({ payload: body, user: req.user });
      res.json(result);
    } catch (e) {
      return sendError(res, "PUT /api/intakes/:id/draft", e, { fallback: "Failed to update intake draft" });
    }
  });

  app.post("/api/intakes/:id/expected-lines", authMiddleware, requirePermission("inventory.receive.post"), async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};
    try {
      if (!Array.isArray(body.lines)) return res.status(400).json({ error: "lines must be an array" });
      if (!body.lines.length) return res.status(400).json({ error: "lines cannot be empty" });
      const result = await receiving.saveExpectedLines(id, body.lines);
      res.json(result);
    } catch (e) {
      return sendError(res, "POST /api/intakes/:id/expected-lines", e, { fallback: "Failed to save expected lines" });
    }
  });

  app.post("/api/intakes/:id/verification", authMiddleware, requirePermission("inventory.receive.post"), async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};
    try {
      if (!Array.isArray(body.lines)) return res.status(400).json({ error: "lines must be an array" });
      if (!body.status) return res.status(400).json({ error: "status required" });
      const result = await receiving.saveVerification(id, body.lines, body.status);
      res.json(result);
    } catch (e) {
      return sendError(res, "POST /api/intakes/:id/verification", e, { fallback: "Failed to save verification" });
    }
  });

  app.post("/api/intakes/:id/confirm", authMiddleware, requirePermission("inventory.receive.approve"), async (req, res) => {
    const { id } = req.params;
    try {
      const result = await receiving.confirmIntake(id, { user: req.user });
      res.json(result);
    } catch (e) {
      return sendError(res, "POST /api/intakes/:id/confirm", e, { fallback: "Failed to confirm intake" });
    }
  });

  app.post("/api/intakes/:id/blind-copy", authMiddleware, requirePermission("inventory.receive.approve"), async (req, res) => {
    const { id } = req.params;
    try {
      const result = await receiving.generateBlindCopy(id, { user: req.user });
      res.json(result);
    } catch (e) {
      return sendError(res, "POST /api/intakes/:id/blind-copy", e, { fallback: "Failed to generate blind copy" });
    }
  });

  app.post("/api/blind-copies/:id/issue", authMiddleware, requirePermission("inventory.receive.approve"), async (req, res) => {
    const { id } = req.params;
    try {
      const result = await receiving.issueBlindCopy(id, { user: req.user });
      res.json(result);
    } catch (e) {
      return sendError(res, "POST /api/blind-copies/:id/issue", e, { fallback: "Failed to issue blind copy" });
    }
  });

  // --- Delivery records with document upload ---
  app.get("/api/deliveries", authMiddleware, requireAuth, async (_req, res) => {
    try {
      res.json(await deliveries.listDeliveryRecords());
    } catch (e) {
      return sendError(res, "GET /api/deliveries", e, { fallback: "Failed to load deliveries" });
    }
  });

  app.post(
    "/api/deliveries",
    authMiddleware,
    requirePermission("inventory.receive.post"),
    upload.fields([
      { name: "invoice", maxCount: 1 },
      { name: "pod", maxCount: 1 },
    ]),
    async (req, res) => {
      const invoiceFile = req.files?.invoice?.[0];
      const podFile = req.files?.pod?.[0];
      const { poRef, supplier, invoiceRef } = req.body || {};
      try {
        const created = await deliveries.createDeliveryRecord({
          poRef,
          supplier,
          invoiceRef,
          invoiceFile,
          podFile,
          uploadedBy: req.user?.id,
        });
        res.status(201).json(created);
      } catch (e) {
        return sendError(res, "POST /api/deliveries", e, { fallback: "Failed to record delivery" });
      }
    }
  );

  app.get("/api/deliveries/:id/documents/:type", authMiddleware, requireAuth, async (req, res) => {
    const { id, type } = req.params;
    if (!["invoice", "pod"].includes(type)) {
      return res.status(400).json({ error: "Invalid document type" });
    }
    try {
      const result = await deliveries.getDeliveryDocumentUrl(id, type);
      res.json(result);
    } catch (e) {
      return sendError(res, "GET /api/deliveries/:id/documents/:type", e, { fallback: "Failed to load document" });
    }
  });

  // Health
  app.get("/health", (_req, res) => res.json({ ok: true, ...getServerCapabilities() }));
  app.get("/api/health", (_req, res) => res.json({ ok: true, ...getServerCapabilities() }));

  // Temporary: verify Sentry API capture (remove after confirming Issues)
  app.get("/api/debug-sentry", (_req, _res) => {
    throw new Error("King G API Sentry example error");
  });

  // --- Reports (Supabase-backed; optional during migration) ---
  app.get("/api/reports", async (req, res) => {
    try {
      const limit = req.query.limit;
      const reports = await listReports({ limit });
      res.json(reports);
    } catch (e) {
      return sendError(res, "GET /api/reports", e, { fallback: "Failed to load reports" });
    }
  });

  Sentry.setupExpressErrorHandler(app);

  // Final handler after Sentry — safe JSON response (no stack / request body)
  app.use((error, _request, response, _next) => {
    console.error(error);
    if (response.headersSent) return;
    response.status(500).json({
      error: "Internal server error",
    });
  });

  return app;
}

export default createApp();

