-- Stock ledger, separate from audit_log. One row per stock change.
-- audit_log records who did it; this table is what Movements and stock reports list.

create table if not exists public.stock_movements (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  type text not null check (type in ('RECEIPT', 'TRANSFER', 'ADJUSTMENT', 'COUNT', 'SALE', 'VOID')),
  product_id text not null,
  product_name text,
  qty integer not null,
  from_location text,
  to_location text,
  reference text,
  supplier text,
  reason text,
  actor_id text,
  actor_role text,
  delivery_record_id text,
  balance_before jsonb,
  balance_after jsonb,
  audit_log_id text,
  idempotency_key text
);

create index if not exists stock_movements_created_at_idx on public.stock_movements (created_at desc);
create index if not exists stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

alter table public.stock_movements enable row level security;
