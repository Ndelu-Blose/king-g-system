import request from "supertest";
import app from "../src/app.js";
import { getSupabaseAdmin } from "../src/lib/supabase.js";
import { hashPassword } from "../src/lib/passwords.js";

const OWNER_EMAIL = (process.env.TEST_OWNER_EMAIL || "test-owner@example.com").toLowerCase();
const CASHIER_EMAIL = (process.env.TEST_CASHIER_EMAIL || "test-cashier@example.com").toLowerCase();
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || "test-password-dev";
const TEST_PASSWORD_HASH = hashPassword(TEST_USER_PASSWORD);
const supabaseConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

async function login(email) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: TEST_USER_PASSWORD });
  expect(res.statusCode).toBe(200);
  expect(res.body?.token).toBeTruthy();
  return res.body.token;
}

function buildSalePayload() {
  return {
    items: [{ productId: "1", name: "Test Product", qty: 1, unitPrice: 45, lineTotal: 45 }],
    subtotal: 45,
    vat: 0,
    total: 45,
    payments: [{ method: "cash", cashReceived: 50, change: 5 }],
  };
}

;(supabaseConfigured ? describe : describe.skip)("Core backend workflow coverage", () => {
  let ownerToken;
  let cashierToken;
  let client;

  beforeAll(async () => {
    client = getSupabaseAdmin();
    // Seed minimal users + product/inventory rows for deterministic workflow tests.
    await client
      .from("users")
      .upsert(
        [
          {
            id: "test-owner",
            name: "Test Owner",
            email: OWNER_EMAIL,
            role: "owner",
            password_hash: TEST_PASSWORD_HASH,
          },
          {
            id: "test-cashier",
            name: "Test Cashier",
            email: CASHIER_EMAIL,
            role: "cashier",
            password_hash: TEST_PASSWORD_HASH,
          },
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
            barcode: "5000267024202",
            category: "Whisky",
            base_price: 45,
            cost_price: 28,
            image: null,
          },
        ],
        { onConflict: "id" }
      );

    await client
      .from("inventory")
      .upsert(
        [
          { product_id: "1", total_qty: 200, lounge_qty: 0, warehouse_qty: 200 },
        ],
        { onConflict: "product_id" }
      );

    ownerToken = await login(OWNER_EMAIL);
    cashierToken = await login(CASHIER_EMAIL);
  });

  it("fetches transactions", async () => {
    const res = await request(app).get("/api/transactions");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("creates, lists, and acknowledges help requests", async () => {
    const createRes = await request(app)
      .post("/api/help-requests")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({ message: "Need floor manager support" });

    expect(createRes.statusCode).toBe(201);
    expect(createRes.body?.id).toBeTruthy();

    const listRes = await request(app).get("/api/help-requests");
    expect(listRes.statusCode).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.some((row) => row.id === createRes.body.id)).toBe(true);

    const ackRes = await request(app)
      .patch(`/api/help-requests/${createRes.body.id}/acknowledge`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});

    expect(ackRes.statusCode).toBe(200);
    expect(ackRes.body).toEqual({ ok: true });
  });

  it("receives stock", async () => {
    const res = await request(app)
      .post("/api/inventory/receive")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ productId: "1", qty: 2, location: "warehouse", invoiceNumber: "INV-TEST-001" });

    expect(res.statusCode).toBe(201);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.after?.total).toBeGreaterThanOrEqual(res.body?.before?.total);
  });

  it("voids a sale", async () => {
    const saleRes = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send(buildSalePayload());

    expect(saleRes.statusCode).toBe(201);
    expect(saleRes.body?.id).toBeTruthy();

    const voidRes = await request(app)
      .post(`/api/sales/${saleRes.body.id}/void`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ reasonCode: "workflow_test_void" });

    expect(voidRes.statusCode).toBe(200);
    expect(voidRes.body).toEqual({ ok: true });
  });

  it("refunds a sale", async () => {
    const saleRes = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send(buildSalePayload());

    expect(saleRes.statusCode).toBe(201);
    expect(saleRes.body?.id).toBeTruthy();

    const refundRes = await request(app)
      .post(`/api/sales/${saleRes.body.id}/refund`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ reasonCode: "workflow_test_refund", amount: 45 });

    expect(refundRes.statusCode).toBe(200);
    expect(refundRes.body).toEqual({ ok: true });
  });

  it("runs the receiving intake flow + blind copy flow", async () => {
    const createDraftRes = await request(app)
      .post("/api/intakes/draft")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        intakeNumber: "IN-001",
        supplier: "Test Supplier",
        invoiceNumber: "INV-001",
        deliveryReference: "DEL-001",
        deliveryDate: "2026-03-26",
        branchSite: "Main",
        receiveIntoLocation: "warehouse",
        receivedBy: "King G",
        notes: "Test intake",
        status: "draft",
      });

    expect(createDraftRes.statusCode).toBe(201);
    const intakeId = createDraftRes.body?.header?.id;
    expect(intakeId).toBeTruthy();
    expect(createDraftRes.body?.header?.status).toBe("draft");

    const invalidExpectedLinesRes = await request(app)
      .post(`/api/intakes/${encodeURIComponent(intakeId)}/expected-lines`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    expect(invalidExpectedLinesRes.statusCode).toBe(400);

    const expectedLinesRes = await request(app)
      .post(`/api/intakes/${encodeURIComponent(intakeId)}/expected-lines`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        lines: [
          {
            id: `LINE-1-${Date.now()}`,
            productId: "1",
            expectedQty: 5,
            unitOfMeasure: "ea",
            unitCostOptional: null,
            batchNumber: null,
            expiryDate: null,
            discrepancyReason: null,
            destinationLocation: "Front Store A",
          },
        ],
      });

    expect(expectedLinesRes.statusCode).toBe(200);
    expect(expectedLinesRes.body?.header?.status).toBe("expected_captured");
    expect(expectedLinesRes.body?.lines?.[0]?.expectedQty).toBe(5);
    expect(expectedLinesRes.body?.lines?.[0]?.acceptedQty).toBe(5);

    const verifiedLineId = expectedLinesRes.body.lines[0].id;
    const physicalVerifiedRes = await request(app)
      .post(`/api/intakes/${encodeURIComponent(intakeId)}/verification`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        status: "physical_verified",
        lines: [
          {
            id: verifiedLineId,
            productId: "1",
            expectedQty: 5,
            actualQty: 5,
            decision: "accept",
            discrepancyReason: null,
            destinationLocation: "Front Store A",
            verificationNotes: "Count OK",
          },
        ],
      });

    expect(physicalVerifiedRes.statusCode).toBe(200);
    expect(physicalVerifiedRes.body?.header?.status).toBe("physical_verified");
    expect(physicalVerifiedRes.body?.lines?.[0]?.acceptedQty).toBe(5);

    const { data: invBefore } = await client
      .from("inventory")
      .select("total_qty,lounge_qty,warehouse_qty")
      .eq("product_id", "1")
      .single();

    const confirmRes = await request(app)
      .post(`/api/intakes/${encodeURIComponent(intakeId)}/confirm`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});

    expect(confirmRes.statusCode).toBe(200);
    expect(confirmRes.body?.header?.status).toBe("confirmed");

    const { data: invAfter } = await client
      .from("inventory")
      .select("total_qty,lounge_qty,warehouse_qty")
      .eq("product_id", "1")
      .single();

    expect(Number(invAfter.total_qty)).toBe(Number(invBefore.total_qty) + 5);
    expect(Number(invAfter.warehouse_qty)).toBe(Number(invBefore.warehouse_qty) + 5);

    const blindCopyRes = await request(app)
      .post(`/api/intakes/${encodeURIComponent(intakeId)}/blind-copy`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});

    expect(blindCopyRes.statusCode).toBe(200);
    expect(blindCopyRes.body?.header?.status).toBe("generated");
    expect(blindCopyRes.body?.header?.blindCopyNumber).toMatch(/^BTC-/);

    const blindCopyId = blindCopyRes.body.header.id;
    const issueRes = await request(app)
      .post(`/api/blind-copies/${encodeURIComponent(blindCopyId)}/issue`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});

    expect(issueRes.statusCode).toBe(200);
    expect(issueRes.body?.header?.status).toBe("issued");

    const getIntakeRes = await request(app).get(`/api/intakes/${encodeURIComponent(intakeId)}`);
    expect(getIntakeRes.statusCode).toBe(200);
    expect(getIntakeRes.body?.header?.status).toBe("confirmed");

    const getBlindCopyRes = await request(app).get(`/api/blind-copies/${encodeURIComponent(blindCopyId)}`);
    expect(getBlindCopyRes.statusCode).toBe(200);
    expect(Number(getBlindCopyRes.body?.lines?.[0]?.qty)).toBe(5);
  });
});
