-- Enable RLS on all application tables
alter table if exists public.products enable row level security;
alter table if exists public.inventory enable row level security;
alter table if exists public.sales enable row level security;
alter table if exists public.sale_items enable row level security;
alter table if exists public.audit_log enable row level security;
alter table if exists public.help_requests enable row level security;
alter table if exists public.users enable row level security;
alter table if exists public.venue_settings enable row level security;
alter table if exists public.discrepancy_cases enable row level security;
alter table if exists public.incidents enable row level security;
alter table if exists public.incident_events enable row level security;
alter table if exists public.delivery_intakes enable row level security;
alter table if exists public.delivery_intake_lines enable row level security;
alter table if exists public.blind_transfer_copies enable row level security;
alter table if exists public.blind_transfer_copy_lines enable row level security;

-- Drop previous policies if re-running migration
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'products','inventory','sales','sale_items','audit_log','help_requests','users','venue_settings',
      'discrepancy_cases','incidents','incident_events','delivery_intakes','delivery_intake_lines',
      'blind_transfer_copies','blind_transfer_copy_lines'
    ])
  LOOP
    EXECUTE format('drop policy if exists %I on public.%I', t || '_select_all', t);
    EXECUTE format('drop policy if exists %I on public.%I', t || '_insert_all', t);
    EXECUTE format('drop policy if exists %I on public.%I', t || '_update_all', t);
    EXECUTE format('drop policy if exists %I on public.%I', t || '_delete_all', t);
  END LOOP;
END $$;

-- Dev-friendly policies for anon + authenticated while app is being migrated
create policy products_select_all on public.products for select to anon, authenticated using (true);
create policy products_insert_all on public.products for insert to anon, authenticated with check (true);
create policy products_update_all on public.products for update to anon, authenticated using (true) with check (true);
create policy products_delete_all on public.products for delete to anon, authenticated using (true);

create policy inventory_select_all on public.inventory for select to anon, authenticated using (true);
create policy inventory_insert_all on public.inventory for insert to anon, authenticated with check (true);
create policy inventory_update_all on public.inventory for update to anon, authenticated using (true) with check (true);
create policy inventory_delete_all on public.inventory for delete to anon, authenticated using (true);

create policy sales_select_all on public.sales for select to anon, authenticated using (true);
create policy sales_insert_all on public.sales for insert to anon, authenticated with check (true);
create policy sales_update_all on public.sales for update to anon, authenticated using (true) with check (true);
create policy sales_delete_all on public.sales for delete to anon, authenticated using (true);

create policy sale_items_select_all on public.sale_items for select to anon, authenticated using (true);
create policy sale_items_insert_all on public.sale_items for insert to anon, authenticated with check (true);
create policy sale_items_update_all on public.sale_items for update to anon, authenticated using (true) with check (true);
create policy sale_items_delete_all on public.sale_items for delete to anon, authenticated using (true);

create policy audit_log_select_all on public.audit_log for select to anon, authenticated using (true);
create policy audit_log_insert_all on public.audit_log for insert to anon, authenticated with check (true);
create policy audit_log_update_all on public.audit_log for update to anon, authenticated using (true) with check (true);
create policy audit_log_delete_all on public.audit_log for delete to anon, authenticated using (true);

create policy help_requests_select_all on public.help_requests for select to anon, authenticated using (true);
create policy help_requests_insert_all on public.help_requests for insert to anon, authenticated with check (true);
create policy help_requests_update_all on public.help_requests for update to anon, authenticated using (true) with check (true);
create policy help_requests_delete_all on public.help_requests for delete to anon, authenticated using (true);

create policy users_select_all on public.users for select to anon, authenticated using (true);
create policy users_insert_all on public.users for insert to anon, authenticated with check (true);
create policy users_update_all on public.users for update to anon, authenticated using (true) with check (true);
create policy users_delete_all on public.users for delete to anon, authenticated using (true);

create policy venue_settings_select_all on public.venue_settings for select to anon, authenticated using (true);
create policy venue_settings_insert_all on public.venue_settings for insert to anon, authenticated with check (true);
create policy venue_settings_update_all on public.venue_settings for update to anon, authenticated using (true) with check (true);
create policy venue_settings_delete_all on public.venue_settings for delete to anon, authenticated using (true);

create policy discrepancy_cases_select_all on public.discrepancy_cases for select to anon, authenticated using (true);
create policy discrepancy_cases_insert_all on public.discrepancy_cases for insert to anon, authenticated with check (true);
create policy discrepancy_cases_update_all on public.discrepancy_cases for update to anon, authenticated using (true) with check (true);
create policy discrepancy_cases_delete_all on public.discrepancy_cases for delete to anon, authenticated using (true);

create policy incidents_select_all on public.incidents for select to anon, authenticated using (true);
create policy incidents_insert_all on public.incidents for insert to anon, authenticated with check (true);
create policy incidents_update_all on public.incidents for update to anon, authenticated using (true) with check (true);
create policy incidents_delete_all on public.incidents for delete to anon, authenticated using (true);

create policy incident_events_select_all on public.incident_events for select to anon, authenticated using (true);
create policy incident_events_insert_all on public.incident_events for insert to anon, authenticated with check (true);
create policy incident_events_update_all on public.incident_events for update to anon, authenticated using (true) with check (true);
create policy incident_events_delete_all on public.incident_events for delete to anon, authenticated using (true);

create policy delivery_intakes_select_all on public.delivery_intakes for select to anon, authenticated using (true);
create policy delivery_intakes_insert_all on public.delivery_intakes for insert to anon, authenticated with check (true);
create policy delivery_intakes_update_all on public.delivery_intakes for update to anon, authenticated using (true) with check (true);
create policy delivery_intakes_delete_all on public.delivery_intakes for delete to anon, authenticated using (true);

create policy delivery_intake_lines_select_all on public.delivery_intake_lines for select to anon, authenticated using (true);
create policy delivery_intake_lines_insert_all on public.delivery_intake_lines for insert to anon, authenticated with check (true);
create policy delivery_intake_lines_update_all on public.delivery_intake_lines for update to anon, authenticated using (true) with check (true);
create policy delivery_intake_lines_delete_all on public.delivery_intake_lines for delete to anon, authenticated using (true);

create policy blind_transfer_copies_select_all on public.blind_transfer_copies for select to anon, authenticated using (true);
create policy blind_transfer_copies_insert_all on public.blind_transfer_copies for insert to anon, authenticated with check (true);
create policy blind_transfer_copies_update_all on public.blind_transfer_copies for update to anon, authenticated using (true) with check (true);
create policy blind_transfer_copies_delete_all on public.blind_transfer_copies for delete to anon, authenticated using (true);

create policy blind_transfer_copy_lines_select_all on public.blind_transfer_copy_lines for select to anon, authenticated using (true);
create policy blind_transfer_copy_lines_insert_all on public.blind_transfer_copy_lines for insert to anon, authenticated with check (true);
create policy blind_transfer_copy_lines_update_all on public.blind_transfer_copy_lines for update to anon, authenticated using (true) with check (true);
create policy blind_transfer_copy_lines_delete_all on public.blind_transfer_copy_lines for delete to anon, authenticated using (true);;
