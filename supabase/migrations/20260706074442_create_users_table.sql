-- App profiles (roles) linked to Supabase Auth identities.
create table if not exists public.users (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null check (role in ('cashier', 'manager', 'senior_manager', 'owner')),
  password_hash text,
  active boolean not null default true,
  auth_user_id uuid unique
);

create index if not exists users_email_idx on public.users (email);
create index if not exists users_auth_user_id_idx on public.users (auth_user_id);

alter table public.users enable row level security;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select using (auth.uid() = auth_user_id);
