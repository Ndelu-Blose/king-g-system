/**
 * Debug auth/profile sync for King G.
 * Usage: node server/scripts/debug-user-sync.js
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const DEBUG_ENDPOINT = "http://127.0.0.1:7617/ingest/fe06f2ec-2a83-4b03-b45f-cadf002a9913";
const SESSION_ID = "470153";

function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname;
    return host.split(".")[0] || null;
  } catch {
    return null;
  }
}

// #region agent log
function debugLog(hypothesisId, location, message, data) {
  const payload = {
    sessionId: SESSION_ID,
    runId: "user-sync-debug",
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  fetch(DEBUG_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": SESSION_ID },
    body: JSON.stringify(payload),
  }).catch(() => {});
  console.log(`[${hypothesisId}] ${message}`, data);
}
// #endregion

const supabaseUrl = process.env.SUPABASE_URL || "";
const projectRef = projectRefFromUrl(supabaseUrl);

// Screenshot UIDs the user shared (for mismatch comparison)
const SCREENSHOT_USERS = [
  { email: "goodwill.madlazi@gmail.com", uid: "b08918f5-e92d-4c18-9c8d-325c6ac4cdb3" },
  { email: "mandisajali379@gmail.com", uid: "e9a24b51-a132-49fe-82f7-504062141454" },
  { email: "mandisanokuphilabiyela@gmail.com", uid: "639a928f-9e6d-4357-9116-6da5c5ed3225" },
];

// #region agent log
debugLog("H1", "debug-user-sync.js:env", "Loaded env project ref", {
  supabaseUrlHost: supabaseUrl ? new URL(supabaseUrl).hostname : null,
  projectRef,
  expectedKingGRef: "tpydiklyduxjkvenfvzd",
  physioMedRef: "suammivasszztkukzjeh",
  refsMatchKingG: projectRef === "tpydiklyduxjkvenfvzd",
  refsMatchPhysioMed: projectRef === "suammivasszztkukzjeh",
});
// #endregion

const { getSupabaseAdmin } = await import("../src/lib/supabase.js");

const client = getSupabaseAdmin();

const { data: profiles, error: profileError } = await client
  .from("users")
  .select("id,name,email,role,active,auth_user_id")
  .order("email");

// #region agent log
debugLog("H2", "debug-user-sync.js:profiles", "public.users rows", {
  count: profiles?.length ?? 0,
  emails: (profiles ?? []).map((p) => p.email),
  error: profileError?.message ?? null,
});
// #endregion

const { data: authList, error: authError } = await client.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});

const authUsers = (authList?.users ?? []).map((u) => ({
  id: u.id,
  email: u.email?.toLowerCase() ?? "",
  displayName: u.user_metadata?.display_name || u.user_metadata?.name || null,
}));

// #region agent log
debugLog("H3", "debug-user-sync.js:auth", "auth.users rows", {
  count: authUsers.length,
  emails: authUsers.map((u) => u.email),
  error: authError?.message ?? null,
});
// #endregion

const profileByEmail = new Map((profiles ?? []).map((p) => [p.email.toLowerCase(), p]));
const authByEmail = new Map(authUsers.map((u) => [u.email, u]));

const onlyInAuth = authUsers.filter((u) => !profileByEmail.has(u.email));
const onlyInProfiles = (profiles ?? []).filter((p) => !authByEmail.has(p.email.toLowerCase()));
const linkedMismatches = (profiles ?? [])
  .filter((p) => p.auth_user_id && authByEmail.get(p.email.toLowerCase())?.id !== p.auth_user_id)
  .map((p) => ({
    email: p.email,
    profileAuthId: p.auth_user_id,
    authId: authByEmail.get(p.email.toLowerCase())?.id ?? null,
  }));

// #region agent log
debugLog("H4", "debug-user-sync.js:sync", "auth vs public.users sync gaps", {
  onlyInAuth: onlyInAuth.map((u) => u.email),
  onlyInProfiles: onlyInProfiles.map((p) => p.email),
  linkedMismatches,
});
// #endregion

const screenshotComparison = SCREENSHOT_USERS.map((expected) => {
  const live = authByEmail.get(expected.email);
  return {
    email: expected.email,
    screenshotUid: expected.uid,
    liveUid: live?.id ?? null,
    uidMatchesScreenshot: live?.id === expected.uid,
    existsInLiveAuth: Boolean(live),
    existsInPublicUsers: profileByEmail.has(expected.email),
  };
});

// #region agent log
debugLog("H5", "debug-user-sync.js:screenshot", "screenshot UID comparison", {
  projectRef,
  screenshotComparison,
  allScreenshotUidsMatch: screenshotComparison.every((r) => r.uidMatchesScreenshot),
});
// #endregion

console.log("\n=== King G user sync report ===");
console.log(`Project: ${projectRef}`);
console.log(`public.users: ${profiles?.length ?? 0}`);
console.log(`auth.users: ${authUsers.length}`);
console.log("\nScreenshot vs live auth UID:");
for (const row of screenshotComparison) {
  console.log(
    `  ${row.email}: screenshot=${row.screenshotUid?.slice(0, 8)}… live=${row.liveUid?.slice(0, 8) ?? "MISSING"}… match=${row.uidMatchesScreenshot}`,
  );
}
