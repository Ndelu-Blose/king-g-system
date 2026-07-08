import request from "supertest";
import app from "../src/app.js";

describe("GET /api/health", () => {
  it("returns 200 with ok=true and capability flags", async () => {
    const res = await request(app).get("/api/health");
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      resend: expect.any(Boolean),
      supabaseAdmin: expect.any(Boolean),
      userEmailsReady: expect.any(Boolean),
    });
    expect(Object.prototype.hasOwnProperty.call(res.body, "appUrl")).toBe(true);
    expect(res.body.appUrl === null || typeof res.body.appUrl === "string").toBe(true);
  });
});

