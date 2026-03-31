import crypto from "crypto";
import { getSupabaseAdmin } from "../lib/supabase.js";

const DEFAULT_SETTINGS = {
  manual_discount_max_percent: "25",
  manual_discount_max_amount: "500",
  refund_threshold_amount: "200",
  void_requires_approval_always: "true",
  stock_variance_percent_threshold: "10",
  blind_cash_close_enabled: "true",
};

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isNotFoundError(err) {
  if (!err) return false;
  const msg = typeof err.message === "string" ? err.message : "";
  return err.code === "PGRST116" || msg.includes("0 rows") || msg.toLowerCase().includes("no rows");
}

// Prevent double-submits (e.g. double-click checkout) from creating multiple
// sales / double-decrementing stock. This is an in-memory guard (sufficient
// for rapid duplicates; durable idempotency would require a DB constraint).
// Keep this window small so we only collapse true "double-click" submits.
// Too-long windows can mistakenly dedup legitimate back-to-back identical sales.
const SALE_DEDUP_TTL_MS = 2_500;
const saleDedupCache = new Map(); // key -> { expiresAt, promise }

function pruneSaleDedupCache(now = Date.now()) {
  for (const [k, v] of saleDedupCache.entries()) {
    if (!v || v.expiresAt <= now) saleDedupCache.delete(k);
  }
}

function stableStringify(value) {
  // Stable stringify for hashing: recursively sort object keys.
  const sorter = (v) => {
    if (v == null) return v;
    if (Array.isArray(v)) return v.map(sorter);
    if (typeof v === "object") {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = sorter(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(sorter(value));
}

function buildSaleIdempotencyKey(payload, cashierId) {
  if (payload?.idempotencyKey && typeof payload.idempotencyKey === "string") return `key:${payload.idempotencyKey}`;

  const items = (payload?.items ?? []).map((it) => ({
    productId: String(it.productId ?? ""),
    qty: Number(it.qty ?? 0),
    unitPrice: Number(it.unitPrice ?? 0),
    lineTotal: Number(it.lineTotal ?? (Number(it.qty ?? 0) * Number(it.unitPrice ?? 0))),
  }));
  const payments = (payload?.payments ?? []).map((p) => ({
    method: String(p.method ?? "").toLowerCase(),
    cashReceived: p.cashReceived ?? null,
    change: p.change ?? null,
    amount: p.amount ?? null,
  }));

  const material = {
    cashierId: String(cashierId ?? payload?.cashierId ?? ""),
    subtotal: Number(payload?.subtotal ?? 0),
    vat: Number(payload?.vat ?? 0),
    total: Number(payload?.total ?? 0),
    items,
    payments,
  };
  const hash = crypto.createHash("sha256").update(stableStringify(material)).digest("hex");
  return `hash:${hash}`;
}

async function supabase() {
  return getSupabaseAdmin();
}

export async function getAllProducts() {
  const client = await supabase();
  const { data: products, error: pErr } = await client
    .from("products")
    .select("id,name,barcode,category,base_price,cost_price,image");
  if (pErr) throw pErr;

  const { data: inventoryRows, error: iErr } = await client
    .from("inventory")
    .select("product_id,total_qty");
  if (iErr) throw iErr;

  const stockMap = new Map((inventoryRows ?? []).map((r) => [r.product_id, r.total_qty]));
  return (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    category: p.category,
    basePrice: p.base_price,
    costPrice: p.cost_price,
    image: p.image ?? undefined,
    stock: stockMap.get(p.id) ?? 0,
  }));
}

export async function getProductByBarcode(barcode) {
  const client = await supabase();
  const trimmed = String(barcode || "").trim();
  if (!trimmed) return null;

  const { data: product, error: pErr } = await client
    .from("products")
    .select("id,name,barcode,category,base_price,cost_price,image")
    .eq("barcode", trimmed)
    .maybeSingle();

  if (pErr) throw pErr;
  if (!product) return null;

  const { data: inv, error: iErr } = await client
    .from("inventory")
    .select("total_qty")
    .eq("product_id", product.id)
    .maybeSingle();

  if (iErr) throw iErr;

  return {
    id: product.id,
    name: product.name,
    barcode: product.barcode,
    category: product.category,
    basePrice: product.base_price,
    costPrice: product.cost_price,
    image: product.image ?? undefined,
    stock: inv?.total_qty ?? 0,
  };
}

export async function searchProducts(q, limit = 20) {
  const client = await supabase();
  const query = String(q || "").trim();
  const effectiveLimit = Math.min(Number(limit) || 20, 50);

  let req = client
    .from("products")
    .select("id,name,barcode,category,base_price,cost_price,image")
    .limit(effectiveLimit);

  if (query) {
    const pattern = `%${query.toLowerCase()}%`;
    req = req.or(
      `name.ilike.${pattern},barcode.ilike.${pattern},category.ilike.${pattern}`
    );
  }

  const { data: products, error: pErr } = await req;
  if (pErr) throw pErr;

  const ids = (products ?? []).map((p) => p.id);
  let stockMap = new Map();
  if (ids.length) {
    const { data: inventoryRows, error: iErr } = await client
      .from("inventory")
      .select("product_id,total_qty")
      .in("product_id", ids);
    if (iErr) throw iErr;
    stockMap = new Map((inventoryRows ?? []).map((r) => [r.product_id, r.total_qty]));
  }

  return (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    category: p.category,
    basePrice: p.base_price,
    costPrice: p.cost_price,
    image: p.image ?? undefined,
    stock: stockMap.get(p.id) ?? 0,
  }));
}

export async function getCategories() {
  const client = await supabase();
  const { data, error } = await client.from("products").select("category");
  if (error) throw error;
  const cats = Array.from(
    new Set(
      (data ?? [])
        .map((d) => d.category)
        .filter((c) => c != null && String(c).trim() !== "")
    )
  );
  return ["All", ...cats];
}

export async function receiveStock(productId, qty, location, { actorId, actorRole, invoiceNumber }) {
  const client = await supabase();
  const n = Math.max(0, Number(qty) || 0);
  if (!productId || n <= 0) return { ok: false, error: "Invalid quantity" };

  const loc = String(location || "warehouse").toLowerCase();
  const isLounge = loc === "lounge";

  const { data: inv, error: iErr } = await client
    .from("inventory")
    .select("total_qty,lounge_qty,warehouse_qty")
    .eq("product_id", productId)
    .maybeSingle();

  if (iErr) throw iErr;
  if (!inv) return { ok: false, error: "Product not in inventory" };

  const before = { total: inv.total_qty ?? 0, lounge: inv.lounge_qty ?? 0, warehouse: inv.warehouse_qty ?? 0 };

  const next = {
    total_qty: before.total + n,
    lounge_qty: before.lounge + (isLounge ? n : 0),
    warehouse_qty: before.warehouse + (isLounge ? 0 : n),
  };

  const { error: updErr } = await client
    .from("inventory")
    .update(next)
    .eq("product_id", productId);
  if (updErr) throw updErr;

  const after = { ...before, ...{ total: next.total_qty, lounge: next.lounge_qty, warehouse: next.warehouse_qty } };

  await writeAudit({
    action: "goods.received",
    actorId,
    actorRole,
    entityType: "inventory",
    entityId: productId,
    before: { ...before, invoiceNumber: invoiceNumber || null },
    after: { ...after, receivedQty: n, location: loc },
    reasonCode: null,
  });

  return { ok: true, before, after };
}

export async function postStockAdjustment(productId, delta, reasonCode, { actorId, actorRole, approverId, approverRole }) {
  const client = await supabase();
  if (!productId) return { ok: false, error: "Product not in inventory" };

  const current = await client
    .from("inventory")
    .select("total_qty")
    .eq("product_id", productId)
    .maybeSingle();

  if (current.error) throw current.error;
  if (!current.data) return { ok: false, error: "Product not in inventory" };

  const d = Number(delta) || 0;
  const before = { total: current.data.total_qty ?? 0 };
  const newTotal = Math.max(0, before.total + d);

  const { error: updErr } = await client
    .from("inventory")
    .update({ total_qty: newTotal })
    .eq("product_id", productId);
  if (updErr) throw updErr;

  const after = { total: newTotal, delta: d };

  await writeAudit({
    action: "stock.adjustment.posted",
    actorId,
    actorRole,
    approverId: approverId || actorId,
    approverRole: approverRole || actorRole,
    entityType: "inventory",
    entityId: productId,
    before,
    after,
    reasonCode: reasonCode || "adjustment",
  });

  return { ok: true, before, after };
}

export async function createSale(payload, cashierName = "") {
  const client = await supabase();

  const cashierId = payload?.cashierId;
  const dedupKey = buildSaleIdempotencyKey(payload, cashierId);

  pruneSaleDedupCache();
  const existing = saleDedupCache.get(dedupKey);
  if (existing && existing.expiresAt > Date.now() && existing.promise) {
    const result = await existing.promise;
    return { ...result, created: false };
  }

  const promise = (async () => {
    const id = randomId("TXN");
    const createdAt = new Date().toISOString();
    const payment = payload.payments?.[0] || {};
    const method = String(payment.method ?? "").toLowerCase() === "cash" ? "cash" : "card";

    const items = payload.items || [];
    if (!Array.isArray(items) || items.length === 0) throw new Error("Invalid sale items");

    // Pre-flight inventory check to prevent negative stock.
    const qtyByProduct = new Map();
    for (const item of items) {
      const pid = String(item.productId ?? "");
      const qty = Number(item.qty ?? 0);
      if (!pid) throw new Error("Invalid productId");
      if (!Number.isFinite(qty) || qty <= 0) throw new Error("Invalid quantity");
      qtyByProduct.set(pid, (qtyByProduct.get(pid) ?? 0) + qty);
    }

    for (const [productId, requestedQty] of qtyByProduct.entries()) {
      const { data: inv, error: invErr } = await client
        .from("inventory")
        .select("total_qty")
        .eq("product_id", productId)
        .maybeSingle();
      if (invErr) throw invErr;
      if (!inv) throw new Error(`Inventory row not found for product ${productId}`);
      const currentTotal = Number(inv.total_qty ?? 0);
      if (currentTotal < requestedQty) {
        throw new Error(`Insufficient stock for product ${productId}`);
      }
    }

    const saleRow = {
      id,
      cashier_id: payload.cashierId,
      cashier_name: cashierName || payload.cashierId,
      subtotal: payload.subtotal ?? 0,
      vat: payload.vat ?? 0,
      total: payload.total ?? 0,
      payment_method: method,
      cash_received: payment.cashReceived ?? null,
      change_given: payment.change ?? null,
      status: "completed",
      created_at: createdAt,
    };

    const { error: saleErr } = await client.from("sales").insert(saleRow);
    if (saleErr) throw saleErr;

    const rows = items.map((item) => ({
      sale_id: id,
      product_id: item.productId,
      product_name: item.name,
      qty: item.qty,
      unit_price: item.unitPrice,
      line_total: item.lineTotal ?? item.qty * item.unitPrice,
    }));

    if (rows.length) {
      const { error: itemsErr } = await client.from("sale_items").insert(rows);
      if (itemsErr) throw itemsErr;
    }

    // Decrement total stock (matches legacy behavior; location-level stock is not modeled here).
    for (const item of items) {
      const pid = String(item.productId ?? "");
      const dec = Number(item.qty) || 0;
      const { data: inv, error: invErr } = await client
        .from("inventory")
        .select("total_qty")
        .eq("product_id", pid)
        .maybeSingle();
      if (invErr) throw invErr;
      if (!inv) throw new Error(`Inventory row not found for product ${pid}`);
      const currentTotal = Number(inv.total_qty ?? 0);
      const nextTotal = currentTotal - dec;
      await client.from("inventory").update({ total_qty: nextTotal }).eq("product_id", pid);
    }

    return { id, createdAt, created: true };
  })();

  saleDedupCache.set(dedupKey, { expiresAt: Date.now() + SALE_DEDUP_TTL_MS, promise });

  try {
    const result = await promise;
    return result;
  } catch (e) {
    saleDedupCache.delete(dedupKey);
    throw e;
  }
}

export async function getSaleById(saleId) {
  const client = await supabase();
  const { data: sale, error: saleErr } = await client.from("sales").select("*").eq("id", saleId).maybeSingle();
  if (saleErr) throw saleErr;
  if (!sale) return null;
  const { data: items, error: itemsErr } = await client.from("sale_items").select("*").eq("sale_id", saleId);
  if (itemsErr) throw itemsErr;
  return { ...sale, items: items ?? [] };
}

export async function getAllTransactions(cashierId = null) {
  const client = await supabase();
  let req = client.from("sales").select("*").order("created_at", { ascending: false });
  if (cashierId) req = req.eq("cashier_id", cashierId);

  const { data: sales, error: salesErr } = await req;
  if (salesErr) throw salesErr;

  const saleIds = (sales ?? []).map((s) => s.id);
  if (!saleIds.length) return [];

  const { data: items, error: itemsErr } = await client
    .from("sale_items")
    .select("*")
    .in("sale_id", saleIds);
  if (itemsErr) throw itemsErr;

  const itemsBySaleId = new Map();
  for (const it of items ?? []) {
    const list = itemsBySaleId.get(it.sale_id) ?? [];
    list.push(it);
    itemsBySaleId.set(it.sale_id, list);
  }

  return (sales ?? []).map((s) => {
    const saleItems = itemsBySaleId.get(s.id) ?? [];
    return {
      id: s.id,
      cashierId: s.cashier_id,
      cashierName: s.cashier_name,
      items: saleItems.map((i) => ({
        productName: i.product_name,
        qty: i.qty,
        price: i.unit_price,
      })),
      total: s.total,
      paymentMethod: s.payment_method,
      cashReceived: s.cash_received ?? undefined,
      changeGiven: s.change_given ?? undefined,
      status: s.status,
      createdAt: s.created_at,
    };
  });
}

export async function voidSale(saleId, { approverId, approverRole, reasonCode }) {
  const sale = await getSaleById(saleId);
  if (!sale) return { ok: false, error: "Sale not found" };
  if (sale.status !== "completed") return { ok: false, error: "Sale cannot be voided (already voided or refunded)" };

  const client = await supabase();

  for (const item of sale.items ?? []) {
    const restoreQty = Math.max(0, Number(item.qty) || 0);
    if (restoreQty === 0) continue;
    const { data: inv, error: invErr } = await client
      .from("inventory")
      .select("total_qty")
      .eq("product_id", item.product_id)
      .maybeSingle();
    if (invErr) throw invErr;
    if (!inv) throw new Error(`Inventory row not found for product ${item.product_id}`);
    const currentTotal = Number(inv.total_qty ?? 0);
    await client
      .from("inventory")
      .update({ total_qty: currentTotal + restoreQty })
      .eq("product_id", item.product_id);
  }

  const { error: updErr } = await client.from("sales").update({ status: "void" }).eq("id", saleId);
  if (updErr) throw updErr;

  await writeAudit({
    action: "void.completed",
    actorId: String(sale.cashier_id),
    actorRole: null,
    approverId,
    approverRole,
    entityType: "sale",
    entityId: saleId,
    before: { status: sale.status, total: sale.total },
    after: { status: "void" },
    reasonCode: reasonCode || null,
  });

  return { ok: true };
}

export async function refundSale(saleId, { approverId, approverRole, reasonCode, amount }) {
  const sale = await getSaleById(saleId);
  if (!sale) return { ok: false, error: "Sale not found" };
  if (sale.status !== "completed") return { ok: false, error: "Sale cannot be refunded (already voided or refunded)" };

  const client = await supabase();
  const refundAmount = amount != null ? Number(amount) : sale.total;

  const { error: updErr } = await client.from("sales").update({ status: "refunded" }).eq("id", saleId);
  if (updErr) throw updErr;

  await writeAudit({
    action: "refund.completed",
    actorId: String(sale.cashier_id),
    actorRole: null,
    approverId,
    approverRole,
    entityType: "sale",
    entityId: saleId,
    before: { status: "completed", total: sale.total },
    after: { status: "refunded", refundAmount },
    reasonCode: reasonCode || null,
  });

  return { ok: true };
}

export async function writeAudit(entry) {
  const client = await supabase();
  const id = entry.id || randomId("AUD");
  const timestamp = entry.timestamp || new Date().toISOString();

  const row = {
    id,
    action: entry.action,
    actor_id: entry.actorId,
    actor_role: entry.actorRole ?? null,
    approver_id: entry.approverId ?? null,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    before_json: entry.before ? JSON.stringify(entry.before) : null,
    after_json: JSON.stringify(entry.after || {}),
    reason_code: entry.reasonCode ?? null,
    timestamp,
  };

  const { error: insErr } = await client.from("audit_log").insert(row);
  if (insErr) throw insErr;
}

export async function createHelpRequest({ cashierId, cashierName, message = "" }) {
  const client = await supabase();
  const id = randomId("HR");
  const createdAt = new Date().toISOString();

  const row = {
    id,
    cashier_id: cashierId,
    cashier_name: cashierName || cashierId,
    message,
    status: "pending",
    created_at: createdAt,
    acknowledged_at: null,
    acknowledged_by: null,
  };

  const { error: insErr } = await client.from("help_requests").insert(row);
  if (insErr) throw insErr;

  return { id, createdAt };
}

export async function getHelpRequests(status = null) {
  const client = await supabase();
  let req = client.from("help_requests").select("*").order("created_at", { ascending: false });
  if (status) req = req.eq("status", status);
  const { data, error } = await req;
  if (error) throw error;
  return (data ?? []).map((r) => ({
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

export async function markHelpRequestAcknowledged(id, acknowledgedBy) {
  const client = await supabase();
  const now = new Date().toISOString();
  const { error } = await client
    .from("help_requests")
    .update({ status: "acknowledged", acknowledged_at: now, acknowledged_by: acknowledgedBy })
    .eq("id", id);
  if (error) throw error;
}

export async function getUserByEmail(email) {
  const client = await supabase();
  const needle = String(email || "").trim().toLowerCase();
  if (!needle) return null;

  const { data, error } = await client
    .from("users")
    .select("id,name,email,role")
    .ilike("email", needle)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, name: data.name, email: data.email, role: data.role };
}

export async function getUserById(id) {
  const client = await supabase();
  const { data, error } = await client.from("users").select("id,name,email,role").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, name: data.name, email: data.email, role: data.role };
}

export async function getSettings() {
  const client = await supabase();
  const { data, error } = await client.from("venue_settings").select("key,value");
  if (error) throw error;
  const out = { ...DEFAULT_SETTINGS };
  for (const r of data ?? []) out[r.key] = r.value;
  return out;
}

export async function setSetting(key, value) {
  const client = await supabase();
  const row = { key: String(key), value: String(value) };
  const { error } = await client.from("venue_settings").upsert(row, { onConflict: "key" });
  if (error) throw error;
  return getSettings();
}

export async function createDiscrepancyCase({ type, severity, createdBy, notes }) {
  const client = await supabase();
  const id = randomId("DISC");
  const now = new Date().toISOString();

  const row = {
    id,
    type: type || "cash",
    severity: severity || "medium",
    status: "open",
    created_at: now,
    created_by: createdBy,
    notes: notes || null,
    closed_at: null,
    closed_by: null,
  };

  const { error: insErr } = await client.from("discrepancy_cases").insert(row);
  if (insErr) throw insErr;

  await writeAudit({
    action: "discrepancy.case.opened",
    actorId: createdBy,
    entityType: "discrepancy",
    entityId: id,
    after: { type: type || "cash", severity: severity || "medium" },
    timestamp: now,
  });

  return { id, createdAt: now };
}

export async function getDiscrepancyCases(status = null) {
  const client = await supabase();
  let req = client.from("discrepancy_cases").select("*").order("created_at", { ascending: false });
  if (status) req = req.eq("status", status);
  const { data, error } = await req;
  if (error) throw error;
  return (data ?? []).map((r) => ({
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

export async function closeDiscrepancyCase(id, closedBy, resolutionNotes) {
  const client = await supabase();
  const now = new Date().toISOString();
  const { error } = await client
    .from("discrepancy_cases")
    .update({ status: "closed", closed_at: now, closed_by: closedBy, notes: resolutionNotes || null })
    .eq("id", id);
  if (error) throw error;

  await writeAudit({
    action: "discrepancy.case.closed",
    actorId: closedBy,
    entityType: "discrepancy",
    entityId: id,
    after: { resolutionNotes: resolutionNotes || null },
    timestamp: now,
  });

  return { ok: true };
}

