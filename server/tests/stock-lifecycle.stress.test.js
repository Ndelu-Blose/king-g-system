import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import request from "supertest";
import { getSupabaseAdmin } from "../src/lib/supabase.js";
import { isRealSupabaseConfigured } from "./test-utils.js";
import {
  app,
  auth,
  expectBalanced,
  movements,
  owner,
  postSale,
  salePayload,
  seedProduct,
  seedStockUsers,
  stock,
  transfer,
} from "./stock-fixtures.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, "server", ".env") });

const configured = isRealSupabaseConfigured();
const saleIds = [];

async function receive(productId, qty, location) {
  return request(app)
    .post("/api/inventory/receive")
    .set(auth(owner))
    .send({ productId, qty, location, invoiceNumber: `STRESS-${productId}` });
}

async function writeOff(productId, qty, location, reasonCode) {
  return request(app)
    .post("/api/inventory/adjustments")
    .set(auth(owner))
    .send({ productId, qty, location, reasonCode });
}

async function cleanup(productId) {
  const client = getSupabaseAdmin();
  const { data: lines } = await client.from("sale_items").select("sale_id").eq("product_id", productId);
  const ids = [...new Set([...(lines ?? []).map((line) => line.sale_id), ...saleIds])];
  saleIds.length = 0;
  if (ids.length) {
    await client.from("sale_items").delete().in("sale_id", ids);
    await client.from("sales").delete().in("id", ids);
  }
  await client.from("stock_movements").delete().eq("product_id", productId);
  await client.from("audit_log").delete().eq("entity_id", productId);
  await client.from("inventory").delete().eq("product_id", productId);
  await client.from("products").delete().eq("id", productId);
}

(configured ? describe : describe.skip)("stock movement stress", () => {
  beforeAll(seedStockUsers);

  it("follows arrival, a move, a write-off, and a sale", async () => {
    const productId = await seedProduct({ lounge: 0, warehouse: 0, total: 0, name: "Stress bottle" });
    try {
      const arrived = await receive(productId, 30, "warehouse");
      expect(arrived.statusCode).toBe(201);

      const tooSoon = await postSale(salePayload(productId, 1));
      expect(tooSoon.statusCode).toBeGreaterThanOrEqual(400);

      const moved = await transfer(productId, 12, "warehouse", "lounge");
      expect(moved.statusCode).toBe(201);

      const expired = await writeOff(productId, 4, "warehouse", "expired");
      expect(expired.statusCode).toBe(201);
      const broken = await writeOff(productId, 2, "lounge", "broken");
      expect(broken.statusCode).toBe(201);

      const sold = await postSale(salePayload(productId, 5));
      expect(sold.statusCode).toBe(201);
      saleIds.push(sold.body.id);

      const balances = await stock(productId);
      expect(balances).toEqual({ lounge: 5, warehouse: 14, total: 19 });
      expectBalanced(balances);

      const rows = await movements(productId);
      expect(rows.map((row) => row.type)).toEqual(["RECEIPT", "TRANSFER", "ADJUSTMENT", "ADJUSTMENT", "SALE"]);
      expect(rows.find((row) => row.reason === "Expired").from_location).toBe("warehouse");
      expect(rows.find((row) => row.reason === "Broken bottle").from_location).toBe("lounge");
      expect(rows.find((row) => row.type === "SALE").from_location).toBe("lounge");
      expect(rows.find((row) => row.type === "TRANSFER")).toMatchObject({
        from_location: "warehouse",
        to_location: "lounge",
      });
    } finally {
      await cleanup(productId);
    }
  }, 60000);

  it("keeps the totals when arrivals are moved and sold at the same time", async () => {
    const productId = await seedProduct({ lounge: 0, warehouse: 0, total: 0, name: "Stress burst" });
    try {
      const arrived = await receive(productId, 200, "warehouse");
      expect(arrived.statusCode).toBe(201);

      const moves = await Promise.all(
        Array.from({ length: 20 }, () => transfer(productId, 5, "warehouse", "lounge"))
      );
      expect(moves.every((res) => res.statusCode === 201)).toBe(true);

      const sales = await Promise.all(
        Array.from({ length: 20 }, () => postSale(salePayload(productId, 2)))
      );
      for (const res of sales) {
        expect(res.statusCode).toBe(201);
        saleIds.push(res.body.id);
      }

      const balances = await stock(productId);
      expect(balances).toEqual({ lounge: 60, warehouse: 100, total: 160 });
      expectBalanced(balances);

      const rows = await movements(productId);
      expect(rows.filter((row) => row.type === "RECEIPT")).toHaveLength(1);
      expect(rows.filter((row) => row.type === "TRANSFER")).toHaveLength(20);
      expect(rows.filter((row) => row.type === "SALE")).toHaveLength(20);
    } finally {
      await cleanup(productId);
    }
  }, 120000);
});
