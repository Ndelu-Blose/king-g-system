// Shared helpers for stock integration tests (not a test file itself).
import request from "supertest";
import app from "../src/app.js";
import { getSupabaseAdmin } from "../src/lib/supabase.js";
import { signLegacyToken } from "../src/lib/auth-legacy.js";

export const owner = { id: "stock-owner", role: "owner", name: "Stock Owner" };
export const cashier = { id: "stock-cashier", role: "cashier", name: "Stock Cashier" };

export function auth(user) {
  const token = signLegacyToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: `${user.id}@kingg.test`,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return { Authorization: `Bearer ${token}` };
}

export async function seedStockUsers() {
  const { error } = await getSupabaseAdmin()
    .from("users")
    .upsert(
      [owner, cashier].map((u) => ({ id: u.id, name: u.name, email: `${u.id}@kingg.test`, role: u.role })),
      { onConflict: "id" }
    );
  if (error) throw error;
}

let seq = 0;
export function uniqueKey(prefix) {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function seedProduct({ lounge, warehouse, total = lounge + warehouse, name } = {}) {
  const id = uniqueKey("prod");
  const client = getSupabaseAdmin();
  const { error: pErr } = await client
    .from("products")
    .insert({ id, name: name ?? `Product ${id}`, barcode: id, category: "Test", base_price: 10, cost_price: 4 });
  if (pErr) throw pErr;
  const { error: iErr } = await client
    .from("inventory")
    .insert({ product_id: id, total_qty: total, lounge_qty: lounge, warehouse_qty: warehouse });
  if (iErr) throw iErr;
  return id;
}

export async function stock(productId) {
  const { data, error } = await getSupabaseAdmin()
    .from("inventory")
    .select("total_qty,lounge_qty,warehouse_qty")
    .eq("product_id", productId)
    .single();
  if (error) throw error;
  return { total: data.total_qty, lounge: data.lounge_qty, warehouse: data.warehouse_qty };
}

export async function movements(productId) {
  const { data, error } = await getSupabaseAdmin()
    .from("stock_movements")
    .select("*")
    .eq("product_id", productId)
    .order("id", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function salePayload(productId, qty, { idempotencyKey = uniqueKey("sale"), unitPrice = 10 } = {}) {
  const total = qty * unitPrice;
  return {
    idempotencyKey,
    items: [{ productId, name: "Test item", qty, unitPrice, lineTotal: total }],
    subtotal: total,
    vat: 0,
    total,
    payments: [{ method: "card", amount: total }],
  };
}

export function postSale(payload, user = cashier) {
  return request(app).post("/api/sales").set(auth(user)).send(payload);
}

export async function sell(productId, qty) {
  const res = await postSale(salePayload(productId, qty));
  if (res.statusCode !== 201) throw new Error(`sale failed: ${res.statusCode} ${JSON.stringify(res.body)}`);
  return res.body.id;
}

export function transfer(productId, qty, from, to, { reason, idempotencyKey } = {}) {
  const req = request(app).post("/api/inventory/transfer").set(auth(owner));
  if (idempotencyKey) req.set("Idempotency-Key", idempotencyKey);
  return req.send({ productId, qty, from, to, reason });
}

export function expectBalanced(s) {
  expect(s.lounge + s.warehouse).toBe(s.total);
  expect(s.lounge).toBeGreaterThanOrEqual(0);
  expect(s.warehouse).toBeGreaterThanOrEqual(0);
}

export { app, request };
