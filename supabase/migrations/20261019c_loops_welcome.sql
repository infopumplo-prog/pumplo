-- J0 Vítej přes Loops workflow (18. 10. 2026) — navazuje na 20261019b_loops.sql (spustit AŽ PO ní).
--
-- Uvítací e-mail M0 je workflow J0 v Loops (trigger signed_up, audience všichni). Do Loops proto
-- jde i nový člen BEZ marketingAllowed — jen s minimem vlastností, jen do 72 h od registrace a
-- 7 dní po registraci ho loops-sync z Loops smaže (removed_reason 'welcome_window_ended').
-- Idempotentní, nic neodesílá.

-- Proč je kontakt v Loops: 'marketing' (marketingAllowed, plná sada) / 'welcome' (jen kvůli J0).
-- Starší řádky = 'marketing'.
alter table public.loops_contacts add column if not exists membership text not null default 'marketing';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'loops_contacts_membership_check') then
    alter table public.loops_contacts add constraint loops_contacts_membership_check check (membership in ('marketing', 'welcome'));
  end if;
end $$;

-- Nový důvod vyřazení.
alter table public.loops_contacts drop constraint if exists loops_contacts_removed_reason_check;
alter table public.loops_contacts add constraint loops_contacts_removed_reason_check check (
  removed_reason is null or removed_reason in ('marketing_not_allowed', 'not_eligible', 'account_deleted', 'welcome_window_ended')
);
