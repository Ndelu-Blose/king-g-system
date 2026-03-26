import request from "supertest";
import app from "../src/app.js";

describe("POST /api/sales", () => {
  it("returns 401 when no Authorization header", async () => {
    const res = await request(app).post("/api/sales").send({ items: [] });
    expect(res.statusCode).toBe(401);
  });
});

