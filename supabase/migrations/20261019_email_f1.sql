-- E-maily F1 (19. 10. 2026): retargetingová architektura M3–M8 nad F0.
--
-- Spec: Vaults/pumplo/strategie/2026-10-01-retargeting-automatizace-skolni-zadani.md
--       (Pravidla systému, Frekvence, Právní základ, M3–M8)
--     + 2026-10-18 E-mailová strategie Pumplo — řídí Petr na iMacu.md
--
-- Idempotentní: dá se pustit opakovaně. NIC neschvaluje — nové šablony jsou jen 'draft',
-- lifecycle-emails posílá výhradně SCHVÁLENÉ verze. M2A (F0) zůstává beze změny.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Sloupce v profilu (právní brána obchodních sdělení)
-- ─────────────────────────────────────────────────────────────────────────────
-- marketing_consent_at   = výslovný souhlas s tipy e-mailem (in-app žádost „Ano“,
--                          nebo zapnutí „E-maily s tipy“ v Nastavení).
-- email_optout_offered_at = při sběru e-mailu (registrace) byla nabídnuta volba odmítnutí
--                          (§ 7 odst. 3 zák. 480/2004 Sb.). Zapisuje JEN klient, který
--                          zaškrtávátko „Nechci dostávat tipy…“ opravdu ukázal. Starší buildy
--                          z obchodů ho nemají → NULL → žádné obchodní e-maily bez souhlasu.
alter table public.user_profiles add column if not exists marketing_consent_at timestamptz;
alter table public.user_profiles add column if not exists email_optout_offered_at timestamptz;
-- Zápis vlastního řádku kryje stávající policy „Users manage own profile“.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. contact_log — každý kontakt napříč kanály (strop 1 kontakt / pražský den)
-- ─────────────────────────────────────────────────────────────────────────────
-- Píšou: lifecycle-emails (channel 'email', type = klíč šablony) a send-push-notifications
-- (channel 'push', type = morning/missed/first_workout/closing/comeback). Bez backfillu:
-- do té doby brána čte i notification_logs.date_key.
create table if not exists public.contact_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('push', 'email', 'in_app')),
  type text not null,
  sent_at timestamptz not null default now()
);
create index if not exists contact_log_user_sent_idx on public.contact_log (user_id, sent_at desc);
create index if not exists contact_log_sent_idx on public.contact_log (sent_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. email_events — webhook Resend (doručení, otevření, kliky, bounce, stížnost)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  svix_id text,                           -- idempotence: Resend/Svix doručuje at-least-once
  resend_id text,                         -- = email_sends.resend_id
  type text not null check (type in ('delivered', 'opened', 'clicked', 'bounced', 'complained')),
  email text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists email_events_svix_id_key on public.email_events (svix_id);
create index if not exists email_events_resend_type_idx on public.email_events (resend_id, type);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. email_eligible_daily — kolik lidí šablona ten den oslovila (před stropy)
-- ─────────────────────────────────────────────────────────────────────────────
-- lifecycle-emails zapisuje maximum kandidátů z běhů daného pražského dne.
create table if not exists public.email_eligible_daily (
  day date not null,
  template_key text not null,
  eligible integer not null default 0 check (eligible >= 0),
  updated_at timestamptz not null default now(),
  primary key (day, template_key)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS: číst smí jen admin, klient nezapisuje nic (zapisují edge funkce service rolí)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.contact_log enable row level security;
alter table public.email_events enable row level security;
alter table public.email_eligible_daily enable row level security;

revoke insert, update, delete, truncate on public.contact_log from anon, authenticated;
revoke insert, update, delete, truncate on public.email_events from anon, authenticated;
revoke insert, update, delete, truncate on public.email_eligible_daily from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contact_log' and policyname = 'Admins read contact_log') then
    create policy "Admins read contact_log" on public.contact_log
      for select to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'email_events' and policyname = 'Admins read email_events') then
    create policy "Admins read email_events" on public.email_events
      for select to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'email_eligible_daily' and policyname = 'Admins read email_eligible_daily') then
    create policy "Admins read email_eligible_daily" on public.email_eligible_daily
      for select to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. View email_lifecycle_facts — vše, co pravidla M3–M8 potřebují, na jeden dotaz
-- ─────────────────────────────────────────────────────────────────────────────
-- Staví na email_eligible_users (F0: bez demo/staff/rolí/odhlášených/suppressions).
-- Tréninky: jen dokončené, bez Hevy importu (day_letter 'H') a demo posilovny.
-- workout_dates = pražská data (YYYY-MM-DD) všech dokončených tréninků vzestupně —
-- okna a počty (n14, n14prev, dny od posledního) počítají čistá pravidla v rules.ts.
-- ZÁMĚRNĚ bez injuries / weight_kg / height_cm / age (nikdy nepersonalizovat podle nich).
-- marketing_ok = stejná právní brána jako legalGate() v rules.ts (pro report a Petra).
create or replace view public.email_lifecycle_facts as
select
  e.user_id,
  e.email,
  e.signed_up_at,
  e.auth_provider,
  e.first_name,
  e.language,
  e.onboarding_completed,
  e.current_step,
  e.selected_gym_id,
  e.marketing_optout_at,
  p.marketing_consent_at,
  p.email_optout_offered_at,
  p.email_unsubscribed_at,
  coalesce(p.notification_comeback, true) as notification_comeback,
  p.training_days,
  p.current_day_index,
  g.name as selected_gym_name,
  coalesce(ws.completed_workouts, 0) as completed_workouts,
  ws.first_completed_at,
  ws.last_completed_at,
  coalesce(ws.workout_dates, '{}'::text[]) as workout_dates,
  pl.first_gym_plan_at,
  ap.plan_training_days,
  exists (select 1 from public.device_tokens d where d.user_id = e.user_id) as has_device_token,
  (
    p.email_unsubscribed_at is null
    and (
      (p.marketing_consent_at is not null
        and (e.marketing_optout_at is null or e.marketing_optout_at < p.marketing_consent_at))
      or (p.email_optout_offered_at is not null and e.marketing_optout_at is null)
    )
  ) as marketing_ok
from public.email_eligible_users e
join public.user_profiles p on p.user_id = e.user_id
left join public.gyms g on g.id = e.selected_gym_id
left join lateral (
  select
    count(*)::int as completed_workouts,
    min(w.completed_at) as first_completed_at,
    max(w.completed_at) as last_completed_at,
    array_agg(to_char(w.completed_at at time zone 'Europe/Prague', 'YYYY-MM-DD') order by w.completed_at) as workout_dates
  from public.workout_sessions w
  where w.user_id = e.user_id
    and w.completed_at is not null
    and w.day_letter is distinct from 'H'
    and w.gym_id is distinct from 'deadbeef-0000-4000-8000-000000000001'::uuid
) ws on true
left join lateral (
  select min(up.created_at) as first_gym_plan_at
  from public.user_workout_plans up
  where up.user_id = e.user_id and up.gym_id is not null
) pl on true
left join lateral (
  select up.training_days as plan_training_days
  from public.user_workout_plans up
  where up.user_id = e.user_id and up.is_active
  order by up.created_at desc
  limit 1
) ap on true;

revoke all on public.email_lifecycle_facts from public, anon, authenticated;
grant select on public.email_lifecycle_facts to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. KPI view email_kpi_daily (pražský den × šablona) — ranní report Petra
-- ─────────────────────────────────────────────────────────────────────────────
-- eligible     = email_eligible_daily (kandidáti po pravidlech a právní bráně, před stropy)
-- sent         = email_sends.status 'sent' (dry run se nepočítá)
-- delivered … complained = odeslané e-maily s danou událostí z Resend webhooku
-- unsubscribed = příjemce se do 72 h od e-mailu odhlásil (email_unsubscribed_at)
--                nebo odmítl tipy (marketing_optout_at)
-- converted    = cílový krok do 72 h od e-mailu:
--                M2A → dotazník dokončen (vznikl plán, profil onboarding_completed)
--                M3A/M3B/M4/M5 → první dokončený trénink
--                M6 → druhý trénink;  M7/M8 → další trénink
--                (všichni kromě M2A měli v okamžiku e-mailu známý počet tréninků,
--                 takže stačí „dokončený trénink v okně“)
create or replace view public.email_kpi_daily as
with sends as (
  select s.*, (s.created_at at time zone 'Europe/Prague')::date as day
  from public.email_sends s
  where s.status = 'sent'
),
keys as (
  select day, template_key from sends
  union
  select day, template_key from public.email_eligible_daily
)
select
  k.day,
  k.template_key,
  coalesce(max(el.eligible), 0) as eligible,
  count(s.id) as sent,
  count(s.id) filter (where exists (select 1 from public.email_events ev where ev.resend_id = s.resend_id and ev.type = 'delivered')) as delivered,
  count(s.id) filter (where exists (select 1 from public.email_events ev where ev.resend_id = s.resend_id and ev.type = 'opened')) as opened,
  count(s.id) filter (where exists (select 1 from public.email_events ev where ev.resend_id = s.resend_id and ev.type = 'clicked')) as clicked,
  count(s.id) filter (where exists (select 1 from public.email_events ev where ev.resend_id = s.resend_id and ev.type = 'bounced')) as bounced,
  count(s.id) filter (where exists (select 1 from public.email_events ev where ev.resend_id = s.resend_id and ev.type = 'complained')) as complained,
  count(s.id) filter (where
    (p.email_unsubscribed_at > s.created_at and p.email_unsubscribed_at <= s.created_at + interval '72 hours')
    or (p.marketing_optout_at > s.created_at and p.marketing_optout_at <= s.created_at + interval '72 hours')
  ) as unsubscribed,
  count(s.id) filter (where case
    when s.template_key = 'M2A' then
      coalesce(p.onboarding_completed, false)
      and exists (
        select 1 from public.user_workout_plans up
        where up.user_id = s.user_id
          and up.created_at > s.created_at and up.created_at <= s.created_at + interval '72 hours'
      )
    else exists (
      select 1 from public.workout_sessions w
      where w.user_id = s.user_id
        and w.completed_at > s.created_at and w.completed_at <= s.created_at + interval '72 hours'
        and w.day_letter is distinct from 'H'
    )
  end) as converted
from keys k
left join sends s on s.day = k.day and s.template_key = k.template_key
left join public.email_eligible_daily el on el.day = k.day and el.template_key = k.template_key
left join public.user_profiles p on p.user_id = s.user_id
group by k.day, k.template_key;

revoke all on public.email_kpi_daily from public, anon, authenticated;
grant select on public.email_kpi_daily to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Seed: M3A, M3B, M4, M5, M6, M7, M8 v1 (obchodní sdělení) — JEN DRAFT
-- ─────────────────────────────────────────────────────────────────────────────
-- Patičku (Obchodní sdělení, firma + IČ, proč přišlo, odhlášení) přidává funkce pro kind='marketing'.
-- Zástupné symboly (vyplňuje lifecycle-emails, hodnoty jdou do HTML escapované):
--   {{greeting}}      Ahoj, / Hi Jana,
--   {{cta_url}}       https://app.pumplo.com/
--   {{gym_name}}      název vybrané posilovny (fallback „tvoji posilovnu“ / „your gym“)
--   {{next_day_line}} věta o nejbližším tréninkovém dni (nebo prázdné)
--   {{plan_line}}     M7: kolikrát týdně plán počítá (nebo obecná věta)
--   {{workouts_line}} M8: „1 trénink“ / „3 tréninky“ / „7 tréninků“ (4. pád)
-- Nikdy: zranění, váha, výška, věk. Žádné výčitky.
-- ON CONFLICT DO NOTHING: opakované spuštění nikdy nepřepíše schválenou verzi.
insert into public.email_templates (key, version, locale, subject, preheader, html, text, kind, status, notes)
values
-- M3A — plán hotový, posilovna vybraná, trénink nikdy nespuštěný
(
  'M3A', 1, 'cs',
  'Plán pro {{gym_name}} je připravený',
  'Cviky jsou vybrané podle strojů, které tam opravdu mají.',
  $h$<p style="margin:0 0 16px;line-height:1.5">{{greeting}}</p><p style="margin:0 0 16px;line-height:1.5">plán máš hotový a posilovnu vybranou: {{gym_name}}. Cviky v něm jsou podle strojů, které tam opravdu mají.</p><p style="margin:0 0 16px;line-height:1.5">Až tam příště budeš, stačí v appce ťuknout na Začít trénink. Appka tě provede cvik po cviku.</p><p style="margin:0 0 24px"><a href="{{cta_url}}" style="display:inline-block;background:#0B1222;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Otevřít Pumplo</a></p>$h$,
  $t${{greeting}}

plán máš hotový a posilovnu vybranou: {{gym_name}}. Cviky v něm jsou podle strojů, které tam opravdu mají.

Až tam příště budeš, stačí v appce ťuknout na Začít trénink. Appka tě provede cvik po cviku.

Otevřít Pumplo: {{cta_url}}$t$,
  'marketing', 'draft',
  'Návrh 19. 10. 2026 (agent F1) podle M3 varianta A z návrhu 1. 10. — ČEKÁ NA SCHVÁLENÍ DAVIDA'
),
(
  'M3A', 1, 'en',
  'Your plan for {{gym_name}} is ready',
  'The exercises match the machines they really have.',
  $h$<p style="margin:0 0 16px;line-height:1.5">{{greeting}}</p><p style="margin:0 0 16px;line-height:1.5">your plan is ready and your gym is set: {{gym_name}}. The exercises match the machines they really have there.</p><p style="margin:0 0 16px;line-height:1.5">Next time you are there, just tap Start workout in the app. It walks you through exercise by exercise.</p><p style="margin:0 0 24px"><a href="{{cta_url}}" style="display:inline-block;background:#0B1222;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Open Pumplo</a></p>$h$,
  $t${{greeting}}

your plan is ready and your gym is set: {{gym_name}}. The exercises match the machines they really have there.

Next time you are there, just tap Start workout in the app. It walks you through exercise by exercise.

Open Pumplo: {{cta_url}}$t$,
  'marketing', 'draft',
  'Draft 19 Oct 2026 (agent F1), M3 variant A — AWAITING DAVID APPROVAL'
),
-- M3B — plán hotový, bez posilovny: nabídnout trénink bez posilovny + zeptat se, kde cvičí
(
  'M3B', 1, 'cs',
  'Kde cvičíš?',
  'Plán skládáme podle strojů v tvé posilovně. Nebo i bez ní.',
  $h$<p style="margin:0 0 16px;line-height:1.5">{{greeting}}</p><p style="margin:0 0 16px;line-height:1.5">dotazník máš hotový. Aby ti Pumplo poskládalo trénink na míru, potřebuje vědět, kde cvičíš. Cviky vybírá podle strojů, které tam opravdu mají. Posilovnu vybereš v appce na mapě.</p><p style="margin:0 0 16px;line-height:1.5">Cvičíš doma nebo tvoje fitko v seznamu není? Zvol „Nejsem v žádné z těchto posiloven“, vyber, co máš k dispozici, a trénink poskládáme z toho.</p><p style="margin:0 0 16px;line-height:1.5">A když nám odpovíš názvem své posilovny, rádi se jí ozveme.</p><p style="margin:0 0 24px"><a href="{{cta_url}}" style="display:inline-block;background:#0B1222;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Vybrat posilovnu</a></p>$h$,
  $t${{greeting}}

dotazník máš hotový. Aby ti Pumplo poskládalo trénink na míru, potřebuje vědět, kde cvičíš. Cviky vybírá podle strojů, které tam opravdu mají. Posilovnu vybereš v appce na mapě.

Cvičíš doma nebo tvoje fitko v seznamu není? Zvol „Nejsem v žádné z těchto posiloven“, vyber, co máš k dispozici, a trénink poskládáme z toho.

A když nám odpovíš názvem své posilovny, rádi se jí ozveme.

Vybrat posilovnu: {{cta_url}}$t$,
  'marketing', 'draft',
  'Návrh 19. 10. 2026 (agent F1) podle M3 varianta B — odpovědi s názvem posilovny = B2B lead — ČEKÁ NA SCHVÁLENÍ DAVIDA'
),
(
  'M3B', 1, 'en',
  'Where do you train?',
  'We build your workout around the machines in your gym. Or without one.',
  $h$<p style="margin:0 0 16px;line-height:1.5">{{greeting}}</p><p style="margin:0 0 16px;line-height:1.5">your questionnaire is done. To build a workout that fits you, Pumplo needs to know where you train: it picks exercises for the machines your gym really has. You choose your gym on the map in the app.</p><p style="margin:0 0 16px;line-height:1.5">Training at home, or your gym is not on the list? Choose “I am not in any of these gyms”, pick the equipment you have and we build the workout from that.</p><p style="margin:0 0 16px;line-height:1.5">And if you reply with the name of your gym, we will get in touch with them.</p><p style="margin:0 0 24px"><a href="{{cta_url}}" style="display:inline-block;background:#0B1222;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Choose your gym</a></p>$h$,
  $t${{greeting}}

your questionnaire is done. To build a workout that fits you, Pumplo needs to know where you train: it picks exercises for the machines your gym really has. You choose your gym on the map in the app.

Training at home, or your gym is not on the list? Choose “I am not in any of these gyms”, pick the equipment you have and we build the workout from that.

And if you reply with the name of your gym, we will get in touch with them.

Choose your gym: {{cta_url}}$t$,
  'marketing', 'draft',
  'Draft 19 Oct 2026 (agent F1), M3 variant B — AWAITING DAVID APPROVAL'
),
-- M4 — trénink spuštěný (vznikl plán s posilovnou), žádný dokončený
(
  'M4', 1, 'cs',
  'První trénink na tebe počká',
  'Obsazený stroj vyměníš jedním ťuknutím.',
  $h$<p style="margin:0 0 16px;line-height:1.5">{{greeting}}</p><p style="margin:0 0 16px;line-height:1.5">první trénink v Pumplu máš nachystaný, jen ještě nedoběhl do konce. To se stává: obsazený stroj, málo času, nejasný cvik.</p><p style="margin:0 0 16px;line-height:1.5">Obsazený stroj vyměníš přímo u cviku tlačítkem Vyměnit cvik. A když musíš odejít dřív, trénink pozastavíš a dokončíš později.</p><p style="margin:0 0 16px;line-height:1.5">{{next_day_line}}</p><p style="margin:0 0 24px"><a href="{{cta_url}}" style="display:inline-block;background:#0B1222;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Otevřít první trénink</a></p><p style="margin:0 0 16px;line-height:1.5">Něco nefungovalo? Odpověz na tenhle e-mail, čteme to.</p>$h$,
  $t${{greeting}}

první trénink v Pumplu máš nachystaný, jen ještě nedoběhl do konce. To se stává: obsazený stroj, málo času, nejasný cvik.

Obsazený stroj vyměníš přímo u cviku tlačítkem Vyměnit cvik. A když musíš odejít dřív, trénink pozastavíš a dokončíš později.

{{next_day_line}}

Otevřít první trénink: {{cta_url}}

Něco nefungovalo? Odpověz na tenhle e-mail, čteme to.$t$,
  'marketing', 'draft',
  'Návrh 19. 10. 2026 (agent F1) podle M4 — „spuštěno“ = vznikl plán s posilovnou (rozpracovaný trénink se do DB neukládá) — ČEKÁ NA SCHVÁLENÍ DAVIDA'
),
(
  'M4', 1, 'en',
  'Your first workout is waiting for you',
  'A busy machine is one tap away from a swap.',
  $h$<p style="margin:0 0 16px;line-height:1.5">{{greeting}}</p><p style="margin:0 0 16px;line-height:1.5">your first Pumplo workout is set up, it just has not reached the finish yet. That happens: a busy machine, little time, an unclear exercise.</p><p style="margin:0 0 16px;line-height:1.5">A busy machine is swapped right at the exercise with the Swap exercise button. And if you have to leave early, pause the workout and finish it later.</p><p style="margin:0 0 16px;line-height:1.5">{{next_day_line}}</p><p style="margin:0 0 24px"><a href="{{cta_url}}" style="display:inline-block;background:#0B1222;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Open your first workout</a></p><p style="margin:0 0 16px;line-height:1.5">Something did not work? Reply to this e-mail, we read every reply.</p>$h$,
  $t${{greeting}}

your first Pumplo workout is set up, it just has not reached the finish yet. That happens: a busy machine, little time, an unclear exercise.

A busy machine is swapped right at the exercise with the Swap exercise button. And if you have to leave early, pause the workout and finish it later.

{{next_day_line}}

Open your first workout: {{cta_url}}

Something did not work? Reply to this e-mail, we read every reply.$t$,
  'marketing', 'draft',
  'Draft 19 Oct 2026 (agent F1), M4 — AWAITING DAVID APPROVAL'
),
-- M5 — den 7–10 bez tréninku: osobní otázka od Davida, prostý text, odpověď
(
  'M5', 1, 'cs',
  'Můžu se na něco zeptat?',
  'Stačí odpovědět jedním slovem.',
  $h$<p style="margin:0 0 16px;line-height:1.5">{{greeting}}</p><p style="margin:0 0 16px;line-height:1.5">tady David z Pumpla. Před týdnem vznikl tvůj tréninkový plán, ale první trénink zatím nepřišel. Nechci tě přemlouvat, jen mě zajímá: co ti brání?</p><p style="margin:0 0 16px;line-height:1.5">Stačí odpovědět jedním slovem: čas / nevím, jak začít / appka / posilovna / jiné. Čtu to sám a podle odpovědí appku opravujeme.</p><p style="margin:0 0 16px;line-height:1.5">David</p>$h$,
  $t${{greeting}}

tady David z Pumpla. Před týdnem vznikl tvůj tréninkový plán, ale první trénink zatím nepřišel. Nechci tě přemlouvat, jen mě zajímá: co ti brání?

Stačí odpovědět jedním slovem: čas / nevím, jak začít / appka / posilovna / jiné. Čtu to sám a podle odpovědí appku opravujeme.

David$t$,
  'marketing', 'draft',
  'Návrh 19. 10. 2026 (agent F1) podle M5 — prostý text bez tlačítka, odpověď na zpravy@ / info@ — ČEKÁ NA SCHVÁLENÍ DAVIDA'
),
(
  'M5', 1, 'en',
  'Can I ask you something?',
  'A one-word reply is enough.',
  $h$<p style="margin:0 0 16px;line-height:1.5">{{greeting}}</p><p style="margin:0 0 16px;line-height:1.5">this is David from Pumplo. Your training plan was created a week ago, but the first workout has not happened yet. I do not want to push you, I would just like to know: what is in the way?</p><p style="margin:0 0 16px;line-height:1.5">A one-word reply is enough: time / not sure how to start / the app / the gym / something else. I read the replies myself and we fix the app based on them.</p><p style="margin:0 0 16px;line-height:1.5">David</p>$h$,
  $t${{greeting}}

this is David from Pumplo. Your training plan was created a week ago, but the first workout has not happened yet. I do not want to push you, I would just like to know: what is in the way?

A one-word reply is enough: time / not sure how to start / the app / the gym / something else. I read the replies myself and we fix the app based on them.

David$t$,
  'marketing', 'draft',
  'Draft 19 Oct 2026 (agent F1), M5 — AWAITING DAVID APPROVAL'
),
-- M6 — jeden trénink, druhý nepřišel (pražský den 2–3)
(
  'M6', 1, 'cs',
  'První trénink máš. Druhý je na řadě',
  'Po druhém tréninku se z toho začne stávat zvyk.',
  $h$<p style="margin:0 0 16px;line-height:1.5">{{greeting}}</p><p style="margin:0 0 16px;line-height:1.5">první trénink máš za sebou. To je ten nejtěžší krok.</p><p style="margin:0 0 16px;line-height:1.5">Druhý trénink je ten, po kterém se z toho začne stávat zvyk. {{next_day_line}}</p><p style="margin:0 0 24px"><a href="{{cta_url}}" style="display:inline-block;background:#0B1222;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Otevřít druhý trénink</a></p>$h$,
  $t${{greeting}}

první trénink máš za sebou. To je ten nejtěžší krok.

Druhý trénink je ten, po kterém se z toho začne stávat zvyk. {{next_day_line}}

Otevřít druhý trénink: {{cta_url}}$t$,
  'marketing', 'draft',
  'Návrh 19. 10. 2026 (agent F1) podle M6 — bez statistik tréninku (adresy nejsou ověřené) — ČEKÁ NA SCHVÁLENÍ DAVIDA'
),
(
  'M6', 1, 'en',
  'First workout done. The second one is next',
  'After the second workout it starts turning into a habit.',
  $h$<p style="margin:0 0 16px;line-height:1.5">{{greeting}}</p><p style="margin:0 0 16px;line-height:1.5">your first workout is done. That is the hardest step.</p><p style="margin:0 0 16px;line-height:1.5">The second workout is the one that starts turning it into a habit. {{next_day_line}}</p><p style="margin:0 0 24px"><a href="{{cta_url}}" style="display:inline-block;background:#0B1222;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Open your second workout</a></p>$h$,
  $t${{greeting}}

your first workout is done. That is the hardest step.

The second workout is the one that starts turning it into a habit. {{next_day_line}}

Open your second workout: {{cta_url}}$t$,
  'marketing', 'draft',
  'Draft 19 Oct 2026 (agent F1), M6 — AWAITING DAVID APPROVAL'
),
-- M7 — zpomalení plánu (definice A/B z návrhu 1. 10.)
(
  'M7', 1, 'cs',
  'Tento týden stačí jeden trénink',
  'Plán na tebe počká, nic se neztratilo.',
  $h$<p style="margin:0 0 16px;line-height:1.5">{{greeting}}</p><p style="margin:0 0 16px;line-height:1.5">{{plan_line}} Poslední dva týdny byly asi nabité. Týden má někdy jiné plány a to je v pořádku.</p><p style="margin:0 0 16px;line-height:1.5">Vyber si tento týden jeden den, kdy to dáš. Plán pojede dál od dalšího tréninku, nic se neztratilo.</p><p style="margin:0 0 24px"><a href="{{cta_url}}" style="display:inline-block;background:#0B1222;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Otevřít Pumplo</a></p>$h$,
  $t${{greeting}}

{{plan_line}} Poslední dva týdny byly asi nabité. Týden má někdy jiné plány a to je v pořádku.

Vyber si tento týden jeden den, kdy to dáš. Plán pojede dál od dalšího tréninku, nic se neztratilo.

Otevřít Pumplo: {{cta_url}}$t$,
  'marketing', 'draft',
  'Návrh 19. 10. 2026 (agent F1) podle M7 — záměrně neradí měnit počet dní (nový plán vynuluje postup) — ČEKÁ NA SCHVÁLENÍ DAVIDA'
),
(
  'M7', 1, 'en',
  'One workout this week is enough',
  'Your plan is waiting, nothing is lost.',
  $h$<p style="margin:0 0 16px;line-height:1.5">{{greeting}}</p><p style="margin:0 0 16px;line-height:1.5">{{plan_line}} The last two weeks were probably busy. Some weeks have other plans and that is fine.</p><p style="margin:0 0 16px;line-height:1.5">Pick one day this week when you will make it. Your plan continues with the next workout, nothing is lost.</p><p style="margin:0 0 24px"><a href="{{cta_url}}" style="display:inline-block;background:#0B1222;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Open Pumplo</a></p>$h$,
  $t${{greeting}}

{{plan_line}} The last two weeks were probably busy. Some weeks have other plans and that is fine.

Pick one day this week when you will make it. Your plan continues with the next workout, nothing is lost.

Open Pumplo: {{cta_url}}$t$,
  'marketing', 'draft',
  'Draft 19 Oct 2026 (agent F1), M7 — AWAITING DAVID APPROVAL'
),
-- M8 — 21–24 dní bez tréninku po aspoň jednom tréninku
(
  'M8', 1, 'cs',
  'Nezačínáš od nuly',
  'Stačí jeden trénink a jsi zpátky.',
  $h$<p style="margin:0 0 16px;line-height:1.5">{{greeting}}</p><p style="margin:0 0 16px;line-height:1.5">od posledního tréninku uběhly zhruba tři týdny. Nezačínáš ale od nuly: v Pumplu máš za sebou {{workouts_line}} a plán pokračuje dalším tréninkem.</p><p style="margin:0 0 16px;line-height:1.5">Stačí jeden trénink a jsi zpátky.</p><p style="margin:0 0 24px"><a href="{{cta_url}}" style="display:inline-block;background:#0B1222;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Otevřít Pumplo</a></p>$h$,
  $t${{greeting}}

od posledního tréninku uběhly zhruba tři týdny. Nezačínáš ale od nuly: v Pumplu máš za sebou {{workouts_line}} a plán pokračuje dalším tréninkem.

Stačí jeden trénink a jsi zpátky.

Otevřít Pumplo: {{cta_url}}$t$,
  'marketing', 'draft',
  'Návrh 19. 10. 2026 (agent F1) podle M8 — jednou na epizodu, max 2 za 90 dní — ČEKÁ NA SCHVÁLENÍ DAVIDA'
),
(
  'M8', 1, 'en',
  'You are not starting from zero',
  'One workout and you are back.',
  $h$<p style="margin:0 0 16px;line-height:1.5">{{greeting}}</p><p style="margin:0 0 16px;line-height:1.5">it has been about three weeks since your last workout. But you are not starting from zero: you have {{workouts_line}} saved in Pumplo and your plan continues with the next one.</p><p style="margin:0 0 16px;line-height:1.5">One workout and you are back.</p><p style="margin:0 0 24px"><a href="{{cta_url}}" style="display:inline-block;background:#0B1222;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Open Pumplo</a></p>$h$,
  $t${{greeting}}

it has been about three weeks since your last workout. But you are not starting from zero: you have {{workouts_line}} saved in Pumplo and your plan continues with the next one.

One workout and you are back.

Open Pumplo: {{cta_url}}$t$,
  'marketing', 'draft',
  'Draft 19 Oct 2026 (agent F1), M8 — AWAITING DAVID APPROVAL'
)
on conflict (key, version, locale) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Cron — beze změny (job lifecycle-emails-hourly v :30 z F0 už běží)
-- ─────────────────────────────────────────────────────────────────────────────
-- M3–M8 posílá stejný běh jen v pražském slotu 16:30 (rules.ts MARKETING_SLOT_HOUR).
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
-- Schválení verze (David, po kontrole náhledu — každá šablona zvlášť):
-- update public.email_templates set status = 'approved', approved_by = 'David Novotný', approved_at = now(), updated_at = now()
--  where key = 'M6' and version = 1;
