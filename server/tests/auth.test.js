import request from "supertest";
import app from "../src/app.js";

(Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) ? describe : describe.skip)("POST /api/auth/login", () => {
  it("returns 400 when email is missing", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.statusCode).toBe(400);
  });

  it("returns 401 for unknown email", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "missing@example.com", password: "x" });
    expect(res.statusCode).toBe(401);
  });
});

