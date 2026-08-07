-- Native push: per-device FCM registration tokens.
create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios','android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists device_tokens_user_id_idx on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='device_tokens' and policyname='own_tokens_select') then
    create policy own_tokens_select on public.device_tokens for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='device_tokens' and policyname='own_tokens_insert') then
    create policy own_tokens_insert on public.device_tokens for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='device_tokens' and policyname='own_tokens_update') then
    create policy own_tokens_update on public.device_tokens for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='device_tokens' and policyname='own_tokens_delete') then
    create policy own_tokens_delete on public.device_tokens for delete using (auth.uid() = user_id);
  end if;
end $$;
