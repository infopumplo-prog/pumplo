// Ověří migraci veřejných tréninků (+ demo seed) proti produkční DB.
// mode=dry  → BEGIN; migrace; seed; scénáře pravidel; ROLLBACK (nic nezůstane)
// mode=live → jen čtecí kontroly po skutečném nasazení migrace a seedu
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const mode = process.argv[2] ?? 'dry';
const pat = readFileSync(`${homedir()}/.supabase-pat`, 'utf8').trim();
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20261008_public_workouts.sql') + '\n' + read('supabase/migrations/20261008b_public_workouts_covers.sql') + '\n' + read('supabase/migrations/20261008c_public_workouts_en_liked.sql') + '\n' + read('supabase/migrations/20261008d_public_workouts_secondary_focus.sql');
const seed = read('supabase/seed/demo_public_workouts.sql').replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, '');

const DEMO_GYM = 'deadbeef-0000-4000-8000-000000000001';
const as = (uidSql) => `select set_config('request.jwt.claims', json_build_object('sub', (${uidSql}), 'role', 'authenticated')::text, true);`;
const ADMIN = `select user_id from user_roles where role = 'admin' order by user_id limit 1`;
// Běžný člen: není admin, není trenér, nemá vybranou demo posilovnu, má aspoň jeden vlastní plán.
const MEMBER = `select up.user_id from user_profiles up
  where up.selected_gym_id is distinct from '${DEMO_GYM}'
    and not exists (select 1 from user_roles r where r.user_id = up.user_id and r.role = 'admin')
    and not exists (select 1 from gym_trainers gt where gt.user_id = up.user_id)
    and exists (select 1 from custom_plans p where p.user_id = up.user_id)
  order by up.user_id limit 1`;
const TRAINER = `select user_id from gym_trainers where status = 'approved' and is_active and user_id is not null
  and gym_id <> '${DEMO_GYM}' order by created_at limit 1`;

// Jen demo tréninky z katalogu (pevná ID seedu).
const demo = (args = '') => `(select * from list_public_workouts(${args}) where id::text like 'deadbeef-0000-4000-8000-0000000002%') x`;

const scenario = `
create temp table _pw (k text primary key, v text) on commit drop;

${as(ADMIN)}
-- Počítají se jen demo tréninky (skutečné zveřejněné plány a lajky by měnily čísla).
-- Lajky admina se v rollbacknuté transakci smažou, ať filtr „liked“ začíná od nuly.
delete from workout_likes where user_id = auth.uid();
insert into _pw select 'admin_count', count(*)::text from ${demo()};
insert into _pw select 'admin_covers', count(*)::text from ${demo()} where cover_url like '/img/workouts/cover-%';
insert into _pw select 'admin_en', count(*)::text from ${demo()} where name_en is not null and description_en is not null;
insert into _pw select 'admin_cardio', count(*)::text from ${demo("p_focus => 'cardio'")};
insert into _pw select 'liked_none', count(*)::text from ${demo("p_sort => 'liked'")};
insert into workout_likes (plan_id, user_id) values ('deadbeef-0000-4000-8000-0000000002a1', auth.uid());
insert into _pw select 'liked_one', string_agg(name, ',') from ${demo("p_sort => 'liked'")};
insert into _pw select 'admin_legs_any', count(*)::text from ${demo("p_focus => 'legs'")};
insert into _pw select 'admin_chest_first', (select name from ${demo("p_focus => 'chest'")} limit 1);
insert into _pw select 'admin_chest_any', count(*)::text from ${demo("p_focus => 'chest'")};
insert into _pw select 'admin_glutes', count(*)::text from ${demo("p_focus => 'glutes'")};
insert into _pw select 'admin_likes', coalesce(sum(like_count), 0)::text from ${demo()};
insert into _pw select 'db_likes', count(*)::text from workout_likes where plan_id::text like 'deadbeef-0000-4000-8000-0000000002%';
insert into _pw select 'top_is_most_liked', ((select name from ${demo()} limit 1) = 'Super booty')::text;

${as(MEMBER)}
insert into _pw select 'member_count', count(*)::text from list_public_workouts();
do $$ begin
  update custom_plans set published_at = now()
    where id = (select id from custom_plans where user_id = auth.uid() order by created_at limit 1);
  insert into _pw values ('member_publish', 'ALLOWED');
exception when others then
  insert into _pw values ('member_publish', 'BLOCKED:' || sqlerrm);
end $$;

${as(TRAINER)}
do $$
declare v_id uuid;
begin
  insert into custom_plans (user_id, name, published_at) values (auth.uid(), 'gate probe', now()) returning id into v_id;
  insert into _pw select 'trainer_publish', case when trainer_id = my_active_trainer_id() and is_public then 'OK' else 'WRONG' end
    from custom_plans where id = v_id;
exception when others then
  insert into _pw values ('trainer_publish', 'ERROR:' || sqlerrm);
end $$;

-- Trenér přestane být aktivní pod posilovnou → jeho tréninky (2) zmizí.
${as(ADMIN)}
insert into _pw select 'admin_before_adam_left', count(*)::text from list_public_workouts();
update gym_trainers set is_active = false where id = 'deadbeef-0000-4000-8000-0000000001b1';
${as(ADMIN)}
insert into _pw select 'admin_after_adam_left', count(*)::text from list_public_workouts();

select set_config('request.jwt.claims', '', true);
insert into _pw select 'anon_count', count(*)::text from list_public_workouts();
insert into _pw select 'anon_exec', has_function_privilege('anon', 'public.list_public_workouts(uuid,text,text,text,text,int)', 'EXECUTE')::text;
`;

const query = mode === 'live'
  ? `select
       (select count(*) from information_schema.columns where table_name = 'custom_plans'
          and column_name in ('published_at','description','goal','level','focus','trainer_id','source_plan_id','cover_url','name_en','description_en','secondary_focuses'))::int as cols,
       (select count(*) from pg_proc where proname in ('list_public_workouts','my_active_trainer_id','custom_plans_guard_publish'))::int as fns,
       (select count(*) from pg_trigger where tgname = 'custom_plans_guard_publish')::int as trg,
       (select count(*) from custom_plans where id::text like 'deadbeef-0000-4000-8000-0000000002%' and published_at is not null)::int as demo_plans,
       (select count(*) from workout_likes)::int as likes,
       (select count(*) from custom_plans where id::text like 'deadbeef-0000-4000-8000-0000000002%' and cover_url like '/img/workouts/cover-%')::int as covers,
       (select count(*) from custom_plans where id::text like 'deadbeef-0000-4000-8000-0000000002%' and name_en is not null)::int as en,
       (select count(*) from custom_plans where id::text like 'deadbeef-0000-4000-8000-0000000002%' and cardinality(secondary_focuses) > 0)::int as secondary`
  : `begin;\n${migration}\n${seed}\n${scenario}\nselect json_object_agg(k, v) as r from _pw;\nrollback;`;

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
if (mode === 'live') {
  ok = row && row.cols === 11 && row.secondary === 6 && row.en === 6 && row.covers === 6 && row.fns === 3 && row.trg === 1 && row.demo_plans === 6 && row.likes >= 1;
} else {
  const r = row?.r ?? {};
  ok = r.admin_count === '6'
    && r.admin_covers === '6'
    && r.admin_en === '6' && r.admin_cardio === '1' && r.liked_none === '0' && r.liked_one === 'Silový základ 5×5'
    && r.admin_legs_any === '5' && r.admin_chest_any === '3' && r.admin_chest_first === 'Chest & Arms day'
    && r.admin_glutes === '1'
    && r.admin_likes === r.db_likes && Number(r.db_likes) > 0
    && r.top_is_most_liked === 'true'
    && r.member_count === '0'
    && String(r.member_publish).startsWith('BLOCKED:') && String(r.member_publish).includes('only_trainers_can_publish')
    && r.trainer_publish === 'OK'
    && Number(r.admin_after_adam_left) === Number(r.admin_before_adam_left) - 2
    && r.anon_count === '0'
    && r.anon_exec === 'false';
}
if (!ok) { console.error('migration probe FAILED'); process.exit(1); }
console.log(`PUBLIC_WORKOUTS_MIGRATION_OK mode=${mode}`);
