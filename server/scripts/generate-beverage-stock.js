/**
 * Generates server/data/beverage-stock.json from the lounge alcohol stock list.
 * Run: node server/scripts/generate-beverage-stock.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {Array<{ name: string; sizeMl: number; category: string }>} */
const RAW = [
  ["SAVANNA DRY", 330, "Cider"],
  ["STELLA ARTOIS", 330, "Beer"],
  ["STELLA ARTOIS", 660, "Beer"],
  ["SAVANNA ANGRY LEMON", 330, "Cider"],
  ["EXTREME APPLE", 275, "Cider"],
  ["EXTREME APPLE", 440, "Cider"],
  ["WINDHOEK DRAUGHT CAN", 440, "Beer"],
  ["WINDHOEK LAGER", 440, "Beer"],
  ["BELGRAVIA GIN AND TONIC", 275, "RTD"],
  ["BELGRAVIA GIN AND TONIC", 440, "RTD"],
  ["BELGRAVIA DRY LEMON", 275, "RTD"],
  ["BELGRAVIA GIN AND DRY LEMON", 440, "RTD"],
  ["BRUTAL FRUIT RUBY APPLE", 275, "Cider"],
  ["BRUTAL FRUIT RUBY APPLE", 500, "Cider"],
  ["BAHAMA PINA COLADA", 440, "RTD"],
  ["BAHAMA WATERMELON", 440, "RTD"],
  ["BAHAMA STRAWBERRY", 440, "RTD"],
  ["BAHAMA PEACH MARTINI", 440, "RTD"],
  ["BAHAMA BLUEBERRY", 440, "RTD"],
  ["BAHAMA MARGARITA", 440, "RTD"],
  ["CORONA EXTRA", 330, "Beer"],
  ["ICE TROPEZ", 275, "RTD"],
  ["RED SQUARE BLUE ICE", 275, "RTD"],
  ["RED SQUARE PURPLE ICE", 275, "RTD"],
  ["RED SQUARE RED ICE", 275, "RTD"],
  ["KIX ROSE SPRITZER", 330, "RTD"],
  ["POWERADE", 440, "Mixers"],
  ["RED BULL", 250, "Mixers"],
  ["SCHWEPPES TONIC WATER", 200, "Mixers"],
  ["SCHWEPPES TONIC WATER", 1000, "Mixers"],
  ["CASTLE LITE", 330, "Beer"],
  ["CASTLE LITE", 500, "Beer"],
  ["CASTLE LITE", 750, "Beer"],
  ["BLACK LABEL", 330, "Beer"],
  ["BLACK LABEL", 500, "Beer"],
  ["BLACK LABEL", 750, "Beer"],
  ["CASTLE MILK STOUT", 330, "Beer"],
  ["CASTLE MILK STOUT", 500, "Beer"],
  ["CASTLE MILK STOUT", 750, "Beer"],
  ["HEINEKEN", 330, "Beer"],
  ["HEINEKEN", 440, "Beer"],
  ["HEINEKEN", 750, "Beer"],
  ["AMSTEL LAGER", 500, "Beer"],
  ["AMSTEL LAGER", 750, "Beer"],
  ["BERNINI CLASSIC", 330, "RTD"],
  ["BERNINI CLASSIC", 440, "RTD"],
  ["SOL", 330, "Beer"],
  ["BONE HEAD", 50, "Spirits"],
  ["BUG RED", 20, "Spirits"],
  ["BUG BLUE", 20, "Spirits"],
  ["OLD BUCK", 750, "Spirits"],
  ["TANQUERAY SEVILLA", 750, "Gin"],
  ["DROSTY HOF", 750, "Wine"],
  ["AMARULA", 750, "Liqueur"],
  ["REMY MARTIN VSOP", 750, "Cognac"],
  ["ROBERTSON WINERY CHAPEL SWEET", 750, "Wine"],
  ["HENNESSY VSOP", 750, "Cognac"],
  ["HENNESSY VERY SPECIAL", 750, "Cognac"],
  ["JAGERMEISTER", 750, "Liqueur"],
  ["VEUVE CLICQUOT", 750, "Champagne"],
  ["WINDHOEK DRAUGHT BOTTLE", 500, "Beer"],
  ["WATER", 1500, "Mixers"],
  ["CASTLE LAGER", 330, "Beer"],
  ["CASTLE LAGER", 500, "Beer"],
  ["CASTLE LAGER", 750, "Beer"],
  ["CASTLE DOUBLE MALT", 750, "Beer"],
  ["FLYING FISH", 500, "Beer"],
  ["FLYING FISH", 660, "Beer"],
  ["WINDHOEK DRAUGHT", 750, "Beer"],
  ["HANSA", 750, "Beer"],
];

function titleCase(raw) {
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sizeLabel(sizeMl) {
  if (sizeMl === 1500) return "1.5L";
  return `${sizeMl}ml`;
}

function slugKey(name, sizeMl) {
  return `${name}-${sizeMl}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

const items = RAW.map(([name, sizeMl, category], index) => {
  const displayName = titleCase(name);
  const label = sizeLabel(sizeMl);
  const fullName = `${displayName} ${label}`;
  const id = `bev-${String(index + 1).padStart(3, "0")}`;
  const barcode = `6001000${String(index + 1).padStart(5, "0")}`;
  return {
    id,
    name: fullName,
    displayName,
    sizeMl,
    sizeLabel: label,
    category,
    barcode,
    basePrice: 0,
    costPrice: 0,
    slug: slugKey(displayName, sizeMl),
  };
});

const outPath = path.resolve(__dirname, "../data/beverage-stock.json");
fs.writeFileSync(outPath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
console.log(`Wrote ${items.length} products to ${outPath}`);
