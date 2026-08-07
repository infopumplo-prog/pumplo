-- ============================================================
-- CRM READ-ONLY BRIDGE
-- Spustit v PRODUKCI (projekt Pumplo-App) přes Dashboard → SQL Editor.
-- Vystavuje POUZE prodejní adresář gymů pro Jáchymův CRM.
-- Žádná data členů, žádné PII navíc, jen read-only.
-- ============================================================

-- 1) View: prodejní adresář gymů (běží jako vlastník = vidí napříč RLS,
--    proto může číst i owner_email z auth.users)
create or replace view public.crm_gym_directory as
select
  g.id                    as gym_id,
  g.name                  as gym_name,
  g.address,
  g.is_published,
  g.created_at            as gym_created_at,
  u.email                 as owner_email,
  s.plan_id,
  s.status                as subscription_status,
  s.billing_period,
  s.current_period_end,
  s.stripe_customer_id
from public.gyms g
left join auth.users u                on u.id = g.owner_id
left join public.gym_subscriptions s  on s.gym_id = g.id;

-- 2) Dedikovaná read-only login role JEN pro CRM
--    >>> NAHRAĎ heslo silným náhodným heslem (a pošli ho Jáchymovi bezpečně) <<<
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'crm_reader') then
    create role crm_reader login password 'REPLACE_WITH_STRONG_PASSWORD';
  end if;
end $$;

-- 3) Práva: striktně jen SELECT na ten jeden view, nic víc
grant usage  on schema public          to crm_reader;
grant select on public.crm_gym_directory to crm_reader;

-- crm_reader nemá default přístup k žádné jiné tabulce (Supabase granty
-- jdou na anon/authenticated, ne na tuto roli) → least privilege OK.

-- ============================================================
-- Connection string pro Jáchyma (přes pooler, jen čtení adresáře):
--   postgresql://crm_reader.<PROJECT_REF>:<HESLO>@<REGION>.pooler.supabase.com:5432/postgres
-- PROJECT_REF = udqwjqgdsjobdufdxbpn (Pumplo-App)
-- Ověř host/region v Dashboard → Project Settings → Database → Connection string
-- ============================================================
