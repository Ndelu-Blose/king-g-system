/**
 * Set or reset a user's password_hash in Supabase.
 * Usage (from server/):
 *   OWNER_EMAIL=user@example.com OWNER_PASSWORD='new-secure-password' node scripts/set-user-password.js
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { hashPassword } from "../src/lib/passwords.js";
import { getSupabaseAdmin } from "../src/lib/supabase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const email = String(process.env.OWNER_EMAIL || process.env.USER_EMAIL || "").trim().toLowerCase();
const password = String(process.env.OWNER_PASSWORD || process.env.USER_PASSWORD || "");

if (!email || !email.includes("@")) {
  console.error("Set OWNER_EMAIL (or USER_EMAIL) to a valid email.");
  process.exit(1);
}
if (password.length < 6) {
  console.error("Set OWNER_PASSWORD (or USER_PASSWORD) to at least 6 characters.");
  process.exit(1);
}

const client = getSupabaseAdmin();
const { data, error } = await client
  .from("users")
  .update({ password_hash: hashPassword(password) })
  .eq("email", email)
  .select("id,email")
  .maybeSingle();

if (error) {
  console.error("Update failed:", error.message);
  process.exit(1);
}
if (!data) {
  console.error(`No user found with email: ${email}`);
  process.exit(1);
}

console.log(`Password updated for ${data.email} (${data.id}).`);
