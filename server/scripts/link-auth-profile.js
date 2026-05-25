/**
 * Link an existing public.users row to a Supabase Auth user (same email).
 * Run after creating the user in Authentication → Users.
 *
 *   USER_EMAIL=owner@example.com node scripts/link-auth-profile.js
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getSupabaseAdmin } from "../src/lib/supabase.js";
import { hasAuthUserIdColumn } from "../src/lib/auth-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
for (const rel of ["../../.env", "../.env"]) {
  try {
    const env = readFileSync(join(__dirname, rel), "utf8");
    for (const line of env.split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* ignore */
  }
}

const email = String(process.env.USER_EMAIL || process.env.OWNER_EMAIL || "").trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Set USER_EMAIL (or OWNER_EMAIL) to the profile email.");
  process.exit(1);
}

if (!(await hasAuthUserIdColumn())) {
  console.error("Run the migration first: node scripts/print-auth-migration.js");
  process.exit(1);
}

const client = getSupabaseAdmin();

const { data: profile, error: profileError } = await client
  .from("users")
  .select("id,email,auth_user_id")
  .eq("email", email)
  .maybeSingle();

if (profileError) {
  console.error("Profile lookup failed:", profileError.message);
  process.exit(1);
}
if (!profile) {
  console.error(`No row in public.users for ${email}. Add the profile first (User Management or SQL).`);
  process.exit(1);
}
if (profile.auth_user_id) {
  console.log(`Already linked: ${profile.email} → ${profile.auth_user_id}`);
  process.exit(0);
}

const { data: list, error: listError } = await client.auth.admin.listUsers({ perPage: 1000 });
if (listError) {
  console.error("Auth list failed:", listError.message);
  process.exit(1);
}

const authUser = (list?.users ?? []).find((u) => u.email?.toLowerCase() === email);
if (!authUser) {
  console.error(`No Supabase Auth user for ${email}. Create them under Authentication → Users first.`);
  process.exit(1);
}

const { error: updateError } = await client
  .from("users")
  .update({ auth_user_id: authUser.id, password_hash: null })
  .eq("id", profile.id);

if (updateError) {
  console.error("Link failed:", updateError.message);
  process.exit(1);
}

console.log(`Linked ${profile.email} (profile ${profile.id}) → Auth ${authUser.id}`);
