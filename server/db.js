/**
 * SQLite database for King G POS. Persistent storage for products, inventory, sales, transactions.
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'kingg.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      barcode TEXT NOT NULL,
      category TEXT NOT NULL,
      base_price REAL NOT NULL,
      cost_price REAL NOT NULL,
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory (
      product_id TEXT PRIMARY KEY REFERENCES products(id),
      total_qty INTEGER NOT NULL DEFAULT 0,
      lounge_qty INTEGER NOT NULL DEFAULT 0,
      warehouse_qty INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      cashier_id TEXT NOT NULL,
      cashier_name TEXT NOT NULL,
      subtotal REAL NOT NULL,
      vat REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      cash_received REAL,
      change_given REAL,
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id TEXT NOT NULL REFERENCES sales(id),
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_role TEXT,
      approver_id TEXT,
      entity_type TEXT,
      entity_id TEXT,
      before_json TEXT,
      after_json TEXT,
      reason_code TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS help_requests (
      id TEXT PRIMARY KEY,
      cashier_id TEXT NOT NULL,
      cashier_name TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      acknowledged_at TEXT,
      acknowledged_by TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS venue_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS discrepancy_cases (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      closed_at TEXT,
      closed_by TEXT,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_discrepancy_status ON discrepancy_cases(status);
    CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales(cashier_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_help_requests_status ON help_requests(status);
    CREATE INDEX IF NOT EXISTS idx_help_requests_created ON help_requests(created_at);
  `);
  migrateAuditLogColumns();
  try {
    db.prepare('CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)').run();
  } catch (_) {}

  const productCount = db.prepare('SELECT COUNT(*) as n FROM products').get();
  if (productCount.n === 0) {
    seedFromJson();
  }

  seedUsersIfEmpty();
}

function migrateAuditLogColumns() {
  const cols = db.prepare("PRAGMA table_info(audit_log)").all().map((r) => r.name);
  const required = ['approver_id', 'entity_type', 'entity_id', 'before_json', 'reason_code'];
  for (const c of required) {
    if (!cols.includes(c)) {
      try {
        db.prepare(`ALTER TABLE audit_log ADD COLUMN ${c} TEXT`).run();
      } catch (_) {}
    }
  }
}

const DEFAULT_USERS = [
  { id: '1', name: 'King G', email: 'owner@kingg.co.za', role: 'owner' },
  { id: '2', name: 'Thabo M.', email: 'thabo@kingg.co.za', role: 'senior_manager' },
  { id: '3', name: 'Lerato K.', email: 'lerato@kingg.co.za', role: 'manager' },
  { id: '4', name: 'Sipho N.', email: 'sipho@kingg.co.za', role: 'cashier' },
  { id: '5', name: 'Zanele D.', email: 'zanele@kingg.co.za', role: 'general_manager' },
  { id: '6', name: 'Bongani S.', email: 'bongani@kingg.co.za', role: 'stock_clerk' },
  { id: '7', name: 'Nomsa H.', email: 'nomsa@kingg.co.za', role: 'host' },
  { id: '8', name: 'Security T.', email: 'security@kingg.co.za', role: 'security' },
  { id: '9', name: 'Finance A.', email: 'accountant@kingg.co.za', role: 'accountant' },
];

function seedUsersIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as n FROM users').get();
  if (count.n > 0) return;
  const insert = db.prepare('INSERT OR IGNORE INTO users (id, name, email, role, password_hash) VALUES (?, ?, ?, ?, ?)');
  for (const u of DEFAULT_USERS) {
    insert.run(u.id, u.name, u.email, u.role, null);
  }
  console.log('Seeded users table');
}

function seedFromJson() {
  try {
    const products = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'products.json'), 'utf8'));
    const inventory = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'inventory.json'), 'utf8'));
    const insertProduct = db.prepare(
      'INSERT OR IGNORE INTO products (id, name, barcode, category, base_price, cost_price) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const insertInv = db.prepare(
      'INSERT OR REPLACE INTO inventory (product_id, total_qty, lounge_qty, warehouse_qty) VALUES (?, ?, ?, ?)'
    );
    for (const p of products) {
      insertProduct.run(p.id, p.name, p.barcode || '', p.category || '', p.basePrice ?? 0, p.costPrice ?? 0);
      const inv = inventory.find((i) => i.productId === p.id);
      const total = inv?.totalQty ?? 50;
      const lounge = inv?.loungeQty ?? Math.min(20, total);
      const warehouse = total - lounge;
      insertInv.run(p.id, total, lounge, warehouse);
    }
    console.log('Seeded products and inventory from JSON');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    // Seed default products if no JSON
    const defaults = [
      ['1', 'Johnnie Walker Black', '5000267024202', 'Whisky', 45, 28],
      ['2', 'Hennessy VS', '3245995001015', 'Cognac', 55, 35],
      ['3', 'Moët & Chandon', '3185370001233', 'Champagne', 120, 80],
      ['4', 'Grey Goose Vodka', '8000040060028', 'Vodka', 40, 22],
      ['5', 'Bombay Sapphire Gin', '5010677714006', 'Gin', 35, 20],
      ['6', 'Patron Silver Tequila', '7210003810021', 'Tequila', 50, 30],
      ['7', 'Red Bull Energy', '9002490100070', 'Mixers', 15, 8],
      ['8', 'Coca-Cola 330ml', '5449000000996', 'Mixers', 10, 5],
      ['9', 'Castle Lager 340ml', '6001078012001', 'Beer', 20, 12],
      ['10', 'Heineken 330ml', '8710398020184', 'Beer', 25, 15],
      ['11', 'Jack Daniels', '0082184090466', 'Whisky', 42, 26],
      ['12', 'Amarula Cream', '6001495062018', 'Liqueur', 30, 18],
    ];
    const insertProduct = db.prepare(
      'INSERT OR IGNORE INTO products (id, name, barcode, category, base_price, cost_price) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const insertInv = db.prepare(
      'INSERT OR REPLACE INTO inventory (product_id, total_qty, lounge_qty, warehouse_qty) VALUES (?, ?, ?, ?)'
    );
    for (const row of defaults) {
      insertProduct.run(...row);
      insertInv.run(row[0], 50, 20, 30);
    }
    console.log('Seeded default products');
  }
}

init();

export function getAllProducts() {
  const rows = db.prepare(`
    SELECT p.id, p.name, p.barcode, p.category, p.base_price AS basePrice, p.cost_price AS costPrice, p.image,
           COALESCE(i.total_qty, 0) AS stock
    FROM products p
    LEFT JOIN inventory i ON p.id = i.product_id
  `).all();
  return rows.map((r) => ({ ...r, stock: r.stock ?? 0 }));
}

export function getProductByBarcode(barcode) {
  const row = db.prepare(`
    SELECT p.id, p.name, p.barcode, p.category, p.base_price AS basePrice, p.cost_price AS costPrice, p.image,
           COALESCE(i.total_qty, 0) AS stock
    FROM products p
    LEFT JOIN inventory i ON p.id = i.product_id
    WHERE p.barcode = ?
  `).get(barcode.trim());
  return row ? { ...row, stock: row.stock ?? 0 } : null;
}

export function searchProducts(q, limit = 20) {
  const like = `%${q.trim().toLowerCase()}%`;
  const rows = db.prepare(`
    SELECT p.id, p.name, p.barcode, p.category, p.base_price AS basePrice, p.cost_price AS costPrice, p.image,
           COALESCE(i.total_qty, 0) AS stock
    FROM products p
    LEFT JOIN inventory i ON p.id = i.product_id
    WHERE LOWER(p.name) LIKE ? OR p.barcode LIKE ? OR LOWER(p.category) LIKE ?
    LIMIT ?
  `).all(like, like, like, Math.min(limit, 50));
  return rows.map((r) => ({ ...r, stock: r.stock ?? 0 }));
}

export function getCategories() {
  const rows = db.prepare('SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ""').all();
  return ['All', ...rows.map((r) => r.category)];
}

export function getStock(productId) {
  const row = db.prepare('SELECT total_qty FROM inventory WHERE product_id = ?').get(productId);
  return row?.total_qty ?? 0;
}

function getInventoryRow(productId) {
  const row = db.prepare('SELECT total_qty, lounge_qty, warehouse_qty FROM inventory WHERE product_id = ?').get(productId);
  return row ? { total: row.total_qty ?? 0, lounge: row.lounge_qty ?? 0, warehouse: row.warehouse_qty ?? 0 } : null;
}

export function receiveStock(productId, qty, location, { actorId, actorRole, invoiceNumber }) {
  const current = getInventoryRow(productId);
  if (!current) return { ok: false, error: 'Product not in inventory' };
  const n = Number(qty) || 0;
  if (n <= 0) return { ok: false, error: 'Invalid quantity' };
  const loc = (location || 'warehouse').toLowerCase();
  const isLounge = loc === 'lounge';
  const before = { total: current.total, lounge: current.lounge, warehouse: current.warehouse };
  let after;
  if (isLounge) {
    db.prepare('UPDATE inventory SET total_qty = total_qty + ?, lounge_qty = lounge_qty + ? WHERE product_id = ?').run(n, n, productId);
    after = { total: before.total + n, lounge: before.lounge + n, warehouse: before.warehouse };
  } else {
    db.prepare('UPDATE inventory SET total_qty = total_qty + ?, warehouse_qty = warehouse_qty + ? WHERE product_id = ?').run(n, n, productId);
    after = { total: before.total + n, lounge: before.lounge, warehouse: before.warehouse + n };
  }
  const now = new Date().toISOString();
  writeAudit({
    action: 'goods.received',
    actorId,
    actorRole,
    entityType: 'inventory',
    entityId: productId,
    before: { ...before, invoiceNumber: invoiceNumber || null },
    after: { ...after, receivedQty: n, location },
    timestamp: now,
  });
  return { ok: true, before, after };
}

export function postStockAdjustment(productId, delta, reasonCode, { actorId, actorRole, approverId, approverRole }) {
  const current = getInventoryRow(productId);
  if (!current) return { ok: false, error: 'Product not in inventory' };
  const d = Number(delta) || 0;
  const newTotal = Math.max(0, current.total + d);
  const before = { total: current.total };
  db.prepare('UPDATE inventory SET total_qty = ? WHERE product_id = ?').run(newTotal, productId);
  const after = { total: newTotal, delta: d };
  const now = new Date().toISOString();
  writeAudit({
    action: 'stock.adjustment.posted',
    actorId,
    actorRole,
    approverId: approverId || actorId,
    approverRole: approverRole || actorRole,
    entityType: 'inventory',
    entityId: productId,
    before,
    after,
    reasonCode: reasonCode || 'adjustment',
    timestamp: now,
  });
  return { ok: true, before, after };
}

export function createSale(payload, cashierName = '') {
  const id = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();
  const payment = payload.payments?.[0] || {};
  const method = payment.method === 'cash' ? 'cash' : 'card';

  db.transaction(() => {
    db.prepare(`
      INSERT INTO sales (id, cashier_id, cashier_name, subtotal, vat, total, payment_method, cash_received, change_given, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
    `).run(
      id,
      payload.cashierId,
      cashierName || payload.cashierId,
      payload.subtotal ?? 0,
      payload.vat ?? 0,
      payload.total ?? 0,
      method,
      payment.cashReceived ?? null,
      payment.change ?? null,
      createdAt
    );

    const insertItem = db.prepare(
      'INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const item of payload.items || []) {
      insertItem.run(item.productId, item.name, item.qty, item.unitPrice, item.lineTotal ?? item.qty * item.unitPrice);
      db.prepare('UPDATE inventory SET total_qty = total_qty - ? WHERE product_id = ?').run(item.qty, item.productId);
    }
  })();

  return { id, createdAt };
}

export function getSaleById(saleId) {
  const s = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
  if (!s) return null;
  const items = db.prepare('SELECT product_id, product_name, qty, unit_price, line_total FROM sale_items WHERE sale_id = ?').all(saleId);
  return {
    id: s.id,
    cashierId: s.cashier_id,
    cashierName: s.cashier_name,
    subtotal: s.subtotal,
    vat: s.vat,
    total: s.total,
    status: s.status,
    createdAt: s.created_at,
    items,
  };
}

export function getAllTransactions(cashierId = null) {
  const sales = cashierId
    ? db.prepare('SELECT * FROM sales WHERE cashier_id = ? ORDER BY created_at DESC').all(cashierId)
    : db.prepare('SELECT * FROM sales ORDER BY created_at DESC').all();

  const transactions = [];
  const getItems = db.prepare('SELECT product_name AS productName, qty, unit_price AS price FROM sale_items WHERE sale_id = ?');
  for (const s of sales) {
    const items = getItems.all(s.id).map((i) => ({ productName: i.productName, qty: i.qty, price: i.price }));
    transactions.push({
      id: s.id,
      cashierId: s.cashier_id,
      cashierName: s.cashier_name,
      items,
      total: s.total,
      paymentMethod: s.payment_method,
      cashReceived: s.cash_received ?? undefined,
      changeGiven: s.change_given ?? undefined,
      status: s.status,
      createdAt: s.created_at,
    });
  }
  return transactions;
}

export function voidSale(saleId, { approverId, approverRole, reasonCode }) {
  const sale = getSaleById(saleId);
  if (!sale) return { ok: false, error: 'Sale not found' };
  if (sale.status !== 'completed') return { ok: false, error: 'Sale cannot be voided (already voided or refunded)' };
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare('UPDATE sales SET status = ? WHERE id = ?').run('void', saleId);
    for (const item of sale.items) {
      db.prepare('UPDATE inventory SET total_qty = total_qty + ? WHERE product_id = ?').run(item.qty, item.product_id);
    }
    writeAudit({
      action: 'void.completed',
      actorId: sale.cashierId,
      actorRole: null,
      approverId,
      approverRole,
      entityType: 'sale',
      entityId: saleId,
      before: { status: 'completed', total: sale.total },
      after: { status: 'void' },
      reasonCode: reasonCode || null,
      timestamp: now,
    });
  })();
  return { ok: true };
}

export function refundSale(saleId, { approverId, approverRole, reasonCode, amount }) {
  const sale = getSaleById(saleId);
  if (!sale) return { ok: false, error: 'Sale not found' };
  if (sale.status !== 'completed') return { ok: false, error: 'Sale cannot be refunded (already voided or refunded)' };
  const refundAmount = amount != null ? Number(amount) : sale.total;
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare('UPDATE sales SET status = ? WHERE id = ?').run('refunded', saleId);
    writeAudit({
      action: 'refund.completed',
      actorId: sale.cashierId,
      actorRole: null,
      approverId,
      approverRole,
      entityType: 'sale',
      entityId: saleId,
      before: { status: 'completed', total: sale.total },
      after: { status: 'refunded', refundAmount },
      reasonCode: reasonCode || null,
      timestamp: now,
    });
  })();
  return { ok: true };
}

export function writeAudit(entry) {
  const id = entry.id || `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const timestamp = entry.timestamp || new Date().toISOString();
  db.prepare(
    `INSERT INTO audit_log (id, action, actor_id, actor_role, approver_id, entity_type, entity_id, before_json, after_json, reason_code, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    entry.action,
    entry.actorId,
    entry.actorRole ?? null,
    entry.approverId ?? null,
    entry.entityType ?? null,
    entry.entityId ?? null,
    entry.before ? JSON.stringify(entry.before) : null,
    JSON.stringify(entry.after || {}),
    entry.reasonCode ?? null,
    timestamp
  );
}

// --- Help requests (cashier calls manager; managers see and acknowledge) ---
export function createHelpRequest({ cashierId, cashierName, message = '' }) {
  const id = `HR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO help_requests (id, cashier_id, cashier_name, message, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`
  ).run(id, cashierId, cashierName || cashierId, message, createdAt);
  return { id, createdAt };
}

export function getHelpRequests(status = null) {
  const rows = status
    ? db.prepare('SELECT * FROM help_requests WHERE status = ? ORDER BY created_at DESC').all(status)
    : db.prepare('SELECT * FROM help_requests ORDER BY created_at DESC').all();
  return rows.map((r) => ({
    id: r.id,
    cashierId: r.cashier_id,
    cashierName: r.cashier_name,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
    acknowledgedAt: r.acknowledged_at,
    acknowledgedBy: r.acknowledged_by,
  }));
}

export function markHelpRequestAcknowledged(id, acknowledgedBy) {
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE help_requests SET status = ?, acknowledged_at = ?, acknowledged_by = ? WHERE id = ?'
  ).run('acknowledged', now, acknowledgedBy, id);
}

export function getUserByEmail(email) {
  const row = db.prepare('SELECT id, name, email, role FROM users WHERE email = ?').get((email || '').trim().toLowerCase());
  return row ? { id: row.id, name: row.name, email: row.email, role: row.role } : null;
}

export function getUserById(id) {
  const row = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(id);
  return row ? { id: row.id, name: row.name, email: row.email, role: row.role } : null;
}

const DEFAULT_SETTINGS = {
  manual_discount_max_percent: '25',
  manual_discount_max_amount: '500',
  refund_threshold_amount: '200',
  void_requires_approval_always: 'true',
  stock_variance_percent_threshold: '10',
  blind_cash_close_enabled: 'true',
};

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM venue_settings').all();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO venue_settings (key, value) VALUES (?, ?)').run(String(key), String(value));
  return getSettings();
}

export function createDiscrepancyCase({ type, severity, createdBy, notes }) {
  const id = `DISC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO discrepancy_cases (id, type, severity, status, created_at, created_by, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, type || 'cash', severity || 'medium', 'open', now, createdBy, notes || null);
  writeAudit({
    action: 'discrepancy.case.opened',
    actorId: createdBy,
    entityType: 'discrepancy',
    entityId: id,
    after: { type: type || 'cash', severity: severity || 'medium' },
    timestamp: now,
  });
  return { id, createdAt: now };
}

export function getDiscrepancyCases(status = null) {
  const rows = status
    ? db.prepare('SELECT * FROM discrepancy_cases WHERE status = ? ORDER BY created_at DESC').all(status)
    : db.prepare('SELECT * FROM discrepancy_cases ORDER BY created_at DESC').all();
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    severity: r.severity,
    status: r.status,
    createdAt: r.created_at,
    createdBy: r.created_by,
    closedAt: r.closed_at ?? undefined,
    closedBy: r.closed_by ?? undefined,
    notes: r.notes ?? undefined,
  }));
}

export function closeDiscrepancyCase(id, closedBy, resolutionNotes) {
  const now = new Date().toISOString();
  db.prepare('UPDATE discrepancy_cases SET status = ?, closed_at = ?, closed_by = ?, notes = ? WHERE id = ?').run(
    'closed',
    now,
    closedBy,
    resolutionNotes || null,
    id
  );
  writeAudit({
    action: 'discrepancy.case.closed',
    actorId: closedBy,
    entityType: 'discrepancy',
    entityId: id,
    after: { resolutionNotes: resolutionNotes || null },
    timestamp: now,
  });
  return { ok: true };
}

export default db;
