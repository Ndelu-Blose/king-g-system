import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import * as db from './db.js';
import { loginHandler, authMiddleware } from './auth.js';
import { requirePermission, requireAuth } from './permissions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// --- Auth (no auth middleware) ---
app.post('/api/auth/login', loginHandler);

// --- Products (from SQLite) ---
app.get('/api/products', (req, res) => {
  try {
    const products = db.getAllProducts();
    res.json(products);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

app.get('/api/products/barcode/:barcode', (req, res) => {
  const barcode = (req.params.barcode || '').trim();
  if (!barcode) return res.status(400).json({ error: 'Barcode required' });
  try {
    const product = db.getProductByBarcode(barcode);
    if (!product) return res.status(404).json(null);
    res.json(product);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load product' });
  }
});

app.get('/api/products/search', (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  try {
    const products = db.searchProducts(q, limit);
    res.json(products);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to search products' });
  }
});

app.get('/api/categories', (req, res) => {
  try {
    const categories = db.getCategories();
    res.json(categories);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

// --- Transactions (real-time from database) ---
app.get('/api/transactions', (req, res) => {
  const cashierId = req.query.cashierId || null;
  try {
    const transactions = db.getAllTransactions(cashierId);
    res.json(transactions);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load transactions' });
  }
});

// --- Sales (persist to SQLite) — require auth + sale.create ---
app.post('/api/sales', authMiddleware, requirePermission('sale.create'), (req, res) => {
  const payload = req.body;
  if (!payload || !Array.isArray(payload.items)) {
    return res.status(400).json({ error: 'Invalid sale payload: need items' });
  }
  const cashierId = req.user.id;
  const cashierName = req.user.name || '';
  const payloadWithActor = { ...payload, cashierId, cashierName };
  try {
    const { id, createdAt } = db.createSale(payloadWithActor, cashierName);
    db.writeAudit({
      action: 'sale_completed',
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
    res.status(500).json({ error: 'Failed to create sale' });
  }
});

// --- Help requests (cashier calls manager) — require auth ---
app.post('/api/help-requests', authMiddleware, requireAuth, (req, res) => {
  const body = req.body || {};
  const cashierId = req.user.id;
  try {
    const { id, createdAt } = db.createHelpRequest({
      cashierId,
      cashierName: req.user.name || cashierId,
      message: body.message || '',
    });
    res.status(201).json({ id, createdAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create help request' });
  }
});

app.get('/api/help-requests', (req, res) => {
  const status = req.query.status || null;
  try {
    const list = db.getHelpRequests(status);
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load help requests' });
  }
});

app.patch('/api/help-requests/:id/acknowledge', authMiddleware, requireAuth, (req, res) => {
  const { id } = req.params;
  const acknowledgedBy = req.user.name || req.user.id;
  if (!id) return res.status(400).json({ error: 'id required' });
  try {
    db.markHelpRequestAcknowledged(id, acknowledgedBy);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to acknowledge' });
  }
});

// --- Void sale (manager approval) ---
app.post('/api/sales/:id/void', authMiddleware, requirePermission('void.approve'), (req, res) => {
  const { id } = req.params;
  const { reasonCode, reasonText } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Sale id required' });
  try {
    const result = db.voidSale(id, {
      approverId: req.user.id,
      approverRole: req.user.role,
      reasonCode: reasonCode || reasonText || 'void_approved',
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to void sale' });
  }
});

// --- Refund sale (manager approval) ---
app.post('/api/sales/:id/refund', authMiddleware, requirePermission('refund.approve'), (req, res) => {
  const { id } = req.params;
  const { reasonCode, reasonText, amount } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Sale id required' });
  try {
    const result = db.refundSale(id, {
      approverId: req.user.id,
      approverRole: req.user.role,
      reasonCode: reasonCode || reasonText || 'refund_approved',
      amount,
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

// --- Inventory: receive stock ---
app.post('/api/inventory/receive', authMiddleware, requirePermission('inventory.receive.post'), (req, res) => {
  const { productId, qty, location, invoiceNumber } = req.body || {};
  if (!productId || qty == null) return res.status(400).json({ error: 'productId and qty required' });
  try {
    const result = db.receiveStock(productId, qty, location, {
      actorId: req.user.id,
      actorRole: req.user.role,
      invoiceNumber: invoiceNumber || null,
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.status(201).json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to receive stock' });
  }
});

// --- Inventory: stock adjustment ---
app.post('/api/inventory/adjustments', authMiddleware, requirePermission('inventory.adjust'), (req, res) => {
  const { productId, delta, reasonCode } = req.body || {};
  if (!productId || delta == null) return res.status(400).json({ error: 'productId and delta required' });
  try {
    const result = db.postStockAdjustment(productId, delta, reasonCode || 'adjustment', {
      actorId: req.user.id,
      actorRole: req.user.role,
      approverId: req.user.id,
      approverRole: req.user.role,
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.status(201).json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to post adjustment' });
  }
});

// --- Audit — require auth; use identity from token ---
app.post('/api/audit', authMiddleware, requireAuth, (req, res) => {
  const entry = req.body;
  if (!entry || !entry.action) {
    return res.status(400).json({ error: 'Invalid audit entry: need action' });
  }
  try {
    db.writeAudit({
      ...entry,
      actorId: req.user.id,
      actorRole: req.user.role,
    });
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to write audit' });
  }
});

// --- Settings (thresholds and venue config) ---
app.get('/api/settings', authMiddleware, (req, res) => {
  try {
    const settings = db.getSettings();
    res.json(settings);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

app.put('/api/settings', authMiddleware, requirePermission('admin.settings'), (req, res) => {
  const body = req.body || {};
  if (typeof body !== 'object') return res.status(400).json({ error: 'Settings must be an object' });
  try {
    for (const [key, value] of Object.entries(body)) {
      if (key && value !== undefined) db.setSetting(key, String(value));
    }
    res.json(db.getSettings());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// --- Discrepancy cases ---
app.get('/api/discrepancies', authMiddleware, requirePermission('discrepancy.view'), (req, res) => {
  const status = req.query.status || null;
  try {
    const list = db.getDiscrepancyCases(status);
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load discrepancies' });
  }
});

app.post('/api/discrepancies', authMiddleware, requirePermission('discrepancy.resolve'), (req, res) => {
  const { type, severity, notes } = req.body || {};
  try {
    const { id, createdAt } = db.createDiscrepancyCase({
      type: type || 'cash',
      severity: severity || 'medium',
      createdBy: req.user.id,
      notes: notes || null,
    });
    res.status(201).json({ id, createdAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create discrepancy case' });
  }
});

app.patch('/api/discrepancies/:id/close', authMiddleware, requirePermission('discrepancy.resolve'), (req, res) => {
  const { id } = req.params;
  const { resolutionNotes } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });
  try {
    db.closeDiscrepancyCase(id, req.user.id, resolutionNotes);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to close case' });
  }
});

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

const server = app.listen(PORT, () => {
  console.log(`King G API running at http://localhost:${PORT} (SQLite database)`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or set PORT=3002.`);
    process.exit(1);
  }
  throw err;
});
