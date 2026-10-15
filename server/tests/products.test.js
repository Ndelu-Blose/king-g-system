import request from "supertest";
import app from "../src/app.js";

import { isRealSupabaseConfigured } from "./test-utils.js";
import { auth, cashier, seedStockUsers } from "./stock-fixtures.js";

const supabaseConfigured = isRealSupabaseConfigured();

(supabaseConfigured ? describe : describe.skip)("GET /api/products", () => {
  beforeAll(seedStockUsers);

  it("returns an array for a signed-in user", async () => {
    const res = await request(app).get("/api/products").set(auth(cashier));
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
