-- Enable Supabase Realtime for product catalog sync across POS terminals.
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.inventory;
