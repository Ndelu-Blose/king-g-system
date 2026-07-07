/**
 * Seed beverage catalog into Supabase (products + inventory rows at 0 stock).
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in repo root .env
 *
 * Usage: node server/scripts/seed-beverage-stock.js
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const { seedBeverageCatalog } = await import("../src/services/pos.service.js");

try {
  const result = await seedBeverageCatalog();
  console.log(`Seeded ${result.count} beverages (prices set to 0 — update later in Products).`);
} catch (e) {
  console.error(e?.message || e);
  process.exit(1);
}
