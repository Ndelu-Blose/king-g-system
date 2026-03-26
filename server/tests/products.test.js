import request from "supertest";
import app from "../src/app.js";

describe("GET /api/products", () => {
  it("returns an array", async () => {
    const res = await request(app).get("/api/products");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

