-- Allow the frontend (anon key) to read product catalog and stock levels.
drop policy if exists "products_select_all" on public.products;
drop policy if exists "inventory_select_all" on public.inventory;
create policy "products_select_all" on public.products for select using (true);
create policy "inventory_select_all" on public.inventory for select using (true);
