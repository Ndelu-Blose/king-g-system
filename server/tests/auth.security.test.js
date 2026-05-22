import request from "supertest";
import app from "../src/app.js";
import { credentialsValid } from "../src/lib/auth-credentials.js";
import { hashPassword } from "../src/lib/passwords.js";

describe("auth security", () => {
  describe("credentialsValid", () => {
    it("rejects users without password_hash", () => {
      expect(credentialsValid({ passwordHash: null }, "any-password")).toBe(false);
      expect(credentialsValid({ passwordHash: "" }, "secret")).toBe(false);
    });

    it("rejects empty password", () => {
      const hash = hashPassword("correct");
      expect(credentialsValid({ passwordHash: hash }, "")).toBe(false);
    });

    it("accepts matching password hash", () => {
      const hash = hashPassword("correct-horse");
      expect(credentialsValid({ passwordHash: hash }, "correct-horse")).toBe(true);
      expect(credentialsValid({ passwordHash: hash }, "wrong")).toBe(false);
    });
  });

  describe("POST /api/auth/login", () => {
    it("does not authenticate wildcard email patterns", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "%", password: "anything" });
      expect(res.statusCode).toBe(401);
      expect(res.body?.error).toMatch(/invalid credentials/i);
    });

    it("does not authenticate underscore wildcard email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "___", password: "anything" });
      expect(res.statusCode).toBe(401);
    });
  });
});
