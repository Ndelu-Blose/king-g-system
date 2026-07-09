-- Sales idempotency for duplicate payment prevention
alter table public.sales add column if not exists idempotency_key text;
create unique index if not exists sales_idempotency_key_unique
  on public.sales (idempotency_key)
  where idempotency_key is not null;

-- Welcome email cooldown tracking
alter table public.users add column if not exists last_welcome_email_at text;

-- Delivery records with document storage paths (Deliveries page)
create table if not exists public.delivery_records (
  id text primary key,
  po_ref text not null,
  supplier text not null,
  invoice_ref text,
  status text not null default 'pending',
  invoice_storage_path text,
  pod_storage_path text,
  invoice_file_name text,
  pod_file_name text,
  uploaded_by text,
  created_at timestamptz not null default now()
);

-- Private storage buckets for delivery and incident documents
insert into storage.buckets (id, name, public)
values ('delivery-documents', 'delivery-documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('incident-attachments', 'incident-attachments', false)
on conflict (id) do nothing;

-- Authenticated users can upload/read delivery documents under their user id prefix
create policy "delivery_docs_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'delivery-documents');

create policy "delivery_docs_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'delivery-documents');

create policy "incident_attachments_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'incident-attachments');

create policy "incident_attachments_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'incident-attachments');
