#!/usr/bin/env node
// Kontroly e-mailů přes Loops (19. 10. 2026). Použití:
//   node scripts/ci/check-email-loops.mjs <vitest|build|privacy|lifecycle|migration|docs>
// Každý režim na konci vypíše EMAIL_LOOPS_<REŽIM>_OK, jinak skončí s exit 1.
// Režimy s negativní kontrolou ověřují, že pokažený vstup kontrolou NEPROJDE.
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const fail = (msg) => { console.error(`EMAIL_LOOPS_FAIL: ${msg}`); process.exit(1); };
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};
const stripSqlComments = (sql) => sql.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
const KEYS = ['M3A', 'M3B', 'M4', 'M5', 'M6', 'M7', 'M8'];
const EVENTS = ['signed_up', 'onboarding_completed', 'plan_ready', 'first_workout_completed', 'workout_completed', 'inactive_21d', 'plan_slowing'];

// ─── vitest / build ───────────────────────────────────────────────────────────
function checkVitest() {
  const { code, out } = run('npx', ['vitest', 'run']);
  const summary = out.split('\n').filter((l) => /Test Files|Tests /.test(l)).join(' | ');
  console.log(summary);
  if (code !== 0 || /failed/i.test(summary)) fail(`vitest exit ${code}`);
  for (const f of ['loopsSync.test.ts', 'loopsWebhook.test.ts', 'lifecycleEmailRules.test.ts', 'resendWebhook.test.ts', 'pushEmailSkip.test.ts', 'emailConsent.test.ts']) {
    if (!out.includes(f)) fail(`vitest nespustil ${f}`);
  }
  console.log('EMAIL_LOOPS_VITEST_OK');
}

function checkBuild() {
  const { code, out } = run('npx', ['vite', 'build']);
  if (code !== 0) { console.error(out.slice(-3000)); fail(`vite build exit ${code}`); }
  console.log('EMAIL_LOOPS_BUILD_OK');
}

// ─── privacy: žádná zdravotní pole, výchozí dry run ───────────────────────────
const HEALTH = ['injur', 'weight', 'height', 'age', 'gender', 'bmi', 'motivation'];
function sourceHealthProblems(files) {
  const problems = [];
  for (const [name, src] of Object.entries(files)) {
    // Mimo seznam FORBIDDEN_FIELDS a komentáře se zdravotní názvy nesmí vyskytnout.
    const code = src
      .replace(/export const FORBIDDEN_FIELDS = \[[\s\S]*?\] as const;/, '')
      .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    for (const h of HEALTH) {
      const re = h === 'age' ? /\b(age|p\.age|age_)\b|['"]age['"]/ : new RegExp(h, 'i');
      if (re.test(code)) problems.push(`${name} obsahuje „${h}“`);
    }
  }
  return problems;
}
function viewHealthProblems(sql) {
  const live = stripSqlComments(sql).toLowerCase();
  const view = live.match(/create or replace view public\.loops_contact_facts as([\s\S]*?);/);
  if (!view) return ['chybí view loops_contact_facts'];
  return ['injuries', 'weight_kg', 'height_cm', '.age', 'gender', 'motivations'].filter((b) => view[1].includes(b)).map((b) => `view vybírá ${b}`);
}
// Minimalizace: kontakt bez marketingAllowed se do Loops neposílá a dřív poslaný se smaže.
function minimisationProblems(idx) {
  const p = [];
  const loop = idx.slice(idx.indexOf('for (const r of rows) {'));
  const gate = loop.indexOf('if (!belongsInLoops(contact)) {');
  const plan = loop.indexOf('planContact(contact, prev)');
  if (gate < 0 || plan < 0 || gate > plan) p.push('kontakt bez marketingAllowed není vyřazen před planContact');
  else if (!/continue;\s*\}/.test(loop.slice(gate, plan))) p.push('brána belongsInLoops nekončí continue');
  const drop = idx.slice(idx.indexOf('// 3. Vyřazení'));
  if (!drop.includes('!inLoops.has(id)')) p.push('vyřazení nebere ztrátu marketingAllowed');
  if (!drop.includes('"/contacts/delete"')) p.push('vyřazení nemaže kontakt v Loops');
  if (!drop.includes('removed_reason: reason')) p.push('vyřazení se nezaloguje do loops_contacts');
  return p;
}

async function checkPrivacy() {
  const files = {
    'sync.ts': read('supabase/functions/loops-sync/sync.ts'),
    'index.ts': read('supabase/functions/loops-sync/index.ts'),
  };
  const problems = [...sourceHealthProblems(files), ...viewHealthProblems(read('supabase/migrations/20261019b_loops.sql')), ...minimisationProblems(files['index.ts'])];
  if (problems.length) fail(problems.join('; '));
  // Negativní fixtures: kontrola musí odhalit únik.
  const leakSrc = { 'sync.ts': files['sync.ts'].replace("c.firstName = firstName;", "c.firstName = firstName; (c as any).weightKg = (r as any).weight_kg;") };
  if (leakSrc['sync.ts'] === files['sync.ts']) fail('negativní fixture (zdroj) nic nezměnila');
  if (sourceHealthProblems(leakSrc).length === 0) fail('kontrola zdroje neodhalila weight_kg');
  if (minimisationProblems(files['index.ts'].replace('if (!belongsInLoops(contact)) {', 'if (false) {')).length === 0) fail('kontrola neodhalila chybějící bránu marketingAllowed');
  if (minimisationProblems(files['index.ts'].replace('!inLoops.has(id)', '!eligible.has(id)')).length === 0) fail('kontrola neodhalila vyřazení jen podle eligible');
  const leakView = read('supabase/migrations/20261019b_loops.sql').replace('  f.first_name,', '  f.first_name,\n  p.injuries,');
  if (viewHealthProblems(leakView).length === 0) fail('kontrola view neodhalila injuries');

  // Behaviorálně: řádek s tělesnými údaji → payload kontaktu i událostí je neobsahuje.
  const s = await imp('supabase/functions/loops-sync/sync.ts');
  const NOW = new Date('2026-10-20T14:40:00Z');
  const h = (x) => new Date(NOW.getTime() - x * 3600000).toISOString();
  const dirty = {
    user_id: '11111111-2222-4333-8444-555555555555', email: 'a@b.cz', first_name: 'Jana', language: 'cs',
    signed_up_at: h(3), onboarding_completed: true, selected_gym_id: 'g', selected_gym_name: 'Gym',
    marketing_consent_at: null, email_optout_offered_at: h(3), marketing_optout_at: null, email_unsubscribed_at: null, notification_comeback: false,
    completed_workouts: 1, first_completed_at: h(1), last_completed_at: h(1), workout_dates: ['2026-10-20'],
    training_days: ['monday'], plan_training_days: null, first_plan_at: h(2), first_gym_plan_at: h(2), has_active_plan: true,
    recent_workouts: [{ id: 'w1', at: h(1) }],
    injuries: ['XKOLENOX'], injury_note: 'XBOLESTX', weight_kg: 987, height_cm: 654, age: 321, gender: 'XGENDERX',
  };
  const c = s.buildContact(dirty);
  const evs = s.computeEvents(dirty, { logged: new Set(), lastPlanSlowingAt: null }, NOW);
  if (evs.length < 4) fail(`fixture měla vyvolat ≥ 4 události, je ${evs.length}`);
  const payload = JSON.stringify([c, s.planContact(c, undefined), ...evs.map((e) => s.eventBody(c, e)), s.planDropout('u', 'marketing_not_allowed')]);
  for (const leak of ['XKOLENOX', 'XBOLESTX', '987', '654', '321', 'XGENDERX', 'weight', 'height', 'injur']) if (payload.includes(leak)) fail(`payload obsahuje ${leak}`);
  for (const k of Object.keys(c)) if (!s.ALLOWED_CONTACT_KEYS.includes(k)) fail(`kontakt má klíč mimo allowlist: ${k}`);
  if (c.retentionEmailsAllowed !== false) fail('notification_comeback=false nedává retentionEmailsAllowed=false');
  if (s.buildContact({ ...dirty, notification_comeback: null }).retentionEmailsAllowed !== true) fail('výchozí comeback nedává retentionEmailsAllowed=true');
  if (s.belongsInLoops(s.buildContact({ ...dirty, email_optout_offered_at: null })) !== false) fail('kontakt bez právního základu by šel do Loops');
  if (s.belongsInLoops(c) !== true) fail('pozitivní kontrola: kontakt se souhlasem by do Loops nešel');
  // Pozitivní kontrola: stejný detektor únik v payloadu najde.
  if (!JSON.stringify({ ...c, weightKg: 987 }).includes('987')) fail('pozitivní kontrola detektoru selhala');

  // Výchozí dry run.
  for (const v of [undefined, null, '', 'true', 'fasle', 'yes', 'TRUE ']) if (s.isLoopsDryRun(v) !== true) fail(`isLoopsDryRun(${JSON.stringify(v)}) není dry run`);
  for (const v of ['false', 'off', '0', 'no']) if (s.isLoopsDryRun(v) !== false) fail(`isLoopsDryRun(${v}) nepřepne naostro`);
  const idx = files['index.ts'];
  if (!idx.includes('isLoopsDryRun(Deno.env.get("LOOPS_DRY_RUN"))')) fail('index nečte LOOPS_DRY_RUN přes isLoopsDryRun');
  // V dry runu se nevolá Loops ani nezapisuje: dry větev v cyklu končí continue před prvním call().
  const loop = idx.slice(idx.indexOf('for (const r of rows) {'));
  const dry = loop.indexOf('if (dryRun) {');
  const firstCall = loop.indexOf('await call(');
  const firstWrite = loop.search(/\.from\("loops_(contacts|event_log)"\)\s*\.(insert|upsert|update|delete)/);
  if (dry < 0 || firstCall < 0 || dry > firstCall || dry > firstWrite) fail('dry-run větev není před voláním Loops / zápisem');
  if (!/continue;\s*\}/.test(loop.slice(dry, firstCall))) fail('dry-run větev nekončí continue');
  const drop = idx.slice(idx.indexOf('// 3. Vyřazení'));
  const dDry = drop.indexOf('if (dryRun) {');
  if (dDry < 0 || dDry > drop.indexOf('await call(')) fail('vyřazení: dry-run větev není před voláním Loops');
  if ((idx.match(/fetch\(/g) ?? []).length !== 1) fail('čekám jediné místo s fetch() (přes loopsRequest)');
  console.log('EMAIL_LOOPS_PRIVACY_OK');
}

// ─── lifecycle: M3–M8 pryč, M2A beze změny ───────────────────────────────────
function fnSource(src, name) {
  const m = new RegExp(`export function ${name}[(<]`).exec(src);
  if (!m) return null;
  const end = src.indexOf('\n}\n', m.index);
  return src.slice(m.index, end + 2);
}
function lifecycleProblems(src, rules) {
  const p = [];
  for (const bad of ['runMarketing', 'decideLifecycle', 'MARKETING_KEYS', 'marketingVars', 'MARKETING_SLOT_HOUR', 'email_lifecycle_facts', 'email_eligible_daily']) {
    if (src.includes(bad)) p.push(`index.ts obsahuje ${bad}`);
  }
  for (const k of KEYS) if (new RegExp(`['"]${k}['"]`).test(src) || new RegExp(`['"]${k}['"]`).test(rules)) p.push(`zmínka klíče ${k}`);
  for (const bad of ['decideLifecycle', 'pickTrigger', 'MARKETING_KEYS']) if (rules.includes(`export function ${bad}`) || rules.includes(`export const ${bad}`)) p.push(`rules.ts exportuje ${bad}`);
  for (const needle of [
    '.eq("key", M2A_KEY)',
    '.eq("onboarding_completed", false)',
    'pickApprovedTemplate(templates, M2A_KEY, locale)',
    'if (!inSendWindow(now)) {',
    'decideM2A({',
    'const m2a = await runM2A(',
  ]) if (!src.includes(needle)) p.push(`index.ts: chybí „${needle}“`);
  const m2a = src.slice(src.indexOf('async function runM2A('));
  const dry = m2a.indexOf('if (dryRun) {');
  const send = m2a.indexOf('await sendViaResend(');
  const log = m2a.indexOf('await logContact(supabase, c.user_id, "email", M2A_KEY)');
  if (dry < 0 || send < 0 || log < 0 || !(dry < send && send < log)) p.push('runM2A: dry run → Resend → contact_log v tomto pořadí');
  if ((src.match(/api\.resend\.com/g) ?? []).length !== 1) p.push('čekám právě 1 volání api.resend.com');
  return p;
}
async function checkLifecycle() {
  const src = read('supabase/functions/lifecycle-emails/index.ts');
  const rules = read('supabase/functions/lifecycle-emails/rules.ts');
  const problems = lifecycleProblems(src, rules);
  if (problems.length) fail(problems.join('; '));
  // Negativní fixtures.
  const fixtures = {
    'runMarketing zpět': [src + '\nasync function runMarketing() {}\n', rules],
    'M6 v rules': [src, rules + "\nexport const X = 'M6';\n"],
    'M2A bez contact_log': [src.replace('await logContact(supabase, c.user_id, "email", M2A_KEY)', ''), rules],
  };
  for (const [label, [a, b]] of Object.entries(fixtures)) if (lifecycleProblems(a, b).length === 0) fail(`kontrola neodhalila „${label}“`);

  // M2A behaviorálně shodné s origin/main (decideM2A a renderEmail bez extraVars).
  const mainRules = run('git', ['show', 'origin/main:supabase/functions/lifecycle-emails/rules.ts']);
  if (mainRules.code !== 0) fail('nejde přečíst origin/main rules.ts');
  for (const fn of ['decideM2A', 'pickApprovedTemplate', 'greeting', 'stepLine', 'buildFooter', 'pragueHour', 'isDryRun']) {
    const a = fnSource(mainRules.out, fn);
    if (!a || a !== fnSource(rules, fn)) fail(`${fn} se liší od origin/main`);
  }
  const dir = mkdtempSync(join(tmpdir(), 'email-loops-m2a-'));
  try {
    writeFileSync(join(dir, 'main-rules.ts'), mainRules.out);
    const old = await import(pathToFileURL(join(dir, 'main-rules.ts')).href);
    const now = await imp('supabase/functions/lifecycle-emails/rules.ts');
    const tpl = { key: 'M2A', version: 1, locale: 'cs', status: 'approved', kind: 'service', subject: 'S {{greeting}}', preheader: 'P', html: '<p>{{greeting}}</p><p>{{step_line}}</p><a href="{{cta_url}}">x</a>', text: '{{greeting}}\n{{step_line}}\n{{cta_url}}' };
    let n = 0;
    for (const locale of ['cs', 'en']) for (const step of [0, 5]) {
      const inp = { template: { ...tpl, locale }, locale, firstName: 'Jana <b>', currentStep: step, ctaUrl: 'https://app.pumplo.com/', unsubscribeUrl: 'https://app.pumplo.com/odhlasit?u=1&t=2' };
      if (JSON.stringify(old.renderEmail(inp)) !== JSON.stringify(now.renderEmail(inp))) fail(`renderEmail M2A ${locale}/${step} se liší`);
      n++;
    }
    let sends = 0;
    for (let h = 0; h < 100; h += 3) for (const hourUtc of [5, 6, 10, 17, 18, 19]) {
      const at = new Date(Date.UTC(2026, 9, 20, hourUtc, 30));
      const c = { userId: 'u', email: 'a@b.cz', onboardingCompleted: false, alreadySent: false, signedUpAt: new Date(at.getTime() - h * 3600000).toISOString() };
      const a = old.decideM2A(c, at);
      if (JSON.stringify(a) !== JSON.stringify(now.decideM2A(c, at))) fail(`decideM2A se liší h=${h}`);
      if (a.send) sends++;
    }
    if (sends === 0) fail('pozitivní kontrola: M2A by nikdy neodešel');
    console.log(`M2A shoda s origin/main: render ${n}×, rozhodnutí ${34 * 6}× (z toho odeslat ${sends})`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  // Edge funkce se přeloží.
  for (const f of ['supabase/functions/lifecycle-emails/index.ts', 'supabase/functions/loops-sync/index.ts', 'supabase/functions/loops-webhook/index.ts']) {
    const r = run('deno', ['check', f]);
    if (r.code !== 0) { console.error(r.out.slice(-2000)); fail(`deno check ${f} exit ${r.code}`); }
  }
  console.log('EMAIL_LOOPS_LIFECYCLE_OK');
}

// ─── migration ────────────────────────────────────────────────────────────────
function loopsMigrationProblems(sql) {
  const live = stripSqlComments(sql).replace(/\s+/g, ' ').toLowerCase();
  const p = [];
  const need = {
    'loops_event_log': 'create table if not exists public.loops_event_log',
    'unique user/event/episode': 'unique (user_id, event, episode)',
    'loops_contacts': 'create table if not exists public.loops_contacts',
    'view loops_contact_facts': 'create or replace view public.loops_contact_facts',
    'view nad email_lifecycle_facts': 'from public.email_lifecycle_facts f',
    'view zamčené': 'revoke all on public.loops_contact_facts from public, anon, authenticated',
    'RLS event_log': 'alter table public.loops_event_log enable row level security',
    'RLS contacts': 'alter table public.loops_contacts enable row level security',
    'email_events provider': 'add column if not exists provider',
  };
  for (const [l, n] of Object.entries(need)) if (!live.includes(n)) p.push(`chybí ${l}`);
  if (/create table (?!if not exists)/.test(live)) p.push('create table bez if not exists');
  if (/create (unique )?index (?!if not exists)/.test(live)) p.push('create index bez if not exists');
  if (/add column (?!if not exists)/.test(live)) p.push('add column bez if not exists');
  if (/add constraint email_events_type_check/.test(live) && !/drop constraint if exists email_events_type_check/.test(live)) p.push('type check bez drop if exists');
  if (live.includes('cron.schedule') || live.includes('cron.unschedule')) p.push('nezakomentovaný cron');
  if (/(^|[^a-z_])delete from|truncate (table|public)|drop table/.test(live)) p.push('migrace maže data');
  // Cron v komentáři: :40, replace z pumplo-reminders-hourly.
  const flat = sql.replace(/\s+/g, ' ');
  if (!/-- '40 \* \* \* \*'/.test(flat)) p.push('cron není v :40');
  if (!flat.includes("(select command from cron.job where jobname = 'pumplo-reminders-hourly')")) p.push('cron neklonuje příkaz pumplo-reminders-hourly');
  if (!flat.includes("'/functions/v1/send-push-notifications', -- '/functions/v1/loops-sync'")) p.push('cron replace nemíří na loops-sync');
  if (/bearer [a-z0-9._-]{20,}/i.test(sql)) p.push('v migraci je token');
  return p;
}
function f1Problems(sql) {
  const live = stripSqlComments(sql).toLowerCase();
  const p = [];
  if (live.includes('insert into public.email_templates')) p.push('F1 migrace dál seeduje email_templates');
  for (const k of KEYS) if (live.includes(`'${k.toLowerCase()}'`)) p.push(`F1 migrace zmiňuje ${k}`);
  for (const n of ['add column if not exists marketing_consent_at', 'add column if not exists email_optout_offered_at', 'create table if not exists public.contact_log', 'create table if not exists public.email_events', 'create or replace view public.email_lifecycle_facts', 'create or replace view public.email_kpi_daily']) if (!live.includes(n)) p.push(`F1 ztratila ${n}`);
  return p;
}
function checkMigration() {
  const sql = read('supabase/migrations/20261019b_loops.sql');
  const f1 = read('supabase/migrations/20261019_email_f1.sql');
  const problems = [...loopsMigrationProblems(sql), ...f1Problems(f1)];
  if (problems.length) fail(problems.join('; '));
  const bad = {
    'bez unique': sql.replace('unique (user_id, event, episode)', 'check (true)'),
    'odkomentovaný cron': sql.replace("-- select cron.schedule(", "select cron.schedule("),
    'cron v :30': sql.replace("--   '40 * * * *',", "--   '30 * * * *',"),
    'create table bez if not exists': sql.replace('create table if not exists public.loops_contacts', 'create table public.loops_contacts'),
  };
  for (const [l, m] of Object.entries(bad)) {
    if (m === sql) fail(`negativní fixture „${l}“ nic nezměnila`);
    if (loopsMigrationProblems(m).length === 0) fail(`kontrola neodhalila „${l}“`);
  }
  if (f1Problems(f1 + "\ninsert into public.email_templates (key) values ('M6');").length === 0) fail('kontrola F1 neodhalila seed');
  console.log('EMAIL_LOOPS_MIGRATION_OK');
}

// ─── docs + privacy text ──────────────────────────────────────────────────────
function docsProblems(doc) {
  const p = [];
  for (const k of KEYS) {
    const re = new RegExp(`### ${k} — `);
    if (!re.test(doc)) p.push(`chybí text ${k}`);
  }
  const journeys = doc.split(/\n## J\d — /).slice(1);
  if (journeys.length < 5) p.push(`čekám ≥ 5 journeys, je ${journeys.length}`);
  for (const j of journeys) {
    const title = j.split('\n')[0];
    if (!/\*\*Trigger:\*\* událost `[a-z_0-9]+`/.test(j)) p.push(`${title}: chybí trigger`);
    if (!j.includes('**Audience filtr:** `marketingAllowed = true`')) p.push(`${title}: chybí filtr marketingAllowed`);
    if (!/\*\*Exit:\*\*/.test(j)) p.push(`${title}: chybí exit`);
    const ev = j.match(/\*\*Trigger:\*\* událost `([a-z_0-9]+)`/);
    if (ev && !EVENTS.includes(ev[1])) p.push(`${title}: neznámá událost ${ev[1]}`);
  }
  const retention = journeys.filter((j) => /`(first_workout_completed|plan_slowing|inactive_21d)`/.test(j.split('**Audience filtr:**')[0]));
  if (retention.length !== 3) p.push(`čekám 3 udržovací journeys, je ${retention.length}`);
  for (const j of retention) if (!/\*\*Audience filtr:\*\* `marketingAllowed = true` \*\*a\*\* `retentionEmailsAllowed = true`/.test(j)) p.push(`${j.split('\n')[0]}: chybí filtr retentionEmailsAllowed`);
  if (!doc.includes('`Pumplo <zpravy@pumplo.com>`') || !doc.includes('reply-to stejný')) p.push('odesílatel není Pumplo <zpravy@pumplo.com> s reply-to stejným');
  if (/David z Pumpla“\)|mail\.pumplo\.com|reply-to `info@/.test(doc)) p.push('dokument má jiného odesílatele / reply-to');
  for (const n of ['#0B1222', '#4CC9FF', 'Nunito 900', 'Setup checklist', 'LOOPS_API_KEY', 'LOOPS_DRY_RUN=true', 'LOOPS_WEBHOOK_SECRET', 'Cloudflare', '/functions/v1/loops-webhook', 'marketingAllowed', 'ČEKÁ NA SCHVÁLENÍ DAVIDA']) if (!doc.includes(n)) p.push(`dokument nezmiňuje ${n}`);
  for (const bad of ['vynechal', 'zklamal', 'lenost', 'výmluv', 'zranění tě', 'hubnut']) if (doc.toLowerCase().includes(bad)) p.push(`texty obsahují „${bad}“`);
  return p;
}
function checkDocs() {
  const doc = read('docs/email/loops-journeys.md');
  const problems = docsProblems(doc);
  const cs = read('src/i18n/locales/cs.ts');
  const en = read('src/i18n/locales/en.ts');
  const privacy = read('src/pages/Privacy.tsx');
  for (const [name, loc] of [['cs', cs], ['en', en]]) {
    const line = loc.split('\n').find((l) => l.includes("'privacy.emails_processor_loops':"));
    if (!line || !line.includes('Loops') || !/USA/.test(line) || !/(standardních smluvních doložek|standard contractual clauses)/.test(line)) problems.push(`${name}: privacy text o Loops (USA, SCC) chybí`);
    const idx = loc.indexOf("'privacy.emails_processor_loops':");
    if (!loc.slice(Math.max(0, idx - 200), idx).includes('ČEKÁ NA SCHVÁLENÍ DAVIDA')) problems.push(`${name}: chybí značka ČEKÁ NA SCHVÁLENÍ DAVIDA`);
  }
  if (!privacy.includes("t('privacy.emails_processor_loops')")) problems.push('Privacy.tsx text nezobrazuje');
  if (problems.length) fail(problems.join('; '));
  // Negativní fixture: journey bez filtru marketingAllowed neprojde.
  const bad = doc.replace('**Audience filtr:** `marketingAllowed = true` **a** `retentionEmailsAllowed = true`.\n- **Průběh:** Wait 2 dny', '**Audience filtr:** všichni.\n- **Průběh:** Wait 2 dny');
  if (bad === doc) fail('negativní fixture docs nic nezměnila');
  if (docsProblems(bad).length === 0) fail('kontrola neodhalila journey bez marketingAllowed');
  const badRet = doc.replace('**Audience filtr:** `marketingAllowed = true` **a** `retentionEmailsAllowed = true`.\n- **Průběh:** Wait 2 dny', '**Audience filtr:** `marketingAllowed = true`.\n- **Průběh:** Wait 2 dny');
  if (badRet === doc || docsProblems(badRet).length === 0) fail('kontrola neodhalila M6 bez retentionEmailsAllowed');
  if (docsProblems(doc.replace('`Pumplo <zpravy@pumplo.com>`', '`Pumplo <tipy@mail.pumplo.com>`')).length === 0) fail('kontrola neodhalila jiného odesílatele');
  console.log('EMAIL_LOOPS_DOCS_OK');
}

const modes = { vitest: checkVitest, build: checkBuild, privacy: checkPrivacy, lifecycle: checkLifecycle, migration: checkMigration, docs: checkDocs };
const mode = process.argv[2];
if (!modes[mode]) fail(`neznámý režim ${mode}; použij ${Object.keys(modes).join('|')}`);
await modes[mode]();
