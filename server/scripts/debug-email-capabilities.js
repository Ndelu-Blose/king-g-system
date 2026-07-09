/**
 * Diagnose email capability flags (simulates Vercel API without anon key).
 * Usage: node server/scripts/debug-email-capabilities.js
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const LOG_URL = "http://127.0.0.1:7617/ingest/fe06f2ec-2a83-4b03-b45f-cadf002a9913";

async function log(message, data, hypothesisId) {
  await fetch(LOG_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a458c3" },
    body: JSON.stringify({
      sessionId: "a458c3",
      runId: "capability-diagnostic",
      hypothesisId,
      location: "debug-email-capabilities.js",
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}

async function measure(label, mutateEnv) {
  mutateEnv?.();
  const { isSupabaseAuthEnabled } = await import("../src/lib/auth-supabase.js");
  const { getServerCapabilities } = await import("../src/lib/server-capabilities.js");
  const caps = getServerCapabilities();
  const payload = {
    label,
    supabaseAuth: isSupabaseAuthEnabled(),
    ...caps,
  };
  console.log(JSON.stringify(payload, null, 2));
  await log(`capabilities:${label}`, payload, label.includes("vercel") ? "H2" : "H1");
}

await measure("full-local-env");
delete process.env.SUPABASE_ANON_KEY;
delete process.env.VITE_SUPABASE_ANON_KEY;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
await measure("vercel-like-no-anon-key");
