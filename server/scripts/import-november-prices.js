/**
 * Import selling price (SP) and brewer cost (COSTP) from NOVEMBER REPORT.xlsx
 * into public.products (base_price, cost_price).
 *
 * Usage:
 *   node server/scripts/import-november-prices.js [path-to-xlsx]
 *
 * Defaults to server/data/november-report-prices.json if no xlsx path is given.
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const catalogPath = path.resolve(__dirname, "../data/beverage-stock.json");
const snapshotPath = path.resolve(__dirname, "../data/november-report-prices.json");
const defaultXlsx =
  "c:/Users/Zwelethu Sec/AppData/Local/Packages/5319275A.WhatsAppDesktop_cv1g1gvanyjgm/LocalState/sessions/0459A46FC321109FD7042310D61FA7D51A57A6E8/transfers/2026-27/NOVEMBER REPORT.xlsx";

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

/** Excel typos / alternate spellings → catalog product id (size still matched separately). */
const ID_ALIASES = {
  redsquareblieice: "bev-023",
  redsquareblueice: "bev-023",
  bahamamargaret: "bev-020",
  bahamamargarita: "bev-020",
  oldbug: "bev-051",
  oldbuck: "bev-051",
  tanquerraysevilla: "bev-052",
  tanqueraysevilla: "bev-052",
  henessyvsop: "bev-057",
  hennessyvsop: "bev-057",
  henessyveryspecial: "bev-058",
  hennessyveryspecial: "bev-058",
  jagermist: "bev-059",
  jagermeister: "bev-059",
  water: "bev-062",
};

function normName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/bernin(?!i)/g, "bernini")
    .replace(/blie/g, "blue")
    .replace(/[^a-z0-9]/g, "");
}

function normSize(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n === 1.5) return 1500;
  if (n === 1) return 1000;
  return Math.round(n);
}

function catalogById() {
  return new Map(catalog.map((p) => [p.id, p]));
}

function findProduct(rowName, sizeMl) {
  const aliasId = ID_ALIASES[normName(rowName)];
  if (aliasId) {
    const hit = catalog.find((p) => p.id === aliasId && p.sizeMl === sizeMl);
    if (hit) return hit;
  }

  const needle = normName(rowName);
  const matches = catalog.filter((p) => {
    if (p.sizeMl !== sizeMl) return false;
    const dn = normName(p.displayName || p.name);
    const full = normName(p.name);
    return dn === needle || full.includes(needle) || needle.includes(dn);
  });

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const exact = matches.find((p) => normName(p.displayName) === needle);
    if (exact) return exact;
  }
  return null;
}

function parseStocktakeSheet(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath);
  const sheet = wb.Sheets["NOVEMBER STOCKTAKE"];
  if (!sheet) throw new Error('Sheet "NOVEMBER STOCKTAKE" not found');

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const parsed = [];

  for (const row of rows.slice(1)) {
    const name = String(row[0] || "").trim();
    if (!name) continue;

    const sizeMl = normSize(row[1]);
    const sellingPrice = Number(row[7]);
    const costPrice = Number(row[9]);

    if (!sizeMl || !Number.isFinite(sellingPrice) || !Number.isFinite(costPrice)) continue;

    parsed.push({
      sourceName: name,
      sizeMl,
      sellingPrice,
      costPrice,
    });
  }

  return parsed;
}

function buildPriceUpdates(rows) {
  const byId = catalogById();
  const updates = [];
  const unmatched = [];

  for (const row of rows) {
    const product = findProduct(row.sourceName, row.sizeMl);
    if (!product) {
      unmatched.push(row);
      continue;
    }

    updates.push({
      id: product.id,
      name: product.name,
      basePrice: row.sellingPrice,
      costPrice: row.costPrice,
      sourceName: row.sourceName,
      sizeMl: row.sizeMl,
    });
    byId.set(product.id, {
      ...product,
      basePrice: row.sellingPrice,
      costPrice: row.costPrice,
    });
  }

  return { updates, unmatched, catalog: [...byId.values()] };
}

async function applyToDatabase(updates) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  }

  const { getSupabaseAdmin } = await import("../src/lib/supabase.js");
  const client = getSupabaseAdmin();

  let ok = 0;
  for (const row of updates) {
    const { error } = await client
      .from("products")
      .update({ base_price: row.basePrice, cost_price: row.costPrice })
      .eq("id", row.id);
    if (error) throw error;
    ok += 1;
  }
  return ok;
}

function writeSnapshot(updates) {
  fs.writeFileSync(
    snapshotPath,
    JSON.stringify(
      {
        importedAt: new Date().toISOString(),
        source: "NOVEMBER REPORT.xlsx — NOVEMBER STOCKTAKE (SP = selling, COSTP = brewer cost)",
        count: updates.length,
        prices: updates.map((u) => ({
          id: u.id,
          name: u.name,
          sizeMl: u.sizeMl,
          basePrice: u.basePrice,
          costPrice: u.costPrice,
          sourceName: u.sourceName,
        })),
      },
      null,
      2
    ),
    "utf8"
  );
}

function writeCatalog(catalogRows) {
  const sorted = [...catalogRows].sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(catalogPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

function loadRows(input) {
  if (input && input.endsWith(".json")) {
    const snapshot = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
    return snapshot.prices.map((p) => ({
      sourceName: p.sourceName || p.name,
      sizeMl: p.sizeMl,
      sellingPrice: p.basePrice,
      costPrice: p.costPrice,
    }));
  }
  if (input) return parseStocktakeSheet(path.resolve(input));
  if (fs.existsSync(snapshotPath)) {
    console.log(`Using price snapshot ${snapshotPath}`);
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
    return snapshot.prices.map((p) => ({
      sourceName: p.sourceName || p.name,
      sizeMl: p.sizeMl,
      sellingPrice: p.basePrice,
      costPrice: p.costPrice,
    }));
  }
  if (fs.existsSync(defaultXlsx)) return parseStocktakeSheet(defaultXlsx);
  throw new Error("No price source found. Pass an .xlsx path or add server/data/november-report-prices.json");
}

async function main() {
  const rows = loadRows(process.argv[2]);

  const { updates, unmatched, catalog: nextCatalog } = buildPriceUpdates(rows);

  console.log(`Matched ${updates.length} products for price update.`);

  if (unmatched.length) {
    console.log("\nUnmatched rows (skipped):");
    for (const row of unmatched) {
      console.log(`  - ${row.sourceName} (${row.sizeMl}ml) SP=${row.sellingPrice} COST=${row.costPrice}`);
    }
  }

  writeSnapshot(updates);
  writeCatalog(nextCatalog);
  console.log(`Wrote ${snapshotPath}`);
  console.log(`Updated ${catalogPath}`);

  const count = await applyToDatabase(updates);
  console.log(`\nUpdated ${count} rows in Supabase (base_price = SP, cost_price = COSTP).`);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
