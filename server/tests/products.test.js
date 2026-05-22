import request from "supertest";
import app from "../src/app.js";

import { isRealSupabaseConfigured } from "./test-utils.js";

const supabaseConfigured = isRealSupabaseConfigured();

(supabaseConfigured ? describe : describe.skip)("GET /api/products", () => {
  it("returns an array", async () => {
    const res = await request(app).get("/api/products");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

