import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PROJECT_REF = "tpydiklyduxjkvenfvzd";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const PRODUCTION_APP_URL = (process.env.APP_URL || "https://king-g-system.vercel.app").replace(
  /\/$/,
  "",
);

if (!RESEND_API_KEY) {
  console.error("Missing RESEND_API_KEY in .env");
  process.exit(1);
}

function getAccessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    return process.env.SUPABASE_ACCESS_TOKEN.trim();
  }
  try {
    const scriptPath = path.resolve(__dirname, "get-supabase-access-token.ps1");
    const token = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
    if (token) return token;
  } catch {
    /* fall through */
  }
  console.error(
    "Could not read Supabase access token. Set SUPABASE_ACCESS_TOKEN in .env " +
      "(create one at https://supabase.com/dashboard/account/tokens) and re-run.",
  );
  process.exit(1);
}

const hookSecret = `v1,whsec_${randomBytes(32).toString("base64")}`;
const functionUrl = `https://${PROJECT_REF}.supabase.co/functions/v1/auth-send-email`;

async function patchAuthConfig(token) {
  const allowList = [
    `${PRODUCTION_APP_URL}`,
    `${PRODUCTION_APP_URL}/**`,
    `${PRODUCTION_APP_URL}/login`,
    `${PRODUCTION_APP_URL}/reset-password`,
    `${PRODUCTION_APP_URL}/reset-password/**`,
    "http://localhost:8080/**",
    "http://localhost:8081/**",
  ].join(",");

  const body = {
    site_url: PRODUCTION_APP_URL,
    uri_allow_list: allowList,
    external_email_enabled: true,
    smtp_admin_email: FROM_EMAIL,
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: RESEND_API_KEY,
    smtp_sender_name: "King G",
    // Branded templates via edge function (all Supabase Auth emails).
    hook_send_email_enabled: true,
    hook_send_email_uri: functionUrl,
    hook_send_email_secrets: hookSecret,
  };

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth config update failed (${res.status}): ${text}`);
  }
}

async function main() {
  console.log("Setting Supabase secrets…");
  execSync(
    `npx supabase secrets set RESEND_API_KEY="${RESEND_API_KEY}" RESEND_FROM_EMAIL="${FROM_EMAIL}" SEND_EMAIL_HOOK_SECRET="${hookSecret}" RESEND_FROM_NAME="King G" APP_URL="${PRODUCTION_APP_URL}"`,
    { stdio: "inherit", cwd: path.resolve(__dirname, "../..") },
  );

  console.log("Deploying auth-send-email edge function…");
  execSync("npx supabase functions deploy auth-send-email --no-verify-jwt", {
    stdio: "inherit",
    cwd: path.resolve(__dirname, "../.."),
  });

  const token = getAccessToken();
  console.log("Enabling branded King G auth email hook (Resend)…");
  await patchAuthConfig(token);

  console.log("Done. All King G auth emails now use the branded Resend templates.");
  console.log(`  Hook URL: ${functionUrl}`);
  console.log("  Re-run after template changes: deploy auth-send-email, then redeploy API for staff emails.");
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
