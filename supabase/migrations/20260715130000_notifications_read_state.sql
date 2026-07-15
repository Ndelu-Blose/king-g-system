-- Extend help_requests with read-state fields used by the unified notifications API.
alter table if exists public.help_requests
  add column if not exists is_read boolean not null default false;

alter table if exists public.help_requests
  add column if not exists read_at text;

-- Persist read state (and first-seen timestamps) for derived alerts
-- (low stock, variance, unusual activity).
create table if not exists public.notification_reads (
  notification_id text primary key,
  is_read boolean not null default false,
  read_at text,
  first_seen_at text not null,
  updated_at text not null
);

create index if not exists idx_notification_reads_is_read
  on public.notification_reads (is_read);

create index if not exists idx_help_requests_is_read
  on public.help_requests (is_read);

alter table if exists public.notification_reads enable row level security;

drop policy if exists notification_reads_select_all on public.notification_reads;
drop policy if exists notification_reads_insert_all on public.notification_reads;
drop policy if exists notification_reads_update_all on public.notification_reads;
drop policy if exists notification_reads_delete_all on public.notification_reads;

create policy notification_reads_select_all on public.notification_reads
  for select to anon, authenticated using (true);
create policy notification_reads_insert_all on public.notification_reads
  for insert to anon, authenticated with check (true);
create policy notification_reads_update_all on public.notification_reads
  for update to anon, authenticated using (true) with check (true);
create policy notification_reads_delete_all on public.notification_reads
  for delete to anon, authenticated using (true);
