-- E-maily F0 (18. 10. 2026): šablony se schvalováním po verzích, log odeslání,
-- suppressions (bounce/complaint/manual), opt-out obchodních sdělení z registrace,
-- odhlášení e-mailů a view oslovitelných uživatelů.
--
-- Spec: Vaults/pumplo/strategie/2026-10-18 E-mailová strategie Pumplo
--       + 2026-10-01-retargeting-automatizace-skolni-zadani (Pravidla systému, Právní základ, M2).
--
-- Idempotentní: dá se pustit opakovaně. NIC neschvaluje — seed šablon je jen 'draft',
-- dokud David verzi neschválí, lifecycle-emails nic nepošle.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Sloupce v profilu
-- ─────────────────────────────────────────────────────────────────────────────
-- marketing_optout_at  = člověk při registraci (nebo později) odmítl obchodní sdělení
--                        (§ 7 odst. 3 zák. 480/2004 Sb.). Servisní e-maily (M2-A) dál chodí.
-- email_unsubscribed_at = odhlášení ze VŠECH neautomatických e-mailů z Pumpla
--                        (odkaz v patičce, one-click, přepínač „E-maily s tipy“ v Nastavení).
--                        Netýká se přihlášení / resetu hesla (Supabase Auth).
alter table public.user_profiles add column if not exists marketing_optout_at timestamptz;
alter table public.user_profiles add column if not exists email_unsubscribed_at timestamptz;
-- Zápis vlastního řádku už kryje stávající policy „Users manage own profile“
-- (auth.uid() = user_id), nová policy pro sloupce není potřeba.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Šablony (schvaluje se verze, ne jednotlivý e-mail)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,                      -- např. 'M2A'
  version integer not null check (version >= 1),
  locale text not null check (locale in ('cs', 'en')),
  subject text not null,
  preheader text,
  html text not null,                     -- tělo bez patičky; patičku (firma, proč, odhlášení) přidává funkce
  text text not null,                     -- plain-text verze téhož
  kind text not null check (kind in ('service', 'marketing')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'paused')),
  approved_by text,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_templates_key_version_locale_key unique (key, version, locale),
  constraint email_templates_approval_complete
    check (status <> 'approved' or (approved_by is not null and approved_at is not null))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Log odeslání + deduplikace (user, šablona, epizoda)
-- ─────────────────────────────────────────────────────────────────────────────
-- episode_key: M2A = 'life' (jednou za život účtu). Dry-run zapisuje 'dry_run:life',
-- aby zkušební běhy po přepnutí naostro nikomu e-mail nezablokovaly.
create table if not exists public.email_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_key text not null,
  template_version integer not null,
  locale text,
  episode_key text not null,
  status text not null check (status in ('sent', 'dry_run', 'failed', 'skipped')),
  resend_id text,
  error text,
  created_at timestamptz not null default now(),
  constraint email_sends_user_template_episode_key unique (user_id, template_key, episode_key)
);
create index if not exists email_sends_template_created_idx on public.email_sends (template_key, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Suppressions (bounce, stížnost, ruční blok) — podle adresy, ne účtu
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reason text not null check (reason in ('bounce', 'complaint', 'manual')),
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists email_suppressions_email_lower_key on public.email_suppressions (lower(email));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS: číst smí jen admin, klient nezapisuje nic (zapisuje edge funkce service rolí)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.email_templates enable row level security;
alter table public.email_sends enable row level security;
alter table public.email_suppressions enable row level security;

revoke insert, update, delete, truncate on public.email_templates from anon, authenticated;
revoke insert, update, delete, truncate on public.email_sends from anon, authenticated;
revoke insert, update, delete, truncate on public.email_suppressions from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'email_templates' and policyname = 'Admins read email_templates') then
    create policy "Admins read email_templates" on public.email_templates
      for select to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'email_sends' and policyname = 'Admins read email_sends') then
    create policy "Admins read email_sends" on public.email_sends
      for select to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'email_suppressions' and policyname = 'Admins read email_suppressions') then
    create policy "Admins read email_suppressions" on public.email_suppressions
      for select to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. View oslovitelných uživatelů (sql/_real.sql z analýzy 1. 10., ověřeno 18. 10.)
-- ─────────────────────────────────────────────────────────────────────────────
-- Vyřazuje: demo účty (raw_user_meta_data ? 'demo'), @demo.pumplo.cz, @pumplo.*,
-- is_staff, user_profiles.role ≠ 'user' (super_admin), user_roles.role ≠ 'user'
-- (admin, business, trainer), demo posilovnu deadbeef-…0001, účty bez profilu
-- (inner join), smazané/zabanované účty, odhlášené (email_unsubscribed_at)
-- a adresy v email_suppressions.
-- marketing_optout_at se NEfiltruje — servisní e-maily (M2-A) chodí i jim;
-- obchodní šablony (F1) ho musí filtrovat samy.
-- Čte auth.users → běží s právy vlastníka view a je zamčené jen pro service_role.
create or replace view public.email_eligible_users as
select
  u.id as user_id,
  u.email,
  u.created_at as signed_up_at,
  coalesce(u.raw_app_meta_data ->> 'provider', 'email') as auth_provider,
  p.first_name,
  coalesce(p.language, 'cs') as language,
  coalesce(p.onboarding_completed, false) as onboarding_completed,
  coalesce(p.current_step, 0) as current_step,
  p.selected_gym_id,
  p.marketing_optout_at
from auth.users u
join public.user_profiles p on p.user_id = u.id
where u.email is not null
  and u.email <> ''
  and u.deleted_at is null
  and (u.banned_until is null or u.banned_until < now())
  and not (coalesce(u.raw_user_meta_data, '{}'::jsonb) ? 'demo')
  and u.email not ilike '%@demo.pumplo.cz'
  and u.email not ilike '%@pumplo.%'
  and coalesce(p.is_staff, false) = false
  and coalesce(p.role, 'user') = 'user'
  and p.selected_gym_id is distinct from 'deadbeef-0000-4000-8000-000000000001'::uuid
  and not exists (
    select 1 from public.user_roles r
    where r.user_id = u.id and r.role <> 'user'::public.app_role
  )
  and p.email_unsubscribed_at is null
  and not exists (
    select 1 from public.email_suppressions s
    where lower(s.email) = lower(u.email)
  );

revoke all on public.email_eligible_users from public, anon, authenticated;
grant select on public.email_eligible_users to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Seed: M2-A v1 (servisní) — JEN DRAFT, čeká na schválení Davida
-- ─────────────────────────────────────────────────────────────────────────────
-- Zástupné symboly: {{greeting}} (Ahoj Jano, / Ahoj,), {{step_line}} (věta podle
-- rozpracovanosti dotazníku), {{cta_url}}. Patičku přidává funkce.
-- ON CONFLICT DO NOTHING: opakované spuštění nikdy nepřepíše schválenou verzi.
insert into public.email_templates (key, version, locale, subject, preheader, html, text, kind, status, notes)
values
(
  'M2A', 1, 'cs',
  'Dokonči si plán v Pumplu',
  'Účet máš, plán se sestaví po posledních otázkách.',
  '<p style="margin:0 0 16px;line-height:1.5">{{greeting}}</p>'
  || '<p style="margin:0 0 16px;line-height:1.5">účet v Pumplu máš, ale tréninkový plán ještě ne. Chybí odpovědi z krátkého dotazníku.</p>'
  || '<p style="margin:0 0 16px;line-height:1.5">{{step_line}} Po poslední odpovědi uvidíš svůj plán.</p>'
  || '<p style="margin:0 0 24px"><a href="{{cta_url}}" style="display:inline-block;background:#0B1222;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Dokončit dotazník</a></p>',
  E'{{greeting}}\n\núčet v Pumplu máš, ale tréninkový plán ještě ne. Chybí odpovědi z krátkého dotazníku.\n\n{{step_line}} Po poslední odpovědi uvidíš svůj plán.\n\nDokončit dotazník: {{cta_url}}',
  'service', 'draft',
  'Návrh 18. 10. 2026 (agent F0) podle M2 z návrhu 1. 10. — ČEKÁ NA SCHVÁLENÍ DAVIDA'
),
(
  'M2A', 1, 'en',
  'Finish your plan in Pumplo',
  'Your account is ready, your plan is a few answers away.',
  '<p style="margin:0 0 16px;line-height:1.5">{{greeting}}</p>'
  || '<p style="margin:0 0 16px;line-height:1.5">you have a Pumplo account, but no training plan yet. A few answers from the short questionnaire are missing.</p>'
  || '<p style="margin:0 0 16px;line-height:1.5">{{step_line}} Your plan appears right after the last answer.</p>'
  || '<p style="margin:0 0 24px"><a href="{{cta_url}}" style="display:inline-block;background:#0B1222;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Finish the questionnaire</a></p>',
  E'{{greeting}}\n\nyou have a Pumplo account, but no training plan yet. A few answers from the short questionnaire are missing.\n\n{{step_line}} Your plan appears right after the last answer.\n\nFinish the questionnaire: {{cta_url}}',
  'service', 'draft',
  'Draft 18 Oct 2026 (agent F0) based on M2 from the 1 Oct design — AWAITING DAVID''S APPROVAL'
)
on conflict (key, version, locale) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Cron (NESPOUŠTĚT s migrací — zapne David po nasazení funkcí a secretů)
-- ─────────────────────────────────────────────────────────────────────────────
-- Hodinově v :30 (nezávodí s push cronem v :00). <CRON_SECRET> = stejný Bearer
-- jako u ostatních jobů (viz select command from cron.job where jobname = 'pumplo-reminders-hourly').
--
-- select cron.schedule(
--   'lifecycle-emails-hourly',
--   '30 * * * *',
--   $cron$ select net.http_post(
--     url := 'https://udqwjqgdsjobdufdxbpn.supabase.co/functions/v1/lifecycle-emails',
--     headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--     body := '{}'::jsonb,
--     timeout_milliseconds := 60000) $cron$
-- );
--
-- Vypnutí:  select cron.unschedule('lifecycle-emails-hourly');
--
-- Schválení verze (David, po kontrole textu):
-- update public.email_templates set status = 'approved', approved_by = 'David Novotný', approved_at = now(), updated_at = now()
--  where key = 'M2A' and version = 1;
