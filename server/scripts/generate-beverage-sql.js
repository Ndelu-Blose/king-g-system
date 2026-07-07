/**
 * Emit SQL migration for beverage catalog (run via Supabase SQL editor or db push).
 * Usage: node server/scripts/generate-beverage-sql.js
 */
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

const productValues = catalog
  .map(
    (p) =>
      `(${sqlStr(p.id)}, ${sqlStr(p.name)}, ${sqlStr(p.barcode)}, ${sqlStr(p.category)}, ${p.basePrice ?? 0}, ${p.costPrice ?? 0}, ${p.sizeMl}, null)`
  )
  .join(",\n  ");

const inventoryValues = catalog
  .map((p) => `(${sqlStr(p.id)}, 0, 0, 0)`)
  .join(",\n  ");

const sql = `-- Beverage catalog: names, sizes (ml), categories. Prices default to 0 until updated in Products.
create table if not exists public.products (
  id text primary key,
  name text not null,
  barcode text not null unique,
  category text not null,
  base_price numeric not null default 0,
  cost_price numeric not null default 0,
  size_ml integer,
  image text
);

create table if not exists public.inventory (
  product_id text primary key references public.products(id) on delete cascade,
  total_qty integer not null default 0,
  lounge_qty integer not null default 0,
  warehouse_qty integer not null default 0
);

alter table public.products
  add column if not exists size_ml integer;

comment on column public.products.size_ml is 'Pack size in millilitres (1500 = 1.5L water).';

insert into public.products (id, name, barcode, category, base_price, cost_price, size_ml, image)
values
  ${productValues}
on conflict (id) do update set
  name = excluded.name,
  barcode = excluded.barcode,
  category = excluded.category,
  size_ml = excluded.size_ml;

insert into public.inventory (product_id, total_qty, lounge_qty, warehouse_qty)
values
  ${inventoryValues}
on conflict (product_id) do nothing;
`;

const outPath = path.resolve(__dirname, "../../supabase/migrations/20260706120000_beverage_catalog.sql");
fs.writeFileSync(outPath, sql, "utf8");
console.log(`Wrote migration to ${outPath}`);
