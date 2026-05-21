import request from "supertest";
import app from "../src/app.js";
import { getSupabaseAdmin } from "../src/lib/supabase.js";
import { isRealSupabaseConfigured } from "./test-utils.js";
import { jest } from "@jest/globals";

const supabaseConfigured = isRealSupabaseConfigured();

async function seedUsersAndInventory() {
  const client = getSupabaseAdmin();
  await client
    .from("users")
    .upsert(
      [
        { id: "21", name: "Owner", email: "recv-owner@kingg.co.za", role: "owner", password_hash: null },
        { id: "22", name: "Cashier", email: "recv-cashier@kingg.co.za", role: "cashier", password_hash: null },
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

  await client.from("inventory").upsert([{ product_id: "1", total_qty: 100, lounge_qty: 0, warehouse_qty: 100 }], { onConflict: "product_id" });
}

async function login(email) {
  const res = await request(app).post("/api/auth/login").send({ email, password: "dev" });
  expect(res.statusCode).toBe(200);
  return res.body.token;
}

async function getInventoryTotal() {
  const client = getSupabaseAdmin();
  const { data, error } = await client.from("inventory").select("total_qty").eq("product_id", "1").single();
  if (error) throw error;
  return Number(data?.total_qty ?? 0);
}

async function countAuditForEntity({ action, entityId, entityType }) {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from("audit_log")
    .select("id")
    .eq("action", action)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  if (error) throw error;
  return (data ?? []).length;
}

function buildExpectedLinesPayload({ lineId, productId, expectedQty }) {
  return {
    lines: [
      {
        id: lineId,
        productId,
        expectedQty,
        unitOfMeasure: "ea",
        unitCostOptional: null,
        batchNumber: null,
        expiryDate: null,
        discrepancyReason: null,
        destinationLocation: "Front Store A",
      },
    ],
  };
}

function buildVerificationPayload({ lineId, productId, qty, decision }) {
  return {
    status: "physical_verified",
    lines: [
      {
        id: lineId,
        productId,
        expectedQty: qty,
        actualQty: qty,
        decision,
        discrepancyReason: null,
        destinationLocation: "Front Store A",
        verificationNotes: "Count OK",
      },
    ],
  };
}

;(supabaseConfigured ? describe : describe.skip)("Inventory receiving + idempotency", () => {
  const OWNER_EMAIL = "recv-owner@kingg.co.za";
  const CASHIER_EMAIL = "recv-cashier@kingg.co.za";

  jest.setTimeout(30000);

  let ownerToken;
  let cashierToken;

  beforeAll(async () => {
    await seedUsersAndInventory();
    ownerToken = await login(OWNER_EMAIL);
    cashierToken = await login(CASHIER_EMAIL);
  });

  it("confirms intake exactly once; second confirm does not double-apply inventory; audit is not duplicated", async () => {
    const invBefore = await getInventoryTotal();
    const intakeNumber = `IN-RECV-001-${Date.now()}`;

    const draftRes = await request(app)
      .post("/api/intakes/draft")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        intakeNumber,
        supplier: "Test Supplier",
        invoiceNumber: `INV-${intakeNumber}`,
        deliveryReference: `DEL-${intakeNumber}`,
        deliveryDate: "2026-03-26",
        branchSite: "Main",
        receiveIntoLocation: "warehouse",
        receivedBy: "King G",
        notes: "Test intake for idempotency",
        status: "draft",
      });
    expect(draftRes.statusCode).toBe(201);

    const intakeId = draftRes.body?.header?.id;
    expect(intakeId).toBeTruthy();

    const lineId = `LINE-RECV-${Date.now()}`;
    const expectedQty = 5;
    const expectedRes = await request(app)
      .post(`/api/intakes/${encodeURIComponent(intakeId)}/expected-lines`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(buildExpectedLinesPayload({ lineId, productId: "1", expectedQty }));
    expect(expectedRes.statusCode).toBe(200);

    const verificationRes = await request(app)
      .post(`/api/intakes/${encodeURIComponent(intakeId)}/verification`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(buildVerificationPayload({ lineId, productId: "1", qty: expectedQty, decision: "accept" }));
    expect(verificationRes.statusCode).toBe(200);

    // Confirm once.
    const auditCountBefore = await countAuditForEntity({ action: "intake.confirmed", entityId: intakeId, entityType: "intake" });
    expect(auditCountBefore).toBeLessThanOrEqual(1);

    const confirmRes1 = await request(app)
      .post(`/api/intakes/${encodeURIComponent(intakeId)}/confirm`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    expect(confirmRes1.statusCode).toBe(200);
    expect(confirmRes1.body?.header?.status).toBe("confirmed");

    const invAfter1 = await getInventoryTotal();
    expect(invAfter1).toBe(invBefore + expectedQty);

    const auditCountAfter1 = await countAuditForEntity({ action: "intake.confirmed", entityId: intakeId, entityType: "intake" });
    expect(auditCountAfter1).toBe(auditCountBefore + 1);

    // Confirm second time: no further stock changes.
    const confirmRes2 = await request(app)
      .post(`/api/intakes/${encodeURIComponent(intakeId)}/confirm`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    expect(confirmRes2.statusCode).toBe(200);
    expect(confirmRes2.body?.header?.status).toBe("confirmed");

    const invAfter2 = await getInventoryTotal();
    expect(invAfter2).toBe(invAfter1);

    const auditCountAfter2 = await countAuditForEntity({ action: "intake.confirmed", entityId: intakeId, entityType: "intake" });
    expect(auditCountAfter2).toBe(auditCountAfter1);
  });

  it("cashier cannot confirm intake (permission 403)", async () => {
    const intakeNumber = `IN-RECV-002-${Date.now()}`;
    const draftRes = await request(app)
      .post("/api/intakes/draft")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        intakeNumber,
        supplier: "Test Supplier",
        invoiceNumber: `INV-${intakeNumber}`,
        deliveryReference: `DEL-${intakeNumber}`,
        deliveryDate: "2026-03-26",
        branchSite: "Main",
        receiveIntoLocation: "warehouse",
        receivedBy: "King G",
        notes: "Cashier confirm permission check",
        status: "draft",
      });
    expect(draftRes.statusCode).toBe(201);
    const intakeId = draftRes.body?.header?.id;
    expect(intakeId).toBeTruthy();

    const lineId = `LINE-RECV-${Date.now()}`;
    const expectedRes = await request(app)
      .post(`/api/intakes/${encodeURIComponent(intakeId)}/expected-lines`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(buildExpectedLinesPayload({ lineId, productId: "1", expectedQty: 1 }));
    expect(expectedRes.statusCode).toBe(200);

    const confirmAttempt = await request(app)
      .post(`/api/intakes/${encodeURIComponent(intakeId)}/confirm`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({});
    expect(confirmAttempt.statusCode).toBe(403);
  });
});

