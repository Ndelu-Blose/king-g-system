create table if not exists public.products (
  id text primary key,
  name text not null,
  barcode text not null,
  category text not null,
  base_price numeric not null,
  cost_price numeric not null,
  image text
);

create table if not exists public.inventory (
  product_id text primary key references public.products(id) on delete cascade,
  total_qty integer not null default 0,
  lounge_qty integer not null default 0,
  warehouse_qty integer not null default 0
);

create table if not exists public.sales (
  id text primary key,
  cashier_id text not null,
  cashier_name text not null,
  subtotal numeric not null,
  vat numeric not null default 0,
  total numeric not null,
  payment_method text not null,
  cash_received numeric,
  change_given numeric,
  status text not null default 'completed',
  created_at text not null
);

create table if not exists public.sale_items (
  id bigint generated always as identity primary key,
  sale_id text not null references public.sales(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  qty integer not null,
  unit_price numeric not null,
  line_total numeric not null
);

create table if not exists public.audit_log (
  id text primary key,
  action text not null,
  actor_id text not null,
  actor_role text,
  approver_id text,
  entity_type text,
  entity_id text,
  before_json text,
  after_json text,
  reason_code text,
  timestamp text not null
);

create table if not exists public.help_requests (
  id text primary key,
  cashier_id text not null,
  cashier_name text not null,
  message text,
  status text not null default 'pending',
  created_at text not null,
  acknowledged_at text,
  acknowledged_by text
);

create table if not exists public.users (
  id text primary key,
  name text not null,
  email text unique not null,
  role text not null,
  password_hash text
);

create table if not exists public.venue_settings (
  key text primary key,
  value text not null
);

create table if not exists public.discrepancy_cases (
  id text primary key,
  type text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  created_at text not null,
  created_by text not null,
  closed_at text,
  closed_by text,
  notes text
);

create table if not exists public.incidents (
  id text primary key,
  type text not null,
  title text not null,
  description text not null,
  location text,
  status text not null default 'open',
  reported_at text not null,
  reported_by_user_id text,
  reported_by_name text,
  owner_user_id text,
  assigned_to_user_id text,
  latest_update text,
  latest_update_at text,
  resolved_at text,
  resolved_by_user_id text,
  resolution_notes text,
  owner_acknowledged_at text,
  owner_confirmed_resolved_at text,
  follow_up_requested_at text,
  reopened_at text,
  reopened_reason text,
  owner_resolution_feedback text
);

create table if not exists public.incident_events (
  id text primary key,
  incident_id text not null references public.incidents(id) on delete cascade,
  event_type text not null,
  actor_user_id text,
  actor_role text,
  note text,
  attachment_name text,
  attachment_url text,
  created_at text not null
);

create index if not exists idx_users_email on public.users(email);
create index if not exists idx_discrepancy_status on public.discrepancy_cases(status);
create index if not exists idx_sales_created_at on public.sales(created_at);
create index if not exists idx_sales_cashier on public.sales(cashier_id);
create index if not exists idx_sale_items_sale on public.sale_items(sale_id);
create index if not exists idx_help_requests_status on public.help_requests(status);
create index if not exists idx_help_requests_created on public.help_requests(created_at);
create index if not exists idx_incidents_owner_status on public.incidents(owner_user_id, status);
create index if not exists idx_incidents_reported_at on public.incidents(reported_at);
create index if not exists idx_incidents_status on public.incidents(status);
create index if not exists idx_incident_events_incident on public.incident_events(incident_id, created_at);
create index if not exists idx_audit_entity on public.audit_log(entity_type, entity_id);
create index if not exists idx_audit_timestamp on public.audit_log(timestamp);;
