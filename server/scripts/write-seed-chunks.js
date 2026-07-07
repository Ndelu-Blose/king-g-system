import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../data/beverage-stock.json"), "utf8")
);

function sqlStr(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

for (let i = 0; i < catalog.length; i += 20) {
  const slice = catalog.slice(i, i + 20);
  const values = slice
    .map(
      (p) =>
        `(${sqlStr(p.id)}, ${sqlStr(p.name)}, ${sqlStr(p.barcode)}, ${sqlStr(p.category)}, 0, 0, ${p.sizeMl}, null)`
    )
    .join(",\n  ");
  const inv = slice.map((p) => `(${sqlStr(p.id)}, 0, 0, 0)`).join(",\n  ");
  const sql = `insert into public.products (id, name, barcode, category, base_price, cost_price, size_ml, image) values
  ${values}
on conflict (id) do update set name = excluded.name, barcode = excluded.barcode, category = excluded.category, size_ml = excluded.size_ml;

insert into public.inventory (product_id, total_qty, lounge_qty, warehouse_qty) values
  ${inv}
on conflict (product_id) do nothing;`;
  fs.writeFileSync(path.resolve(__dirname, `../data/seed-chunk-${i / 20 + 1}.sql`), sql);
  console.log(`chunk ${i / 20 + 1}: ${slice.length} products`);
}
