#!/usr/bin/env node
// Kontroly F0 e-mailů (18. 10. 2026). Použití:
//   node scripts/ci/check-email-f0.mjs <migration|dryrun|unsubget|ui|vitest|build>
// Každý režim na konci vypíše EMAIL_F0_<REŽIM>_OK, jinak skončí s exit 1.
// migration i dryrun mají vestavěnou negativní kontrolu: pokažený vstup MUSÍ
// kontrolou neprojít, jinak by kontrola neuměla selhat.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const fail = (msg) => { console.error(`EMAIL_F0_FAIL: ${msg}`); process.exit(1); };

/** SQL bez komentářů (-- …) — co se reálně provede. */
const stripSqlComments = (sql) => sql.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

function migrationProblems(sql) {
  const live = stripSqlComments(sql).replace(/\s+/g, ' ').toLowerCase();
  const problems = [];
  const need = {
    'tabulka email_templates': 'create table if not exists public.email_templates',
    'tabulka email_sends': 'create table if not exists public.email_sends',
    'tabulka email_suppressions': 'create table if not exists public.email_suppressions',
    'view email_eligible_users': 'create or replace view public.email_eligible_users',
    'sloupec marketing_optout_at': 'add column if not exists marketing_optout_at timestamptz',
    'sloupec email_unsubscribed_at': 'add column if not exists email_unsubscribed_at timestamptz',
    'unique šablon': 'unique (key, version, locale)',
    'unique odeslání': 'unique (user_id, template_key, episode_key)',
    'RLS email_templates': 'alter table public.email_templates enable row level security',
    'RLS email_sends': 'alter table public.email_sends enable row level security',
    'RLS email_suppressions': 'alter table public.email_suppressions enable row level security',
    'view zamčené pro klienty': 'revoke all on public.email_eligible_users from public, anon, authenticated',
    'view vyřazuje odhlášené': 'p.email_unsubscribed_at is null',
    'view vyřazuje suppressions': 'from public.email_suppressions s',
    'view vyřazuje is_staff': 'coalesce(p.is_staff, false) = false',
    'view vyřazuje demo': "? 'demo'",
  };
  for (const [label, needle] of Object.entries(need)) if (!live.includes(needle)) problems.push(`chybí ${label}`);
  for (const kind of ["'service'", "'marketing'"]) if (!live.includes(kind)) problems.push(`chybí kind ${kind}`);
  for (const st of ["'draft'", "'approved'", "'paused'"]) if (!live.includes(st)) problems.push(`chybí status ${st}`);
  for (const st of ["'sent'", "'dry_run'", "'failed'", "'skipped'"]) if (!live.includes(st)) problems.push(`chybí send status ${st}`);
  for (const r of ["'bounce'", "'complaint'", "'manual'"]) if (!live.includes(r)) problems.push(`chybí reason ${r}`);
  // Admin-only čtení: každá nová policy je select + has_role admin.
  const policies = live.match(/create policy [^;]+/g) ?? [];
  if (policies.length !== 3) problems.push(`čekám 3 policy, je ${policies.length}`);
  for (const p of policies) {
    if (!p.includes('for select') || !p.includes("has_role(auth.uid(), 'admin'")) problems.push(`policy není admin-only select: ${p.slice(0, 80)}`);
  }
  // Seed: jen draft.
  const seed = live.match(/insert into public\.email_templates[\s\S]*?on conflict \(key, version, locale\) do nothing/);
  if (!seed) problems.push('chybí seed s on conflict do nothing');
  else {
    const statuses = [...seed[0].matchAll(/'(service|marketing)', '(\w+)'/g)].map((m) => m[2]);
    if (statuses.length < 2) problems.push(`seed má ${statuses.length} řádků, čekám cs + en`);
    if (statuses.some((s) => s !== 'draft')) problems.push(`seed obsahuje ne-draft stav: ${statuses.join(',')}`);
    if (!seed[0].includes("'m2a', 1, 'cs'") || !seed[0].includes("'m2a', 1, 'en'")) problems.push('seed nemá M2A v1 cs + en');
  }
  // Nic se nesmí schválit ani naplánovat mimo komentář.
  if (/status\s*=\s*'approved'/.test(live)) problems.push("nezakomentované status = 'approved'");
  if (live.includes('cron.schedule')) problems.push('nezakomentovaný cron.schedule');
  if (!sql.includes("'30 * * * *'")) problems.push('chybí komentovaný cron v :30');
  return problems;
}

async function checkMigration() {
  const sql = read('supabase/migrations/20261018_email_f0.sql');
  const problems = migrationProblems(sql);
  if (problems.length) fail(problems.join('; '));
  // Negativní kontroly: musí selhat.
  const bad = {
    'seed approved': sql.replace("'service', 'draft'", "'service', 'approved'"),
    'chybí tabulka': sql.replace('create table if not exists public.email_suppressions', 'create table if not exists public.x_suppressions'),
    'chybí sloupec': sql.replace('add column if not exists email_unsubscribed_at', 'add column if not exists x_at'),
    'cron odkomentovaný': sql.replace('-- select cron.schedule(', 'select cron.schedule('),
  };
  for (const [label, mutated] of Object.entries(bad)) {
    if (mutated === sql) fail(`negativní fixture „${label}“ nic nezměnila`);
    if (migrationProblems(mutated).length === 0) fail(`kontrola neodhalila „${label}“`);
  }
  console.log('EMAIL_F0_MIGRATION_OK');
}

async function checkDryRun() {
  const rules = await import(pathToFileURL(join(root, 'supabase/functions/lifecycle-emails/rules.ts')).href);
  const cases = [[undefined, true], [null, true], ['', true], ['true', true], ['False ', false], ['0', false], ['nope', true]];
  for (const [v, want] of cases) if (rules.isDryRun(v) !== want) fail(`isDryRun(${JSON.stringify(v)}) != ${want}`);
  const src = read('supabase/functions/lifecycle-emails/index.ts');
  if (!src.includes('isDryRun(Deno.env.get("EMAIL_DRY_RUN"))')) fail('index.ts nečte EMAIL_DRY_RUN přes isDryRun');
  const fetches = src.match(/api\.resend\.com/g) ?? [];
  if (fetches.length !== 1) fail(`čekám právě 1 volání api.resend.com, je ${fetches.length}`);
  const loop = src.indexOf('for (const c of candidates)');
  const dryBranch = src.indexOf('if (dryRun) {', loop);
  const sendCall = src.indexOf('await sendViaResend(', loop);
  if (loop < 0 || dryBranch < 0 || sendCall < 0) fail('nenašel jsem smyčku / dry-run větev / odeslání');
  if (!(dryBranch < sendCall)) fail('dry-run větev není před odesláním');
  const branch = src.slice(dryBranch, sendCall);
  if (!/continue;/.test(branch)) fail('dry-run větev nekončí continue');
  // definice + M2A smyčka + (od F1) smyčka M3–M8; každé volání hlídá check-email-f1.mjs m2a
  if (src.match(/sendViaResend\(/g).length !== 3) fail('sendViaResend se volá mimo smyčky');
  if (!src.includes('status: dryRun ? "dry_run"')) fail('dry run nepíše status dry_run');
  if (rules.MAX_EMAILS_PER_RUN !== 40) fail('strop na běh není 40');
  // Negativní kontrola: výchozí true by bez guardu neprošlo.
  if (rules.isDryRun(undefined) === false) fail('kontrola neumí selhat');
  console.log('EMAIL_F0_DRYRUN_OK');
}

async function checkUnsubGet() {
  const { handleUnsubscribe } = await import(pathToFileURL(join(root, 'supabase/functions/email-unsubscribe/handler.ts')).href);
  const tok = await import(pathToFileURL(join(root, 'supabase/functions/_shared/emailUnsubToken.ts')).href);
  const secret = 'gate-secret-0123456789abcdef';
  const user = '3f2b8c1e-4a5d-4e6f-9a0b-1c2d3e4f5a6b';
  const url = await tok.buildUnsubscribeUrl('https://abc.supabase.co', user, secret);
  let calls = 0;
  const deps = { secret, unsubscribe: async () => { calls++; return { error: null }; } };
  for (const method of ['GET', 'HEAD']) {
    const res = await handleUnsubscribe(new Request(url, { method }), deps);
    if (res.status !== 200) fail(`${method} vrátil ${res.status}`);
  }
  if (calls !== 0) fail(`GET/HEAD s platným tokenem odhlásil (${calls}×)`);
  // Pozitivní kontrola: stejný odkaz POSTem odhlásit MUSÍ, jinak by kontrola neuměla selhat.
  const post = await handleUnsubscribe(new Request(url, { method: 'POST', body: 'List-Unsubscribe=One-Click', headers: { 'content-type': 'application/x-www-form-urlencoded' } }), deps);
  if (post.status !== 200 || calls !== 1) fail(`POST neodhlásil (status ${post.status}, volání ${calls})`);
  // Patička vede na stránku v appce, hlavička na funkci.
  const page = await tok.buildUnsubscribePageUrl(user, secret);
  if (!page.startsWith('https://app.pumplo.com/odhlasit?u=')) fail(`odkaz v patičce nevede na /odhlasit: ${page}`);
  const life = read('supabase/functions/lifecycle-emails/index.ts');
  if (!life.includes('unsubscribeUrl: unsubscribePageUrl') || !life.includes('unsubscribeHeaders(oneClickUrl)')) fail('lifecycle-emails nepoužívá stránku v patičce + funkci v hlavičce');
  const idx = read('supabase/functions/email-unsubscribe/index.ts');
  if (!idx.includes('handleUnsubscribe(req')) fail('index.ts nepoužívá testovaný handler');
  console.log('EMAIL_F0_UNSUB_GET_OK');
}

function checkUi() {
  const auth = read('src/pages/Auth.tsx');
  const persist = read('src/lib/persistOnboarding.ts');
  const settings = read('src/pages/Settings.tsx');
  const privacy = read('src/pages/Privacy.tsx');
  const cs = read('src/i18n/locales/cs.ts');
  const en = read('src/i18n/locales/en.ts');
  if (!/const \[marketingOptOut, setMarketingOptOut\] = useState\(false\)/.test(auth)) fail('checkbox není výchozí nezaškrtnutý');
  if (!auth.includes("t('auth.marketing_optout')") || !auth.includes('<Checkbox')) fail('checkbox v registraci chybí');
  if (!/marketingOptOut,\n(\s*\/\/[^\n]*\n)?(\s*optOutOffered: true,\n)?\s*\}\);/.test(auth)) fail('marketingOptOut není v konceptu registrace');
  if (!persist.includes('d.marketingOptOut ? { marketing_optout_at:')) fail('persistOnboarding nezapisuje marketing_optout_at');
  if (!settings.includes("t('settings.email_tips_title')") || !settings.includes('email_unsubscribed_at: new Date().toISOString()') || !settings.includes('email_unsubscribed_at: null')) fail('přepínač v Nastavení chybí');
  if (!/ČEKÁ NA SCHVÁLENÍ DAVIDA|schválil David \d+\. \d+\. 2026/.test(privacy)) fail('zásady bez značky schválení (ČEKÁ NA SCHVÁLENÍ DAVIDA / schválil David)');
  const app = read('src/App.tsx');
  if (!app.includes('<Route path="/odhlasit" element={<EmailUnsubscribe />} />')) fail('chybí veřejná routa /odhlasit');
  if (!/PUBLIC_EXACT = \[[^\]]*'\/odhlasit'/.test(read('src/lib/webGate.ts'))) fail('/odhlasit není ve WebGate allowlistu');
  const page = read('src/pages/EmailUnsubscribe.tsx');
  if (page.includes('useAuth') || !page.includes('confirmUnsubscribe(')) fail('stránka /odhlasit vyžaduje přihlášení nebo neposílá POST');
  if (!cs.includes("'Opravdu se chceš odhlásit z e-mailů s tipy?'")) fail('cs otázka na /odhlasit se liší od zadání');
  const keys = ['unsubscribe.confirm_title', 'unsubscribe.confirm_desc', 'unsubscribe.confirm_button', 'unsubscribe.done_title', 'unsubscribe.done_desc', 'unsubscribe.invalid_title', 'unsubscribe.invalid_desc', 'unsubscribe.error', 'auth.marketing_optout', 'settings.email_tips_title', 'settings.email_tips_desc', 'settings.email_tips_on', 'settings.email_tips_off', 'privacy.emails_title', 'privacy.emails_service', 'privacy.emails_tips', 'privacy.emails_processor', 'privacy.emails_optout'];
  for (const k of keys) {
    if (!cs.includes(`'${k}':`)) fail(`cs.ts nemá ${k}`);
    if (!en.includes(`'${k}':`)) fail(`en.ts nemá ${k}`);
  }
  if (!cs.includes("'Nechci dostávat tipy a novinky e-mailem'")) fail('cs text checkboxu se liší od zadání');
  if (!cs.includes("'E-maily s tipy'")) fail('cs text přepínače se liší od zadání');
  console.log('EMAIL_F0_UI_OK');
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function checkVitest() {
  const { code, out } = run('npx', ['vitest', 'run']);
  const summary = out.split('\n').filter((l) => /Test Files|Tests /.test(l)).join(' | ');
  console.log(summary);
  if (code !== 0 || /failed/i.test(summary)) fail(`vitest exit ${code}`);
  for (const f of ['emailUnsubToken.test.ts', 'lifecycleEmailRules.test.ts', 'emailUnsubscribeHandler.test.ts']) if (!out.includes(f)) fail(`vitest nespustil ${f}`);
  console.log('EMAIL_F0_VITEST_OK');
}

function checkBuild() {
  const cfg = read('vite.config.ts');
  const m = cfg.match(/maximumFileSizeToCacheInBytes:\s*(\d+)/);
  if (!m || Number(m[1]) !== 3500000) fail(`precache limit změněn: ${m?.[1]}`);
  const { code, out } = run('npx', ['vite', 'build']);
  if (code !== 0) { console.error(out.slice(-3000)); fail(`vite build exit ${code}`); }
  if (/precache.*(exceed|too large)|will not be precached/i.test(out)) fail('soubor přesáhl precache limit');
  console.log('EMAIL_F0_BUILD_OK');
}

const mode = process.argv[2];
const modes = { unsubget: checkUnsubGet, migration: checkMigration, dryrun: checkDryRun, ui: checkUi, vitest: checkVitest, build: checkBuild };
if (!modes[mode]) fail(`neznámý režim ${mode}; použij ${Object.keys(modes).join('|')}`);
await modes[mode]();
