import crypto from "crypto";

const SCRYPT_KEYLEN = 64;

/** Hash password as `saltHex:hashHex` for storage in users.password_hash. */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

/** Returns true if password matches stored scrypt hash. */
export function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") return false;
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const expected = Buffer.from(expectedHex, "hex");
    const actual = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN);
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
