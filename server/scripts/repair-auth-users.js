/**
 * Create Supabase Auth accounts for public.users rows missing auth_user_id.
 * Usage: node server/scripts/repair-auth-users.js
 * Optional: USER_EMAIL=someone@example.com TEMP_PASSWORD='TempPass123' node server/scripts/repair-auth-users.js
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const { getSupabaseAdmin } = await import("../src/lib/supabase.js");

const onlyEmail = process.env.USER_EMAIL?.trim().toLowerCase();
const tempPassword = process.env.TEMP_PASSWORD || "KingGTemp123!";

const client = getSupabaseAdmin();

let query = client.from("users").select("id,name,email,role,active,auth_user_id").is("auth_user_id", null);
if (onlyEmail) query = query.eq("email", onlyEmail);

const { data: rows, error } = await query;
if (error) {
  console.error(error.message);
  process.exit(1);
}

if (!rows?.length) {
  console.log("No users need repair.");
  process.exit(0);
}

for (const row of rows) {
  const email = row.email.trim().toLowerCase();
  console.log(`Repairing ${email}…`);

  const { data: authData, error: authError } = await client.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { display_name: row.name },
  });

  if (authError) {
    if (/already registered|already exists/i.test(authError.message)) {
      const { data: list } = await client.auth.admin.listUsers({ perPage: 1000 });
      const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
      if (!existing) {
        console.error(`  Auth exists but could not find user: ${authError.message}`);
        continue;
      }
      const { error: linkError } = await client
        .from("users")
        .update({ auth_user_id: existing.id, password_hash: null })
        .eq("id", row.id);
      if (linkError) console.error(`  Link failed: ${linkError.message}`);
      else console.log(`  Linked to existing Auth user ${existing.id}`);
      continue;
    }
    console.error(`  Auth create failed: ${authError.message}`);
    continue;
  }

  const authId = authData.user?.id;
  if (!authId) {
    console.error("  No auth user id returned");
    continue;
  }

  const { error: updateError } = await client
    .from("users")
    .update({ auth_user_id: authId, password_hash: null })
    .eq("id", row.id);

  if (updateError) {
    console.error(`  Profile link failed: ${updateError.message}`);
    await client.auth.admin.deleteUser(authId).catch(() => {});
    continue;
  }

  console.log(`  OK — auth_user_id=${authId} (temp password: ${tempPassword})`);
}

console.log("Done.");
