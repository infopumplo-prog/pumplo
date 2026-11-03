// Ověří funkci onboarding_social_proof: dry = v rollbacku, čísla sedí s nezávislým výpočtem a anon smí volat; live = existuje.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const mode = process.argv[2] ?? 'dry';
const pat = readFileSync(`${homedir()}/.supabase-pat`, 'utf8').trim();
const sql = readFileSync(new URL('../../supabase/migrations/20261008h_social_proof_trainer_workouts.sql', import.meta.url), 'utf8');
const independent = `select
  (select count(*) from exercises where owner_id is null and video_path is not null)::int as ex,
  (select count(*) from user_profiles where onboarding_completed and primary_goal = 'fat_loss' and selected_gym_id is distinct from 'deadbeef-0000-4000-8000-000000000001')::numeric
    / nullif((select count(*) from user_profiles where onboarding_completed and primary_goal is not null and selected_gym_id is distinct from 'deadbeef-0000-4000-8000-000000000001'), 0) as fat_share`;
const query = mode === 'live'
  ? `select (select count(*) from pg_proc where proname = 'onboarding_social_proof')::int as fn, has_function_privilege('anon', 'public.onboarding_social_proof()', 'EXECUTE') as anon, onboarding_social_proof() ? 'trainer_workouts' as trainer_key`
  : `begin;\n${sql}\nselect onboarding_social_proof() as p, (${independent.replace('select', 'select json_build_object(\'ex\',').replace(' as ex,', ',\'fat\',').replace(' as fat_share', ')')}) as i, has_function_privilege('anon', 'public.onboarding_social_proof()', 'EXECUTE') as anon;\nrollback;`;
const res = await fetch('https://api.supabase.com/v1/projects/udqwjqgdsjobdufdxbpn/database/query', {
  method: 'POST', headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
});
const body = await res.json();
if (!res.ok) { console.error('query failed', JSON.stringify(body)); process.exit(1); }
const row = body[0];
console.log(JSON.stringify(row));
let ok;
if (mode === 'live') ok = row.fn === 1 && row.anon === true && row.trainer_key === true;
else {
  const shares = Object.values(row.p.goal_share).map(Number);
  const sum = shares.reduce((a, b) => a + b, 0);
  ok = row.anon === true && row.p.exercises_with_video === row.i.ex && Math.abs(Number(row.p.goal_share.fat_loss) - Number(row.i.fat)) < 0.001
    && Math.abs(sum - 1) < 0.01 && !JSON.stringify(row.p).includes('@');
}
if (!ok) { console.error('social proof probe FAILED'); process.exit(1); }
console.log(`SOCIAL_PROOF_OK mode=${mode}`);
