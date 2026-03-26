import request from "supertest";
import app from "../src/app.js";

const supabaseConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

(supabaseConfigured ? describe : describe.skip)("GET /api/products", () => {
  it("returns an array", async () => {
    const res = await request(app).get("/api/products");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

