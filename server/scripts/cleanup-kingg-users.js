/**
 * Keep only specified King G users in the CORRECT Supabase project (.env SUPABASE_URL).
 * Usage: node server/scripts/cleanup-kingg-users.js
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const KEEP_EMAILS = new Set(["goodwill.madlazi@gmail.com"]);

const DEBUG_ENDPOINT = "http://127.0.0.1:7617/ingest/fe06f2ec-2a83-4b03-b45f-cadf002a9913";
const SESSION_ID = "470153";

// #region agent log
function debugLog(hypothesisId, location, message, data) {
  fetch(DEBUG_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": SESSION_ID },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      runId: "cleanup-post-fix",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

const { getSupabaseAdmin } = await import("../src/lib/supabase.js");
const client = getSupabaseAdmin();

const projectRef = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];

const { data: profiles } = await client.from("users").select("id,email,auth_user_id");
const { data: authList } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });

const profilesToRemove = (profiles ?? []).filter(
  (p) => !KEEP_EMAILS.has(String(p.email).toLowerCase()),
);
const authToRemove = (authList?.users ?? []).filter(
  (u) => !KEEP_EMAILS.has(String(u.email).toLowerCase()),
);

// #region agent log
debugLog("FIX", "cleanup-kingg-users.js:before", "planned removals", {
  projectRef,
  keep: [...KEEP_EMAILS],
  removeProfiles: profilesToRemove.map((p) => p.email),
  removeAuth: authToRemove.map((u) => u.email),
});
// #endregion

for (const row of profilesToRemove) {
  const { error } = await client.from("users").delete().eq("id", row.id);
  if (error) throw new Error(`Failed to delete profile ${row.email}: ${error.message}`);
}

for (const user of authToRemove) {
  const { error } = await client.auth.admin.deleteUser(user.id);
  if (error) throw new Error(`Failed to delete auth user ${user.email}: ${error.message}`);
}

const { data: profilesAfter } = await client.from("users").select("email,role,active,auth_user_id");
const { data: authAfter } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });

// #region agent log
debugLog("FIX", "cleanup-kingg-users.js:after", "remaining users", {
  projectRef,
  profiles: profilesAfter,
  authEmails: (authAfter?.users ?? []).map((u) => u.email),
});
// #endregion

console.log("Cleanup complete on project:", projectRef);
console.log("Remaining profiles:", profilesAfter);
console.log(
  "Remaining auth:",
  (authAfter?.users ?? []).map((u) => u.email),
);
