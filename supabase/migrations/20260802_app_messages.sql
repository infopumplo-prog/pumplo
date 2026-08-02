-- Systémové zprávy od Pumpla (novinky po vydání + uvítání nového uživatele).
--
-- Proč vlastní tabulka a ne gym_messages: tam je gym_id povinné a klient je
-- načítá jen pro vybranou posilovnu, takže nový uživatel bez posilovny by
-- zprávu nikdy neviděl.

create table if not exists public.app_messages (
  id uuid primary key default gen_random_uuid(),
  -- 'release' = co jsme opravili/přidali, 'welcome' = uvítání nového uživatele
  kind text not null check (kind in ('release', 'welcome')),
  title text not null,
  body text not null,
  -- Anglická varianta je nepovinná; když chybí, klient zobrazí českou.
  title_en text,
  body_en text,
  -- Informativní údaj do hlavičky zprávy, např. '1.2.4'.
  app_version text,
  -- Vypnutím zprávu schováme, aniž bychom přišli o potvrzení o přečtení.
  is_active boolean not null default true,
  -- Uvítací zprávu vidí jen účty založené po tomto datu.
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists app_messages_active_idx
  on public.app_messages (is_active, published_at desc);

create table if not exists public.app_message_reads (
  message_id uuid not null references public.app_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists app_message_reads_user_idx
  on public.app_message_reads (user_id);

alter table public.app_messages enable row level security;
alter table public.app_message_reads enable row level security;

-- Zprávy čte kdokoliv přihlášený; psát je smí jen servisní role (odesíláme je
-- my, uživatel ani majitel posilovny do nich nezasahuje).
do $$
begin
  if not exists (
    select 1 from pg_policy p join pg_class c on c.oid = p.polrelid
    where c.relname = 'app_messages' and p.polname = 'Authenticated can read active app messages'
  ) then
    create policy "Authenticated can read active app messages"
      on public.app_messages for select
      to authenticated
      using (is_active = true);
  end if;

  if not exists (
    select 1 from pg_policy p join pg_class c on c.oid = p.polrelid
    where c.relname = 'app_message_reads' and p.polname = 'Users read own receipts'
  ) then
    create policy "Users read own receipts"
      on public.app_message_reads for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policy p join pg_class c on c.oid = p.polrelid
    where c.relname = 'app_message_reads' and p.polname = 'Users insert own receipts'
  ) then
    create policy "Users insert own receipts"
      on public.app_message_reads for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Novinka po vydání jde všem — stejný pg_net most jako u zpráv z posilovny.
-- Uvítací zpráva se tímhle NEROZESÍLÁ: ta je trvale aktivní a push k ní
-- posílá trigger níž, až když si nový uživatel zaregistruje zařízení.
drop trigger if exists trg_app_messages_push on public.app_messages;
create trigger trg_app_messages_push
  after insert on public.app_messages
  for each row
  when (new.kind = 'release' and new.is_active = true)
  execute function public.notify_message_push();

-- Uvítací push. Nový účet nemá při registraci ještě povolené notifikace, takže
-- token dorazí až později — teprve tehdy má smysl push poslat. Pojistka na stáří
-- účtu brání tomu, aby uvítání dostal starý uživatel, který si přeinstaloval appku.
create or replace function public.notify_welcome_push()
returns trigger
language plpgsql
security definer
set search_path = public, auth, vault, net, extensions
as $$
declare
  v_secret text;
  v_created timestamptz;
  v_existing int;
begin
  -- Jen první zařízení daného uživatele.
  select count(*) into v_existing
  from public.device_tokens
  where user_id = new.user_id and id <> new.id;
  if v_existing > 0 then
    return new;
  end if;

  select created_at into v_created from auth.users where id = new.user_id;
  if v_created is null or v_created < now() - interval '7 days' then
    return new;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'message_push_bearer'
  limit 1;

  if v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://udqwjqgdsjobdufdxbpn.supabase.co/functions/v1/send-message-push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('table', 'app_welcome', 'row_id', new.user_id)
  );

  return new;
exception
  when others then
    -- Push nikdy nesmí shodit registraci zařízení.
    raise log 'notify_welcome_push failed for %: %', new.user_id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists trg_device_tokens_welcome_push on public.device_tokens;
create trigger trg_device_tokens_welcome_push
  after insert on public.device_tokens
  for each row execute function public.notify_welcome_push();
