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
      [{ id: "31", name: "Owner", email: "blind-owner@kingg.co.za", role: "owner", password_hash: null }],
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

  await client.from("inventory").upsert([{ product_id: "1", total_qty: 1000, lounge_qty: 0, warehouse_qty: 1000 }], { onConflict: "product_id" });
}

async function login(email) {
  const res = await request(app).post("/api/auth/login").send({ email, password: "dev" });
  expect(res.statusCode).toBe(200);
  return res.body.token;
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

async function countBlindCopiesForIntake(intakeId) {
  const client = getSupabaseAdmin();
  const { data, error } = await client.from("blind_transfer_copies").select("id").eq("intake_id", intakeId);
  if (error) throw error;
  return (data ?? []).length;
}

;(supabaseConfigured ? describe : describe.skip)("Blind copy / transfer integrity + idempotency", () => {
  const OWNER_EMAIL = "blind-owner@kingg.co.za";
  let ownerToken;

  jest.setTimeout(30000);

  beforeAll(async () => {
    await seedUsersAndInventory();
    ownerToken = await login(OWNER_EMAIL);
  });

  it("generates blind copy once per intake; duplicate generation does not create new copies; issue is idempotent", async () => {
    const intakeNumber = `IN-BLIND-001-${Date.now()}`;
    const intakeRes = await request(app)
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
        notes: "Blind copy chain test",
        status: "draft",
      });
    expect(intakeRes.statusCode).toBe(201);
    const intakeId = intakeRes.body?.header?.id;
    expect(intakeId).toBeTruthy();

    const lineId = `LINE-BLIND-${Date.now()}`;
    const expectedQty = 7;
    const expectedRes = await request(app)
      .post(`/api/intakes/${encodeURIComponent(intakeId)}/expected-lines`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        lines: [
          {
            id: lineId,
            productId: "1",
            expectedQty,
            unitOfMeasure: "ea",
            unitCostOptional: null,
            batchNumber: null,
            expiryDate: null,
            discrepancyReason: null,
            destinationLocation: "Front Store A",
          },
        ],
      });
    expect(expectedRes.statusCode).toBe(200);

    const verificationRes = await request(app)
      .post(`/api/intakes/${encodeURIComponent(intakeId)}/verification`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        status: "physical_verified",
        lines: [
          {
            id: lineId,
            productId: "1",
            expectedQty,
            actualQty: expectedQty,
            decision: "accept",
            discrepancyReason: null,
            destinationLocation: "Front Store A",
            verificationNotes: "Verified",
          },
        ],
      });
    expect(verificationRes.statusCode).toBe(200);

    const confirmRes = await request(app)
      .post(`/api/intakes/${encodeURIComponent(intakeId)}/confirm`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    expect(confirmRes.statusCode).toBe(200);
    expect(confirmRes.body?.header?.status).toBe("confirmed");

    const auditGenBefore = await countAuditForEntity({ action: "blind_copy.generated", entityId: intakeId, entityType: "intake" });

    // Generate blind copy first time.
    const blindGen1 = await request(app)
      .post(`/api/intakes/${encodeURIComponent(intakeId)}/blind-copy`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    expect(blindGen1.statusCode).toBe(200);

    const blindCopyId1 = blindGen1.body?.header?.id;
    expect(blindCopyId1).toBeTruthy();
    expect(blindGen1.body?.header?.intakeId).toBe(intakeId);

    const blindCopiesAfter1 = await countBlindCopiesForIntake(intakeId);
    expect(blindCopiesAfter1).toBe(1);

    // Generate blind copy second time: should be idempotent.
    const blindGen2 = await request(app)
      .post(`/api/intakes/${encodeURIComponent(intakeId)}/blind-copy`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    expect(blindGen2.statusCode).toBe(200);

    const blindCopyId2 = blindGen2.body?.header?.id;
    expect(blindCopyId2).toBe(blindCopyId1);

    const blindCopiesAfter2 = await countBlindCopiesForIntake(intakeId);
    expect(blindCopiesAfter2).toBe(1);

    // Blind copy lines should match accepted qty.
    const blindGet = await request(app).get(`/api/blind-copies/${encodeURIComponent(blindCopyId1)}`);
    expect(blindGet.statusCode).toBe(200);
    expect(Number(blindGet.body?.lines?.[0]?.qty)).toBe(expectedQty);

    // Audit generation should not double-count.
    const auditGenAfter2 = await countAuditForEntity({ action: "blind_copy.generated", entityId: intakeId, entityType: "intake" });
    expect(auditGenAfter2).toBe(auditGenBefore + 1);

    // Issue blind copy first time.
    const issue1 = await request(app)
      .post(`/api/blind-copies/${encodeURIComponent(blindCopyId1)}/issue`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    expect(issue1.statusCode).toBe(200);
    expect(issue1.body?.header?.status).toBe("issued");

    const auditIssueBefore = await countAuditForEntity({ action: "blind_copy.issued", entityId: blindCopyId1, entityType: "blind_copy" });
    expect(auditIssueBefore).toBeLessThanOrEqual(1);

    // Issue second time: idempotent.
    const issue2 = await request(app)
      .post(`/api/blind-copies/${encodeURIComponent(blindCopyId1)}/issue`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    expect(issue2.statusCode).toBe(200);
    expect(issue2.body?.header?.status).toBe("issued");

    const auditIssueAfter = await countAuditForEntity({ action: "blind_copy.issued", entityId: blindCopyId1, entityType: "blind_copy" });
    // Idempotency expectation: repeated "issue" should not create duplicate audit rows.
    expect(auditIssueAfter).toBe(auditIssueBefore);
  });
});

