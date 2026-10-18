// Ověří migraci onboarding_answers proti produkční DB.
// dry  → BEGIN; migrace; zápis jako uživatel + kontrola RLS (cizí řádek nevidí); ROLLBACK
// live → jen kontrola, že tabulka a politiky existují
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const mode = process.argv[2] ?? 'dry';
const pat = readFileSync(`${homedir()}/.supabase-pat`, 'utf8').trim();
const sql = readFileSync(new URL('../../supabase/migrations/20261008e_onboarding_answers.sql', import.meta.url), 'utf8');

const probe = `select
  to_regclass('public.onboarding_answers') is not null as tbl,
  (select count(*) from pg_policies where tablename = 'onboarding_answers')::int as policies,
  (select relrowsecurity from pg_class where oid = to_regclass('public.onboarding_answers')) as rls`;

const scenario = `
create temp table _oa (k text primary key, v text) on commit drop;
grant all on _oa to authenticated;
-- dva různí uživatelé
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users order by created_at limit 1), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into onboarding_answers (user_id, question, choices, free_text) values (auth.uid(), 'motivation', array['health'], 'svatba za 3 měsíce');
insert into _oa select 'own_visible', count(*)::text from onboarding_answers where free_text = 'svatba za 3 měsíce';
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users order by created_at offset 1 limit 1), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into _oa select 'other_visible', count(*)::text from onboarding_answers where free_text = 'svatba za 3 měsíce';
reset role;
do $$ begin
  insert into onboarding_answers (user_id, question, free_text) values (auth.uid(), 'motivation', repeat('x', 301));
  insert into _oa values ('too_long', 'ALLOWED');
exception when others then insert into _oa values ('too_long', 'BLOCKED');
end $$;
`;

const query = mode === 'live' ? probe : `begin;\n${sql}\n${scenario}\nselect json_object_agg(k, v) as r, (${probe.replace('select', 'select json_build_object(\'tbl\',').replace(' as tbl,', ',\'policies\',').replace(' as policies,', ',\'rls\',').replace(' as rls', ')')}) as p from _oa;\nrollback;`;

const res = await fetch('https://api.supabase.com/v1/projects/udqwjqgdsjobdufdxbpn/database/query', {
  method: 'POST',
  headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
const body = await res.json();
if (!res.ok) { console.error('query failed', JSON.stringify(body)); process.exit(1); }
const row = Array.isArray(body) ? body[0] : null;
console.log(JSON.stringify(row));
let ok;
if (mode === 'live') ok = row && row.tbl === true && row.policies === 3 && row.rls === true;
else {
  const r = row?.r ?? {};
  ok = r.own_visible === '1' && r.other_visible === '0' && r.too_long === 'BLOCKED' && row?.p?.policies === 3;
}
if (!ok) { console.error('onboarding answers probe FAILED'); process.exit(1); }
console.log(`ONBOARDING_ANSWERS_OK mode=${mode}`);
