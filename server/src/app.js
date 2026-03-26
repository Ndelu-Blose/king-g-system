import express from "express";
import cors from "cors";

import { loginHandler, authMiddleware } from "../auth.js";
import { requirePermission, requireAuth } from "../permissions.js";
import { listReports } from "./services/reports.service.js";
import * as pos from "./services/pos.service.js";
import * as receiving from "./services/receiving.service.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // --- Auth (no auth middleware) ---
  app.post("/api/auth/login", loginHandler);

  // --- Products (Supabase) ---
  app.get("/api/products", async (_req, res) => {
    try {
      const products = await pos.getAllProducts();
      res.json(products);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load products" });
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
      console.error(e);
      res.status(500).json({ error: "Failed to load product" });
    }
  });

  app.get("/api/products/search", async (req, res) => {
    const q = (req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    try {
      const products = await pos.searchProducts(q, limit);
      res.json(products);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to search products" });
    }
  });

  app.get("/api/categories", async (_req, res) => {
    try {
      const categories = await pos.getCategories();
      res.json(categories);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load categories" });
    }
  });

  // --- Transactions (real-time from database) ---
  app.get("/api/transactions", async (req, res) => {
    const cashierId = req.query.cashierId || null;
    try {
      const transactions = await pos.getAllTransactions(cashierId);
      res.json(transactions);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load transactions" });
    }
  });

  // --- Sales (Supabase) — require auth + sale.create ---
  app.post("/api/sales", authMiddleware, requirePermission("sale.create"), async (req, res) => {
    const payload = req.body;
    if (!payload || !Array.isArray(payload.items)) {
      return res.status(400).json({ error: "Invalid sale payload: need items" });
    }
    const cashierId = req.user.id;
    const cashierName = req.user.name || "";
    const payloadWithActor = { ...payload, cashierId, cashierName };
    try {
      const { id, createdAt } = await pos.createSale(payloadWithActor, cashierName);
      await pos.writeAudit({
        action: "sale_completed",
        actorId: req.user.id,
        actorRole: req.user.role,
        after: {
          saleId: id,
          cashierId: req.user.id,
          subtotal: payload.subtotal,
          total: payload.total,
          vat: payload.vat,
          itemsCount: payload.items.length,
          payments: payload.payments,
        },
        timestamp: createdAt,
      });
      res.status(201).json({ id, createdAt });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to create sale" });
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
      console.error(e);
      res.status(500).json({ error: "Failed to create help request" });
    }
  });

  app.get("/api/help-requests", async (req, res) => {
    const status = req.query.status || null;
    try {
      const list = await pos.getHelpRequests(status);
      res.json(list);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load help requests" });
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
      console.error(e);
      res.status(500).json({ error: "Failed to acknowledge" });
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
      console.error(e);
      res.status(500).json({ error: "Failed to void sale" });
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
      console.error(e);
      res.status(500).json({ error: "Failed to process refund" });
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
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      res.status(201).json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to receive stock" });
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
      console.error(e);
      res.status(500).json({ error: "Failed to post adjustment" });
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
      console.error(e);
      res.status(500).json({ error: "Failed to write audit" });
    }
  });

  // --- Settings (thresholds and venue config) ---
  app.get("/api/settings", authMiddleware, async (_req, res) => {
    try {
      const settings = await pos.getSettings();
      res.json(settings);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load settings" });
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
      console.error(e);
      res.status(500).json({ error: "Failed to save settings" });
    }
  });

  // --- Discrepancy cases ---
  app.get("/api/discrepancies", authMiddleware, requirePermission("discrepancy.view"), async (req, res) => {
    const status = req.query.status || null;
    try {
      const list = await pos.getDiscrepancyCases(status);
      res.json(list);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load discrepancies" });
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
      console.error(e);
      res.status(500).json({ error: "Failed to create discrepancy case" });
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
      console.error(e);
      res.status(500).json({ error: "Failed to close case" });
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
      console.error(e);
      res.status(500).json({ error: "Failed to load intake" });
    }
  });

  app.get("/api/blind-copies/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const copy = await receiving.getBlindCopyById(id);
      if (!copy) return res.status(404).json(null);
      res.json(copy);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load blind copy" });
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
      console.error(e);
      res.status(500).json({ error: "Failed to save intake draft" });
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
      console.error(e);
      res.status(500).json({ error: "Failed to update intake draft" });
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
      console.error(e);
      res.status(500).json({ error: "Failed to save expected lines" });
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
      console.error(e);
      res.status(500).json({ error: "Failed to save verification" });
    }
  });

  app.post("/api/intakes/:id/confirm", authMiddleware, requirePermission("inventory.receive.approve"), async (req, res) => {
    const { id } = req.params;
    try {
      const result = await receiving.confirmIntake(id);
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to confirm intake" });
    }
  });

  app.post("/api/intakes/:id/blind-copy", authMiddleware, requirePermission("inventory.receive.approve"), async (req, res) => {
    const { id } = req.params;
    try {
      const result = await receiving.generateBlindCopy(id);
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to generate blind copy" });
    }
  });

  app.post("/api/blind-copies/:id/issue", authMiddleware, requirePermission("inventory.receive.approve"), async (req, res) => {
    const { id } = req.params;
    try {
      const result = await receiving.issueBlindCopy(id);
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to issue blind copy" });
    }
  });

  // Health
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // --- Reports (Supabase-backed; optional during migration) ---
  app.get("/api/reports", async (req, res) => {
    try {
      const limit = req.query.limit;
      const reports = await listReports({ limit });
      res.json(reports);
    } catch (e) {
      // If Supabase isn't configured yet, don't crash the whole API.
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  return app;
}

export default createApp();

