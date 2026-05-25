-- Link app profiles (roles) to Supabase Auth identities.
-- Passwords live in Auth; public.users holds name, role, active.

alter table public.users
  add column if not exists auth_user_id uuid unique;

comment on column public.users.auth_user_id is
  'Supabase Auth user id (auth.users). When set, login uses Auth; password_hash is optional legacy fallback.';

create index if not exists users_auth_user_id_idx on public.users (auth_user_id);
