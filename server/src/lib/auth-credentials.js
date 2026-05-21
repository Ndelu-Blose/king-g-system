import { verifyPassword } from "./passwords.js";

/**
 * Returns true when password matches the stored hash.
 * Users without password_hash cannot sign in (no passwordless fallback in production).
 */
export function credentialsValid(user, password) {
  if (!password || !String(password).length) return false;
  if (!user?.passwordHash) return false;
  return verifyPassword(password, user.passwordHash);
}
