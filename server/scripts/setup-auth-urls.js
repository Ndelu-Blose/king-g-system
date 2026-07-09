/**
 * Set Supabase Auth site_url and redirect allow-list for deployed King G.
 * Usage: node server/scripts/setup-auth-urls.js
 * Optional: APP_URL=https://your-frontend.example.com node server/scripts/setup-auth-urls.js
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PROJECT_REF = "tpydiklyduxjkvenfvzd";
const PRODUCTION_APP_URL =
  (process.env.APP_URL || "https://king-g-system.vercel.app").replace(/\/$/, "");

const LOCAL_REDIRECTS = [
  "http://localhost:8080/**",
  "http://localhost:8081/**",
  "http://127.0.0.1:8080/**",
  "http://127.0.0.1:8081/**",
];

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

function buildAllowList() {
  const production = [
    `${PRODUCTION_APP_URL}`,
    `${PRODUCTION_APP_URL}/**`,
    `${PRODUCTION_APP_URL}/login`,
    `${PRODUCTION_APP_URL}/login/**`,
    `${PRODUCTION_APP_URL}/reset-password`,
    `${PRODUCTION_APP_URL}/reset-password/**`,
  ];
  return [...new Set([...production, ...LOCAL_REDIRECTS])].join(",");
}

async function patchAuthUrls(token) {
  const body = {
    site_url: PRODUCTION_APP_URL,
    uri_allow_list: buildAllowList(),
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
    throw new Error(`Auth URL update failed (${res.status}): ${text}`);
  }

  return res.json();
}

async function main() {
  const token = getAccessToken();
  console.log(`Setting Supabase Auth site_url to ${PRODUCTION_APP_URL}…`);
  const config = await patchAuthUrls(token);
  console.log("Done.");
  console.log(`  site_url: ${config.site_url}`);
  console.log(`  uri_allow_list:\n${config.uri_allow_list}`);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
