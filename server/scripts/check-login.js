/**
 * Quick login diagnostics. Usage: node server/scripts/check-login.js [email] [password]
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const email = process.argv[2]?.trim().toLowerCase();
const password = process.argv[3] ?? "";

const { getSupabaseAdmin } = await import("../src/lib/supabase.js");
const { signInWithSupabaseAuth } = await import("../src/lib/auth-supabase.js");
const { getUserByEmail } = await import("../src/services/users.service.js");

const client = getSupabaseAdmin();
const { data: users } = await client
  .from("users")
  .select("id,email,role,active,auth_user_id")
  .order("email");

console.log("\nUsers in database:");
for (const u of users ?? []) {
  console.log(
    `  ${u.active ? "✓" : "✗"} ${u.email} (${u.role}) auth=${u.auth_user_id ? "yes" : "NO"}`
  );
}

if (!email) {
  console.log("\nPass email + password to test sign-in, e.g.:");
  console.log("  node server/scripts/check-login.js goodwill.madlazi@gmail.com Goodwill123");
  process.exit(0);
}

const profile = await getUserByEmail(email);
console.log(`\nProfile for ${email}:`, profile ? "found" : "NOT FOUND");
if (profile) {
  console.log(`  active=${profile.active} authUserId=${profile.authUserId ?? "null"} legacyHash=${profile.passwordHash ? "yes" : "no"}`);
}

if (!password) process.exit(0);

const supa = await signInWithSupabaseAuth(email, password);
console.log("\nSupabase sign-in:", supa?.ok ? "OK" : supa?.error ?? "failed");

const apiRes = await fetch("http://localhost:3001/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const apiBody = await apiRes.json();
console.log("API login:", apiRes.status, apiBody.error || apiBody.hint || "OK");
