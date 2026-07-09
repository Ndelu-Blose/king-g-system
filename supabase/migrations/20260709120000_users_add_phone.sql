alter table public.users add column if not exists phone text;

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);
