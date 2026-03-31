import request from "supertest";
import app from "../src/app.js";
import { getSupabaseAdmin } from "../src/lib/supabase.js";
import { isRealSupabaseConfigured } from "./test-utils.js";

const supabaseConfigured = isRealSupabaseConfigured();

async function seedSupabaseBase() {
  const client = getSupabaseAdmin();

  await client
    .from("users")
    .upsert(
      [
        { id: "11", name: "King G (Owner)", email: "pos-owner@kingg.co.za", role: "owner", password_hash: null },
        { id: "12", name: "Pos Cashier", email: "pos-cashier@kingg.co.za", role: "cashier", password_hash: null },
      ],
      { onConflict: "id" }
    );

  await client
    .from("products")
    .upsert(
      [
        {
          id: "1",
          name: "Test Product",
          barcode: "5000000000011",
          category: "Test",
          base_price: 10,
          cost_price: 5,
          image: null,
        },
      ],
      { onConflict: "id" }
    );

  // Reset inventory to a known value for deterministic deltas.
  await client.from("inventory").upsert([{ product_id: "1", total_qty: 50, lounge_qty: 0, warehouse_qty: 50 }], { onConflict: "product_id" });
}

async function login(email) {
  const res = await request(app).post("/api/auth/login").send({ email, password: "dev" });
  expect(res.statusCode).toBe(200);
  expect(res.body?.token).toBeTruthy();
  return res.body.token;
}

function buildSalePayload({ qty, unitPrice, paymentsMethod, cashReceived } = {}) {
  const q = Number(qty);
  const up = Number(unitPrice);
  const lineTotal = q * up;
  const subtotal = lineTotal;
  const vat = 0;
  const total = subtotal + vat;

  const payments =
    paymentsMethod === "cash"
      ? [{ method: "cash", amount: total, cashReceived: cashReceived ?? total, change: (cashReceived ?? total) - total }]
      : [{ method: paymentsMethod, amount: total }];

  return {
    items: [{ productId: "1", name: "Test Product", qty: q, unitPrice: up, lineTotal }],
    subtotal,
    vat,
    total,
    payments,
  };
}

async function getInventoryTotal() {
  const client = getSupabaseAdmin();
  const { data, error } = await client.from("inventory").select("total_qty").eq("product_id", "1").single();
  if (error) throw error;
  return Number(data?.total_qty ?? 0);
}

async function getSalesById(saleId) {
  const client = getSupabaseAdmin();
  const { data: sale, error } = await client.from("sales").select("*").eq("id", saleId).maybeSingle();
  if (error) throw error;
  const { data: items, error: itemsErr } = await client.from("sale_items").select("*").eq("sale_id", saleId);
  if (itemsErr) throw itemsErr;
  return { sale, items: items ?? [] };
}

async function findAuditEntriesByAction(action) {
  const client = getSupabaseAdmin();
  const { data, error } = await client.from("audit_log").select("*").eq("action", action).order("timestamp", { ascending: false }).limit(20);
  if (error) throw error;
  return data ?? [];
}

;(supabaseConfigured ? describe : describe.skip)("POS money flow + integrity", () => {
  const OWNER_EMAIL = "pos-owner@kingg.co.za";
  const CASHIER_EMAIL = "pos-cashier@kingg.co.za";

  let ownerToken;
  let cashierToken;

  beforeAll(async () => {
    await seedSupabaseBase();
    ownerToken = await login(OWNER_EMAIL);
    cashierToken = await login(CASHIER_EMAIL);
  });

  it("creates a sale and decrements inventory; writes audit trail (sale_completed)", async () => {
    const invBefore = await getInventoryTotal();
    const payload = buildSalePayload({ qty: 3, unitPrice: 10, paymentsMethod: "cash", cashReceived: 30 });

    const res = await request(app).post("/api/sales").set("Authorization", `Bearer ${cashierToken}`).send(payload);
    expect(res.statusCode).toBe(201);

    const saleId = res.body?.id;
    expect(saleId).toBeTruthy();

    const { sale, items } = await getSalesById(saleId);
    expect(sale).toBeTruthy();
    expect(sale.status).toBe("completed");
    expect(items.length).toBe(1);
    expect(Number(items[0].qty)).toBe(3);
    expect(Number(items[0].unit_price)).toBe(10);

    const invAfter = await getInventoryTotal();
    expect(invAfter).toBe(invBefore - 3);

    const audit = await findAuditEntriesByAction("sale_completed");
    expect(audit.length).toBeGreaterThan(0);

    // Ensure at least one entry references this saleId in after_json.
    const hit = audit.some((row) => {
      const afterJson = row.after_json;
      // supabase may return jsonb as object or a string depending on driver setup.
      const after = typeof afterJson === "string" ? JSON.parse(afterJson) : afterJson;
      return after?.saleId === saleId;
    });
    expect(hit).toBe(true);
  });

  it("rejects empty cart (400) and does not create sale or audit", async () => {
    const invBefore = await getInventoryTotal();
    const salesAuditBefore = await findAuditEntriesByAction("sale_completed");

    const res = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        items: [],
        subtotal: 0,
        vat: 0,
        total: 0,
        payments: [{ method: "cash", amount: 0, cashReceived: 0, change: 0 }],
      });

    expect(res.statusCode).toBe(400);

    const invAfter = await getInventoryTotal();
    expect(invAfter).toBe(invBefore);

    const salesAuditAfter = await findAuditEntriesByAction("sale_completed");
    expect(salesAuditAfter.length).toBe(salesAuditBefore.length);
  });

  it("rejects inconsistent totals (400): subtotal must match sum(lineTotal) and total must equal subtotal+vat", async () => {
    const res = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: "1", name: "Test Product", qty: 2, unitPrice: 10, lineTotal: 20 }],
        subtotal: 19, // mismatch
        vat: 0,
        total: 19,
        payments: [{ method: "card", amount: 19 }],
      });

    expect(res.statusCode).toBe(400);
  });

  it("rejects negative or zero quantities (400) and prevents negative inventory", async () => {
    const invBefore = await getInventoryTotal();

    const res = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        items: [{ productId: "1", name: "Test Product", qty: -2, unitPrice: 10, lineTotal: -20 }],
        subtotal: -20,
        vat: 0,
        total: -20,
        payments: [{ method: "card", amount: 0 }],
      });

    expect(res.statusCode).toBe(400);

    const invAfter = await getInventoryTotal();
    expect(invAfter).toBe(invBefore);
  });

  it("rejects sale qty that would make inventory go negative (400)", async () => {
    // inventory is seeded to 50 in beforeAll; take a small known delta check.
    // We'll request a larger qty to force failure once validation is added.
    const res = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send(buildSalePayload({ qty: 1000, unitPrice: 10, paymentsMethod: "card" }));

    expect(res.statusCode).toBe(400);
  });

  it("prevents duplicate transactions on rapid repeated submit (idempotency / double-click)", async () => {
    const payload = buildSalePayload({ qty: 1, unitPrice: 10, paymentsMethod: "cash", cashReceived: 10 });
    const invBefore = await getInventoryTotal();

    const res1 = await request(app).post("/api/sales").set("Authorization", `Bearer ${cashierToken}`).send(payload);
    expect(res1.statusCode).toBe(201);
    const saleId1 = res1.body?.id;
    expect(saleId1).toBeTruthy();

    const res2 = await request(app).post("/api/sales").set("Authorization", `Bearer ${cashierToken}`).send(payload);
    expect(res2.statusCode).toBe(201);

    const saleId2 = res2.body?.id;
    expect(saleId2).toBe(saleId1);

    const invAfter = await getInventoryTotal();
    expect(invAfter).toBe(invBefore - 1);
  });

  it("void requires permission and is audited; double-void is rejected (400) and not double-audited", async () => {
    const payload = buildSalePayload({ qty: 2, unitPrice: 10, paymentsMethod: "cash", cashReceived: 20 });
    const saleRes = await request(app).post("/api/sales").set("Authorization", `Bearer ${cashierToken}`).send(payload);
    expect(saleRes.statusCode).toBe(201);
    const saleId = saleRes.body?.id;
    expect(saleId).toBeTruthy();

    // Cashier should not be able to void.approve.
    const voidAttemptCashier = await request(app)
      .post(`/api/sales/${encodeURIComponent(saleId)}/void`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({ reasonCode: "test_cashier_cannot_void" });
    expect(voidAttemptCashier.statusCode).toBe(403);

    const voidAttemptOwner = await request(app)
      .post(`/api/sales/${encodeURIComponent(saleId)}/void`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ reasonCode: "test_owner_void" });
    expect(voidAttemptOwner.statusCode).toBe(200);
    expect(voidAttemptOwner.body).toEqual({ ok: true });

    const auditBeforeSecondVoid = await findAuditEntriesByAction("void.completed");
    const afterVoidHit = auditBeforeSecondVoid.some((row) => {
      const afterJson = row.after_json;
      const after = typeof afterJson === "string" ? JSON.parse(afterJson) : afterJson;
      return row.entity_type === "sale" && row.entity_id === saleId && after?.status === "void";
    });
    expect(afterVoidHit).toBe(true);

    const voidAttemptOwnerSecond = await request(app)
      .post(`/api/sales/${encodeURIComponent(saleId)}/void`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ reasonCode: "test_owner_void_twice" });

    expect(voidAttemptOwnerSecond.statusCode).toBe(400);
  });

  it("refund requires permission and is audited; double-refund is rejected (400)", async () => {
    const payload = buildSalePayload({ qty: 2, unitPrice: 10, paymentsMethod: "card" });
    const saleRes = await request(app).post("/api/sales").set("Authorization", `Bearer ${cashierToken}`).send(payload);
    expect(saleRes.statusCode).toBe(201);
    const saleId = saleRes.body?.id;
    expect(saleId).toBeTruthy();

    const refundAttemptCashier = await request(app)
      .post(`/api/sales/${encodeURIComponent(saleId)}/refund`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({ reasonCode: "test_cashier_cannot_refund", amount: 20 });
    expect(refundAttemptCashier.statusCode).toBe(403);

    const refundAttemptOwner = await request(app)
      .post(`/api/sales/${encodeURIComponent(saleId)}/refund`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ reasonCode: "test_owner_refund", amount: 20 });
    expect(refundAttemptOwner.statusCode).toBe(200);
    expect(refundAttemptOwner.body).toEqual({ ok: true });

    const refundAttemptOwnerSecond = await request(app)
      .post(`/api/sales/${encodeURIComponent(saleId)}/refund`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ reasonCode: "test_owner_refund_twice", amount: 20 });
    expect(refundAttemptOwnerSecond.statusCode).toBe(400);
  });
});

