create table if not exists delivery_intakes (
  id uuid primary key default gen_random_uuid(),
  intake_number text unique,
  supplier text not null,
  invoice_number text not null,
  delivery_reference text not null,
  delivery_date date not null,
  branch_site text,
  receive_into_location text,
  received_by text,
  notes text,
  status text not null default 'draft',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists delivery_intake_lines (
  id text primary key,
  intake_id uuid not null references delivery_intakes(id) on delete cascade,
  product_id text not null,
  expected_qty integer not null default 0,
  actual_qty integer not null default 0,
  accepted_qty integer not null default 0,
  rejected_qty integer not null default 0,
  held_qty integer not null default 0,
  unit_of_measure text default 'unit',
  unit_cost_optional numeric,
  batch_number text,
  expiry_date date,
  discrepancy_reason text,
  decision text default 'accept',
  verification_notes text,
  destination_location text
);

create table if not exists blind_transfer_copies (
  id uuid primary key default gen_random_uuid(),
  blind_copy_number text unique not null,
  intake_id uuid not null references delivery_intakes(id) on delete cascade,
  from_location text not null,
  to_location text not null,
  created_by_user_id text,
  issued_by_user_id text,
  received_by_user_id text,
  issued_at timestamptz,
  received_at timestamptz,
  status text not null default 'generated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists blind_transfer_copy_lines (
  id uuid primary key default gen_random_uuid(),
  blind_copy_id uuid not null references blind_transfer_copies(id) on delete cascade,
  product_id text not null,
  qty integer not null,
  unit_of_measure text default 'unit',
  batch_number text,
  expiry_date date,
  destination_bin text
);

create index if not exists idx_delivery_intake_lines_intake_id on delivery_intake_lines(intake_id);
create index if not exists idx_blind_transfer_copy_lines_copy_id on blind_transfer_copy_lines(blind_copy_id);;
