#!/usr/bin/env node
// Kontroly F1 e-mailů (19. 10. 2026). Použití:
//   node scripts/ci/check-email-f1.mjs <migration|legal|m2a|push|webhook|ui|deno|ops|vitest|build>
// Každý režim na konci vypíše EMAIL_F1_<REŽIM>_OK, jinak skončí s exit 1.
// Režimy s negativní kontrolou ověřují, že pokažený vstup kontrolou NEPROJDE.
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const fail = (msg) => { console.error(`EMAIL_F1_FAIL: ${msg}`); process.exit(1); };
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const MIGRATION = 'supabase/migrations/20261019_email_f1.sql';
const KEYS = ['M3A', 'M3B', 'M4', 'M5', 'M6', 'M7', 'M8'];

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/** SQL bez komentářů (-- …) — co se reálně provede. */
const stripSqlComments = (sql) => sql.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

// ─── migration ────────────────────────────────────────────────────────────────
function migrationProblems(sql) {
  const live = stripSqlComments(sql).replace(/\s+/g, ' ').toLowerCase();
  const problems = [];
  const need = {
    'sloupec marketing_consent_at': 'add column if not exists marketing_consent_at timestamptz',
    'sloupec email_optout_offered_at': 'add column if not exists email_optout_offered_at timestamptz',
    'tabulka contact_log': 'create table if not exists public.contact_log',
    "contact_log kanály": "check (channel in ('push', 'email', 'in_app'))",
    'tabulka email_events': 'create table if not exists public.email_events',
    'typy email_events': "check (type in ('delivered', 'opened', 'clicked', 'bounced', 'complained'))",
    'idempotence webhooku': 'create unique index if not exists email_events_svix_id_key',
    'tabulka email_eligible_daily': 'create table if not exists public.email_eligible_daily',
    'view email_lifecycle_facts': 'create or replace view public.email_lifecycle_facts',
    'view email_kpi_daily': 'create or replace view public.email_kpi_daily',
    'facts staví na email_eligible_users': 'from public.email_eligible_users e',
    'právní brána ve view': 'as marketing_ok',
    'facts zamčené': 'revoke all on public.email_lifecycle_facts from public, anon, authenticated',
    'kpi zamčené': 'revoke all on public.email_kpi_daily from public, anon, authenticated',
    'RLS contact_log': 'alter table public.contact_log enable row level security',
    'RLS email_events': 'alter table public.email_events enable row level security',
    'RLS email_eligible_daily': 'alter table public.email_eligible_daily enable row level security',
    'KPI konverze 72 h': "interval '72 hours'",
    'KPI odhlášení': 'as unsubscribed',
    'KPI konverze': 'as converted',
    'KPI eligible': 'as eligible',
  };
  for (const [label, needle] of Object.entries(need)) if (!live.includes(needle)) problems.push(`chybí ${label}`);
  for (const col of ['delivered', 'opened', 'clicked', 'bounced', 'complained', 'sent']) if (!live.includes(`as ${col}`)) problems.push(`KPI bez sloupce ${col}`);
  const policies = live.match(/create policy [^;]+/g) ?? [];
  if (policies.length !== 3) problems.push(`čekám 3 policy, je ${policies.length}`);
  for (const p of policies) if (!p.includes('for select') || !p.includes("has_role(auth.uid(), 'admin'")) problems.push(`policy není admin-only select: ${p.slice(0, 80)}`);
  // F0 objekty se nemění.
  if (/create or replace view public\.email_eligible_users/.test(live)) problems.push('F1 přepisuje F0 view email_eligible_users');
  if (/(alter|drop) table public\.email_(sends|templates|suppressions)/.test(live)) problems.push('F1 mění F0 tabulky');
  // Personalizace: facts view nesmí vybírat zdravotní a tělesné údaje.
  const facts = live.match(/create or replace view public\.email_lifecycle_facts as (.*?);/);
  if (!facts) problems.push('nenašel jsem tělo facts view');
  else for (const bad of ['injuries', 'weight_kg', 'height_cm', 'p.age', '.age,']) if (facts[1].includes(bad)) problems.push(`facts view vybírá ${bad}`);
  // Seed: jen draft, jen obchodní, všech 7 klíčů v cs i en, on conflict do nothing.
  const seed = live.match(/insert into public\.email_templates.*?on conflict \(key, version, locale\) do nothing/);
  if (!seed) problems.push('chybí seed s on conflict do nothing');
  else {
    const rows = [...seed[0].matchAll(/\(\s*'(m\d[ab]?)', (\d+), '(cs|en)'/g)].map((m) => `${m[1]}:${m[3]}`);
    const statuses = [...seed[0].matchAll(/'(service|marketing)', '(\w+)'/g)].map((m) => `${m[1]}/${m[2]}`);
    for (const k of KEYS) for (const l of ['cs', 'en']) if (!rows.includes(`${k.toLowerCase()}:${l}`)) problems.push(`seed nemá ${k} ${l}`);
    if (rows.length !== 14) problems.push(`seed má ${rows.length} řádků, čekám 14`);
    if (statuses.length !== rows.length) problems.push(`seed: ${statuses.length} stavů na ${rows.length} řádků`);
    if (statuses.some((s) => s !== 'marketing/draft')) problems.push(`seed obsahuje jiný stav než marketing/draft: ${[...new Set(statuses)].join(',')}`);
    if (rows.includes('m2a:cs') || rows.includes('m2a:en')) problems.push('seed sahá na M2A');
  }
  // „Obchodní sdělení“ patičku přidává funkce; šablona ji nesmí vynechat tím, že je service.
  if (/status\s*=\s*'approved'/.test(live)) problems.push("nezakomentované status = 'approved'");
  if (live.includes('cron.schedule') || live.includes('cron.unschedule')) problems.push('nezakomentovaný cron');
  if (/(^|[^a-z_])delete from|truncate (table|public)/.test(live)) problems.push('migrace maže data');
  // Texty: bez výčitek a bez tělesných údajů.
  for (const bad of ['vynechal', 'zklamal', 'lenost', 'výmluv', 'váh', 'zranění', 'hubnut']) if (live.includes(bad)) problems.push(`texty obsahují „${bad}“`);
  if (/\d\s*kg\b|\{\{(age|weight|height|injur)/.test(live)) problems.push('texty obsahují tělesné údaje');
  return problems;
}

function checkMigration() {
  const sql = read(MIGRATION);
  const problems = migrationProblems(sql);
  if (problems.length) fail(problems.join('; '));
  const bad = {
    'seed approved': sql.replace("'marketing', 'draft',", "'marketing', 'approved',"),
    'seed service': sql.replace("'marketing', 'draft',", "'service', 'draft',"),
    'chybí contact_log': sql.replace('create table if not exists public.contact_log', 'create table if not exists public.x_log'),
    'chybí sloupec': sql.replace('add column if not exists email_optout_offered_at', 'add column if not exists x_at'),
    'chybí M8 en': sql.replace("'M8', 1, 'en'", "'X8', 1, 'en'"),
    'odkomentované schválení': sql.replace("-- update public.email_templates set status = 'approved'", "update public.email_templates set status = 'approved'"),
    'zranění ve view': sql.replace('  p.current_day_index,', '  p.current_day_index,\n  p.injuries,'),
  };
  for (const [label, mutated] of Object.entries(bad)) {
    if (mutated === sql) fail(`negativní fixture „${label}“ nic nezměnila`);
    if (migrationProblems(mutated).length === 0) fail(`kontrola neodhalila „${label}“`);
  }
  console.log('EMAIL_F1_MIGRATION_OK');
}

// ─── legal ────────────────────────────────────────────────────────────────────
async function checkLegal() {
  const r = await imp('supabase/functions/lifecycle-emails/rules.ts');
  const NOW = new Date('2026-10-20T14:30:00Z'); // 16:30 Praha
  const TODAY = '2026-10-20';
  const ago = (d) => r.shiftKey(TODAY, -d);
  const at10 = (d) => `${ago(d)}T08:00:00Z`;
  const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600000).toISOString();
  const base = {
    userId: 'u', email: 'a@b.cz', signedUpAt: at10(2), onboardingCompleted: true, selectedGymId: 'g',
    marketingConsentAt: null, emailOptoutOfferedAt: null, marketingOptoutAt: null, emailUnsubscribedAt: null,
    notificationComeback: true, trainingDays: ['monday', 'wednesday', 'friday'], planTrainingDays: null,
    firstGymPlanAt: null, workoutDates: [], hasDeviceToken: false,
  };
  const scen = {
    M3A: {}, M3B: { selectedGymId: null }, M4: { signedUpAt: at10(4), firstGymPlanAt: hoursAgo(80) },
    M5: { signedUpAt: at10(8) }, M6: { workoutDates: [ago(3)] },
    M7: { workoutDates: [ago(30), ago(25), ago(20), ago(8)] }, M8: { workoutDates: [ago(40), ago(22)] },
  };
  const H = { emails: [], contacts: [], pushDateKeys: [] };
  const approved = new Set(KEYS);
  let negatives = 0;
  for (const [key, s] of Object.entries(scen)) {
    // App-store build bez zaškrtávátka: žádná nabídka, žádný souhlas → nic.
    const appStore = r.decideLifecycle({ ...base, ...s }, H, NOW, approved);
    if (appStore.send || appStore.reason !== 'no_legal_basis') fail(`${key}: app-store uživatel bez nabídky dostal ${JSON.stringify(appStore)}`);
    for (const extra of [
      { emailOptoutOfferedAt: hoursAgo(50), marketingOptoutAt: hoursAgo(50) },
      { emailOptoutOfferedAt: hoursAgo(50), emailUnsubscribedAt: hoursAgo(1) },
      { marketingConsentAt: hoursAgo(50), marketingOptoutAt: hoursAgo(1) },
    ]) {
      const d = r.decideLifecycle({ ...base, ...s, ...extra }, H, NOW, approved);
      if (d.send) fail(`${key}: odešel i přes ${JSON.stringify(extra)}`);
      negatives++;
    }
    // Pozitivní kontroly: nabídka z registrace / souhlas → odejde (jinak by kontrola neuměla selhat).
    for (const extra of [{ emailOptoutOfferedAt: hoursAgo(50) }, { marketingConsentAt: hoursAgo(50) }]) {
      const d = r.decideLifecycle({ ...base, ...s, ...extra }, H, NOW, approved);
      if (!d.send || d.key !== key) fail(`${key}: pozitivní kontrola ${JSON.stringify(extra)} neodešla: ${JSON.stringify(d)}`);
    }
    // Bez schválené šablony nic.
    const na = r.decideLifecycle({ ...base, ...s, marketingConsentAt: hoursAgo(50) }, H, NOW, new Set());
    if (na.send) fail(`${key}: odešel bez schválené šablony`);
  }
  // Funkce posílá jen podle decideLifecycle a čte všechny sloupce brány.
  const src = read('supabase/functions/lifecycle-emails/index.ts');
  for (const col of ['marketing_consent_at', 'email_optout_offered_at', 'marketing_optout_at', 'email_unsubscribed_at']) {
    if (!src.includes(col)) fail(`lifecycle-emails nečte ${col}`);
  }
  if (!src.includes('decideLifecycle(facts, history, now, approvedKeys)')) fail('runMarketing nerozhoduje přes decideLifecycle');
  if (!/if \(!decision\.send\) \{[\s\S]{0,200}continue;/.test(src)) fail('runMarketing nepřeskočí decision.send=false');
  if (!src.includes('t.status === "approved" && (MARKETING_KEYS')) fail('approvedKeys nefiltruje schválené šablony');
  console.log(`legal: 7 mailů × (1 bez nabídky + ${negatives / 7} odmítnutí/odhlášení) zablokováno, pozitivní kontroly prošly`);
  console.log('EMAIL_F1_LEGAL_OK');
}

// ─── m2a ──────────────────────────────────────────────────────────────────────
function fnSource(src, name) {
  const m = new RegExp(`export function ${name}[(<]`).exec(src);
  if (!m) return null;
  const start = m.index;
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end + 2);
}

async function checkM2A() {
  const mainRules = run('git', ['show', 'origin/main:supabase/functions/lifecycle-emails/rules.ts']);
  if (mainRules.code !== 0) fail('nejde přečíst origin/main rules.ts');
  const cur = read('supabase/functions/lifecycle-emails/rules.ts');
  for (const fn of ['decideM2A', 'pickApprovedTemplate', 'greeting', 'stepLine', 'buildFooter', 'pragueHour', 'isDryRun']) {
    const a = fnSource(mainRules.out, fn);
    const b = fnSource(cur, fn);
    if (!a || a !== b) fail(`${fn} se liší od origin/main`);
  }
  for (const c of ['M2A_MIN_HOURS = 2', 'M2A_MAX_HOURS = 72', 'SEND_WINDOW_START_HOUR = 8', 'SEND_WINDOW_END_HOUR = 20', 'MAX_EMAILS_PER_RUN = 40']) {
    if (!cur.includes(c)) fail(`konstanta ${c} se změnila`);
  }
  const t = run('git', ['diff', '--quiet', 'origin/main', '--', 'src/lib/lifecycleEmailRules.test.ts', 'supabase/migrations/20261018_email_f0.sql', 'supabase/functions/email-unsubscribe', 'supabase/functions/_shared/emailUnsubToken.ts']);
  if (t.code !== 0) fail('F0 testy / migrace / odhlášení se změnily');

  // Behaviorální shoda: renderEmail pro M2A (bez extraVars) = výstup z origin/main.
  const dir = mkdtempSync(join(tmpdir(), 'email-f1-m2a-'));
  try {
    writeFileSync(join(dir, 'main-rules.ts'), mainRules.out);
    const old = await import(pathToFileURL(join(dir, 'main-rules.ts')).href);
    const now = await imp('supabase/functions/lifecycle-emails/rules.ts');
    const tpl = { key: 'M2A', version: 1, locale: 'cs', status: 'approved', kind: 'service', subject: 'S {{greeting}}', preheader: 'P', html: '<p>{{greeting}}</p><p>{{step_line}}</p><a href="{{cta_url}}">x</a>', text: '{{greeting}}\n{{step_line}}\n{{cta_url}}' };
    for (const locale of ['cs', 'en']) for (const step of [0, 5]) {
      const inp = { template: { ...tpl, locale }, locale, firstName: 'Jana <b>', currentStep: step, ctaUrl: 'https://app.pumplo.com/', unsubscribeUrl: 'https://app.pumplo.com/odhlasit?u=1&t=2' };
      if (JSON.stringify(old.renderEmail(inp)) !== JSON.stringify(now.renderEmail(inp))) fail(`renderEmail M2A ${locale}/${step} se liší od origin/main`);
    }
    const base = { userId: 'u', email: 'a@b.cz', onboardingCompleted: false, alreadySent: false };
    for (let h = 0; h < 100; h += 3) for (const hourUtc of [5, 6, 10, 17, 18, 19]) {
      const at = new Date(Date.UTC(2026, 9, 20, hourUtc, 30));
      const c = { ...base, signedUpAt: new Date(at.getTime() - h * 3600000).toISOString() };
      if (JSON.stringify(old.decideM2A(c, at)) !== JSON.stringify(now.decideM2A(c, at))) fail(`decideM2A se liší pro h=${h} utc=${hourUtc}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // Index: M2A dotaz a výběr šablony beze změny; M3–M8 jen schválené.
  const src = read('supabase/functions/lifecycle-emails/index.ts');
  for (const needle of [
    '.eq("onboarding_completed", false)',
    'const templates = allTemplates.filter((t) => t.key === M2A_KEY);',
    'pickApprovedTemplate(templates, M2A_KEY, locale)',
    'if (!inSendWindow(now)) {',
    'if (!templates.some((t) => t.status === "approved")) {',
    'const template = pickApprovedTemplate(templates, key, locale);',
    'if (!template || template.kind !== "marketing") continue;',
  ]) if (!src.includes(needle)) fail(`index.ts: chybí „${needle}“`);
  // Dry run nikdy nepíše contact_log a nevolá Resend.
  for (const fn of ['runM2A', 'runMarketing']) {
    const s = src.slice(src.indexOf(`async function ${fn}(`));
    const dry = s.indexOf('if (dryRun) {');
    const send = s.indexOf('await sendViaResend(');
    const log = s.indexOf('await logContact(');
    if (dry < 0 || send < 0 || log < 0 || !(dry < send && send < log)) fail(`${fn}: dry-run větev musí být před odesláním a contact_log až po něm`);
    if (!/continue;/.test(s.slice(dry, send))) fail(`${fn}: dry-run větev nekončí continue`);
  }
  if ((src.match(/api\.resend\.com/g) ?? []).length !== 1) fail('čekám právě 1 volání api.resend.com');
  console.log('EMAIL_F1_M2A_OK');
}

// ─── push ─────────────────────────────────────────────────────────────────────
async function checkPush() {
  const r = await imp('supabase/functions/send-push-notifications/rules.ts');
  for (const k of ['morning', 'missed', 'first_workout']) {
    if (r.skipMorningPushForEmail(k, true) !== true) fail(`${k} se po e-mailu nevynechá`);
    if (r.skipMorningPushForEmail(k, false) !== false) fail(`${k} se vynechá i bez e-mailu`);
  }
  if (r.pragueDayStartIso('2026-10-20') !== '2026-10-19T22:00:00.000Z') fail('pragueDayStartIso léto');
  if (r.pragueDayStartIso('2026-12-01') !== '2026-11-30T23:00:00.000Z') fail('pragueDayStartIso zima');
  const src = read('supabase/functions/send-push-notifications/index.ts');
  const morning = src.slice(src.indexOf('async function processMorningNotifications('), src.indexOf('async function processClosingNotifications('));
  const skip = morning.indexOf('skipMorningPushForEmail(kind, await hadEmailSince(supabase, user.user_id, pragueDayStartIso(dateKey)))');
  const send = morning.indexOf('sendWebPush(');
  if (skip < 0 || send < 0 || !(skip < send)) fail('ranní push nekontroluje dnešní e-mail před odesláním');
  const log = src.slice(src.indexOf('async function logNotification('));
  if (!log.slice(0, 600).includes("await logContact(supabase, userId, 'push', notificationType);")) fail('logNotification nepíše do contact_log');
  const shared = read('supabase/functions/_shared/contactLog.ts');
  if (!/if \(error\) \{[\s\S]{0,120}return false;/.test(shared)) fail('chyba čtení contact_log musí push nechat projít');
  // Diff push funkce je malý (minimální zásah).
  const d = run('git', ['diff', '--numstat', 'origin/main', '--', 'supabase/functions/send-push-notifications/index.ts']);
  const [add, del] = d.out.trim().split(/\s+/).map(Number);
  if (!(add <= 20 && del <= 2)) fail(`zásah do send-push-notifications/index.ts není minimální (+${add} −${del})`);
  console.log('EMAIL_F1_PUSH_OK');
}

// ─── webhook ──────────────────────────────────────────────────────────────────
async function checkWebhook() {
  const h = await imp('supabase/functions/resend-webhook/handler.ts');
  const secret = 'whsec_' + Buffer.from('gate-webhook-secret-0123456789abcdef').toString('base64');
  const now = 1_760_000_000;
  const body = JSON.stringify({ type: 'email.complained', data: { email_id: 're_1', to: ['X@Y.cz'] } });
  const mk = async (b, ts = now, sec = secret) => new Request('https://x/', {
    method: 'POST',
    headers: { 'svix-id': 'm1', 'svix-timestamp': String(ts), 'svix-signature': `v1,${await h.svixSignature(sec, 'm1', String(ts), body)}` },
    body: b,
  });
  let stored = 0; const supp = [];
  const deps = { secret, nowSeconds: () => now, storeEvent: async () => { stored++; return { error: null }; }, suppress: async (e, r) => { supp.push(`${e}:${r}`); return { error: null }; } };
  for (const [label, req] of [
    ['pozměněné tělo', await mk(body.replace('re_1', 're_2'))],
    ['starý timestamp', await mk(body, now - 3600)],
    ['cizí tajemství', await mk(body, now, 'whsec_' + Buffer.from('another-secret-0123456789abcdef').toString('base64'))],
  ]) {
    const res = await h.handleResendWebhook(req, deps);
    if (res.status !== 401) fail(`${label}: čekám 401, je ${res.status}`);
  }
  if (stored !== 0 || supp.length) fail('neplatný podpis něco uložil');
  const ok = await h.handleResendWebhook(await mk(body), deps);
  if (ok.status !== 200 || stored !== 1 || supp[0] !== 'x@y.cz:complaint') fail(`platná stížnost: status ${ok.status}, stored ${stored}, supp ${supp}`);
  const cfg = read('supabase/config.toml');
  if (!/\[functions\.resend-webhook\]\s*\nverify_jwt = false/.test(cfg)) fail('config.toml: resend-webhook verify_jwt=false chybí');
  const idx = read('supabase/functions/resend-webhook/index.ts');
  if (!idx.includes('handleResendWebhook(req') || !idx.includes('Deno.env.get("RESEND_WEBHOOK_SECRET")')) fail('index.ts nepoužívá handler / RESEND_WEBHOOK_SECRET');
  if (!idx.includes('from("email_suppressions").insert') || !idx.includes('from("email_events").insert')) fail('index.ts nezapisuje events/suppressions');
  console.log('EMAIL_F1_WEBHOOK_OK');
}

// ─── ui ───────────────────────────────────────────────────────────────────────
function checkUi() {
  const auth = read('src/pages/Auth.tsx');
  const persist = read('src/lib/persistOnboarding.ts');
  const home = read('src/pages/Home.tsx');
  const settings = read('src/pages/Settings.tsx');
  const sheet = read('src/components/home/EmailConsentSheet.tsx');
  const consent = read('src/lib/emailConsent.ts');
  const cs = read('src/i18n/locales/cs.ts');
  const en = read('src/i18n/locales/en.ts');
  if (!/marketingOptOut,\n\s*\/\/[^\n]*\n\s*optOutOffered: true,\n\s*\}\);/.test(auth)) fail('koncept registrace nenese optOutOffered: true');
  // Checkbox je ve stejném kroku jako odeslání registrace i Apple/Google tlačítka.
  const cb = auth.indexOf('id="marketing-optout"');
  const g = auth.indexOf("handleOAuthLogin('google')", cb);
  if (cb < 0 || g < 0 || g - cb > 5000) fail('checkbox není ve stejném kroku jako registrace přes Google/Apple');
  if (!persist.includes("...(d.optOutOffered === true ? { email_optout_offered_at: consentChoiceAt } : {}),")) fail('persistOnboarding nezapisuje email_optout_offered_at jen při nabídce');
  if (/email_optout_offered_at/.test(read('src/pages/Training.tsx'))) fail('Training se nesmí dotýkat souhlasu');
  if (!home.includes('<EmailConsentSheet') || !home.includes('shouldAskEmailConsent({')) fail('Home nezobrazuje žádost o souhlas');
  if (!home.includes('hasPausedWorkout: !!pausedWorkout || !!pausedCustomWorkout')) fail('žádost se neskrývá při rozpracovaném tréninku');
  if (/EmailConsentSheet/.test(read('src/pages/Training.tsx'))) fail('žádost o souhlas nesmí být v tréninku');
  if (!consent.includes("? { marketing_consent_at: now.toISOString(), marketing_optout_at: null }") || !consent.includes(": { marketing_optout_at: now.toISOString() }")) fail('Ano/Ne nezapisují správné sloupce');
  if (!consent.includes("from '../../supabase/functions/lifecycle-emails/rules'")) fail('appka nesdílí právní bránu s lifecycle-emails');
  if (!sheet.includes("answer('yes')") || !sheet.includes("answer('no')") || !sheet.includes('markEmailConsentAsked()')) fail('panel nemá Ano/Ne nebo neoznačí, že se zeptal');
  if (!settings.includes('marketing_consent_at: new Date().toISOString()')) fail('Nastavení: zapnutí tipů nezapisuje souhlas');
  if (!cs.includes("'email_consent.title': 'Chceš od nás občas tip k tréninku e-mailem?'")) fail('cs otázka se liší od zadání');
  for (const k of ['email_consent.title', 'email_consent.body', 'email_consent.yes', 'email_consent.no', 'email_consent.hint']) {
    if (!cs.includes(`'${k}':`)) fail(`cs.ts nemá ${k}`);
    if (!en.includes(`'${k}':`)) fail(`en.ts nemá ${k}`);
  }
  console.log('EMAIL_F1_UI_OK');
}

// ─── deno ─────────────────────────────────────────────────────────────────────
const denoErrors = (out) => (out.match(/\[ERROR\]/g) ?? []).length;

function checkDeno() {
  const v = run('deno', ['--version']);
  if (v.code !== 0) fail('deno není k dispozici');
  for (const f of ['supabase/functions/lifecycle-emails/index.ts', 'supabase/functions/resend-webhook/index.ts']) {
    const r = run('deno', ['check', f]);
    if (r.code !== 0) { console.error(r.out.slice(-2000)); fail(`deno check ${f} exit ${r.code}`); }
  }
  // send-push-notifications má na main 6 starších chyb typů; F1 nesmí přidat žádnou.
  const pushNow = run('deno', ['check', 'supabase/functions/send-push-notifications/index.ts']);
  const dir = mkdtempSync(join(tmpdir(), 'email-f1-deno-'));
  try {
    const tar = spawnSync('sh', ['-c', `git archive origin/main supabase/functions | tar -x -C "${dir}"`], { cwd: root, encoding: 'utf8' });
    if (tar.status !== 0) fail('git archive origin/main selhal');
    const pushMain = run('deno', ['check', 'supabase/functions/send-push-notifications/index.ts'], { cwd: dir });
    const a = denoErrors(pushNow.out);
    const b = denoErrors(pushMain.out);
    console.log(`send-push-notifications: chyb typů ${a} (origin/main ${b})`);
    if (b === 0 && pushMain.code !== 0) fail('origin/main deno check selhal bez chyb typů (prostředí?)');
    if (a > b) fail(`F1 přidal chyby typů do send-push-notifications (${a} > ${b})`);
    if (pushNow.out.includes('rules.ts') && /rules\.ts.*\n.*ERROR|ERROR[\s\S]{0,300}rules\.ts/.test(pushNow.out)) fail('chyba typů v push rules.ts');
    if (pushNow.out.includes('contactLog.ts:')) fail('chyba typů v _shared/contactLog.ts');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log('EMAIL_F1_DENO_OK');
}

// ─── ops ──────────────────────────────────────────────────────────────────────
function checkOps() {
  const rep = read('supabase/sql/email_report_daily.sql');
  const live = stripSqlComments(rep).toLowerCase();
  for (const bad of ['insert ', 'update ', 'delete ', 'alter ', 'drop ', 'create ', 'truncate ', 'grant ', 'cron.']) {
    if (live.includes(bad)) fail(`report SQL obsahuje „${bad.trim()}“`);
  }
  if ((live.match(/;/g) ?? []).length !== 1) fail('report SQL má být jeden příkaz');
  for (const need of ['public.email_kpi_daily', "'activation_7d'", "interval '7 days'", 'public.email_eligible_users']) if (!live.includes(need)) fail(`report SQL nečte ${need}`);
  const p = join(root, '.deploy-email-f1.sh');
  if (!existsSync(p)) fail('chybí .deploy-email-f1.sh');
  const sh = readFileSync(p, 'utf8');
  const shLive = sh.split('\n').filter((l) => !l.trim().startsWith('#') && !/^\s*echo /.test(l)).join('\n');
  if (!sh.includes('test -f supabase/migrations/20261019_email_f1.sql')) fail('deploy skript nehlídá F1 v main');
  for (const fn of ['lifecycle-emails', 'send-push-notifications', 'resend-webhook']) if (!shLive.includes(`supabase functions deploy ${fn}`)) fail(`deploy skript nenasazuje ${fn}`);
  if (/status\s*=\s*'approved'/.test(shLive) || /approved_by/.test(shLive)) fail('deploy skript schvaluje šablonu');
  if (/EMAIL_DRY_RUN/.test(shLive)) fail('deploy skript mění EMAIL_DRY_RUN');
  if (/cron\.(un)?schedule/.test(shLive)) fail('deploy skript mění cron');
  if (!sh.includes('RESEND_WEBHOOK_SECRET')) fail('deploy skript nezmiňuje RESEND_WEBHOOK_SECRET');
  const migIdx = shLive.indexOf('20261019_email_f1.sql');
  const fnIdx = shLive.indexOf('supabase functions deploy');
  if (!(migIdx >= 0 && migIdx < fnIdx)) fail('migrace musí jít před nasazením funkcí');
  const syn = run('zsh', ['-n', p]);
  if (syn.code !== 0) fail(`deploy skript má syntaktickou chybu: ${syn.out}`);
  console.log('EMAIL_F1_OPS_OK');
}

// ─── vitest / build ───────────────────────────────────────────────────────────
function checkVitest() {
  const { code, out } = run('npx', ['vitest', 'run']);
  const summary = out.split('\n').filter((l) => /Test Files|Tests /.test(l)).join(' | ');
  console.log(summary);
  if (code !== 0 || /failed/i.test(summary)) fail(`vitest exit ${code}`);
  for (const f of ['lifecycleRetargeting.test.ts', 'pushEmailSkip.test.ts', 'resendWebhook.test.ts', 'emailConsent.test.ts', 'lifecycleEmailRules.test.ts', 'pushRules.test.ts']) {
    if (!out.includes(f)) fail(`vitest nespustil ${f}`);
  }
  console.log('EMAIL_F1_VITEST_OK');
}

function checkBuild() {
  const cfg = read('vite.config.ts');
  const m = cfg.match(/maximumFileSizeToCacheInBytes:\s*(\d+)/);
  if (!m || Number(m[1]) !== 3500000) fail(`precache limit změněn: ${m?.[1]}`);
  const { code, out } = run('npx', ['vite', 'build']);
  if (code !== 0) { console.error(out.slice(-3000)); fail(`vite build exit ${code}`); }
  if (/precache.*(exceed|too large)|will not be precached/i.test(out)) fail('soubor přesáhl precache limit');
  console.log('EMAIL_F1_BUILD_OK');
}

const mode = process.argv[2];
const modes = { migration: checkMigration, legal: checkLegal, m2a: checkM2A, push: checkPush, webhook: checkWebhook, ui: checkUi, deno: checkDeno, ops: checkOps, vitest: checkVitest, build: checkBuild };
if (!modes[mode]) fail(`neznámý režim ${mode}; použij ${Object.keys(modes).join('|')}`);
await modes[mode]();
