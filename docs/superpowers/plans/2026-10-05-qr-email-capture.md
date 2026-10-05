# QR stránka stroje — sběr e-mailů (fáze 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na `app.pumplo.com/s/<code>` po 6 s ukázat malé okno „Odebírat“ (zarovnané s názvem cviku, ztmavená obrazovka), uložit e-mail se souhlasem, posilovnou a strojem do `qr_leads`, a na tom zařízení okno už nikdy neukázat.

**Architecture:** Nová větev `feat/qr-email-capture-v2` z `origin/main`. Starší neodsouhlasená větev `feat/qr-email-capture` (66dc07a: double opt-in, Resend, registrace, Nastavení, změna `handle_new_user`) zůstává netknutá; z ní se převezmou jen čisté pomocné funkce. Zápis jde výhradně přes existující veřejnou edge funkci `log-qr` (service role), tabulka nemá veřejné policy. Frontend je jen web (`/s/<code>` v `~/pumplo`, Vercel push main).

**Tech Stack:** React + TS + Vite, i18n (`src/i18n/locales/{cs,en}.ts`), Supabase Postgres + Deno edge funkce, vitest, deno test, puppeteer-core (E2E jako v pumplo-web).

**Spec:** `docs/superpowers/specs/2026-10-05-qr-email-capture-design.md` (revize 2)

## Global Constraints

- Žádné odesílání e-mailů, žádný Resend, žádný `unsubscribe` endpoint ve fázi 1.
- Neměnit `handle_new_user`, `user_profiles`, `Auth.tsx`, `Settings.tsx`.
- Okno se zobrazí 6 s (`LEAD_PROMPT_DELAY_MS = 6000`) po načtení stránky s videi.
- Zavření × nebo klik do ztmavení → znovu nejdřív za 7 dní (`LEAD_DISMISS_DAYS = 7`).
- Po odeslání: „Hotovo, jsi přihlášený ✅“, po 3 s (`LEAD_THANKS_MS = 3000`) okno odjede dolů (300 ms) a zmizí; na zařízení už nikdy (localStorage `pumplo_lead_prompt` + cookie `pumplo_lead=1; Max-Age=34560000; Path=/; SameSite=Lax`).
- Neukazovat: přihlášený uživatel (Supabase session), `Capacitor.isNativePlatform()`, stránka bez videí/chyba.
- Text souhlasu CS přesně: „Odesláním souhlasíš se zasíláním tipů a novinek od Pumpla. Odhlásit se můžeš kdykoli.“ + odkaz „Podmínky“ na `/privacy#email`; 10.5px, `rgba(255,255,255,.55)`.
- Nadpis CS „Tréninkové tipy z {gym} do mailu 💪“, tlačítko „Odebírat“; EN „Training tips from {gym} by e-mail 💪“, „Subscribe“, souhlas „By sending you agree to receive tips and news from Pumplo. You can unsubscribe anytime.“ + „Terms“.
- `CONSENT_TEXT_VERSION = "qr-lead-2026-10-05"`.
- Odpověď serveru `{ ok: true }` u platného požadavku (i duplicita, i bot) — neprozrazovat, kdo je v DB.
- Rate limit: max 20 nových adres na `ip_hash` za hodinu (Wi-Fi posilovny sdílí IP).

## Review Focus

1. E-mail s velkými písmeny/mezerami → uloží se normalizovaně; druhé odeslání stejné adresy nevytvoří duplicitu (test: Task 2 Step 8).
2. Blokovaný localStorage (Safari private) → okno funguje, stránka nespadne; po odeslání ho zablokuje cookie (test: Task 3 Step 1 „cookie alone blocks“, Task 5 bod 6).
3. Vyjede klávesnice → okno nesmí zmizet pod ni (pozice `min(titleTop, vh − 200)`, přepočet na `visualViewport.resize`) (test: Task 5 bod 2 s viewportem 390×500).
4. Síť selže při odeslání → okno zůstane, hláška „Nepodařilo se, zkus to znovu“, tlačítko znovu aktivní (test: Task 5 bod 7).
5. Název cviku v DOM chybí → záložní pozice `bottom: 176px` (test: Task 5 bod 8).

---

### Task 1: Migrace `qr_leads` + nové typy událostí

**Files:**
- Create: `supabase/migrations/20261005120000_qr_leads.sql`
- Create: `scripts/verify/qr-leads-schema.mjs`

**Interfaces:**
- Produces: tabulka `public.qr_leads(id, email, email_normalized generated, scan_id, source_type, code, gym_id, machine_id, platform, lang, ip_hash, consent_text, consent_text_version, consent_at, unsubscribed_at, user_id, created_at, updated_at)`; `qr_events.event_type` navíc `'lead_prompt_shown' | 'lead_prompt_dismissed' | 'lead_submitted'`.

- [ ] **Step 1: Ověřovací skript (zatím selže)**

```js
// scripts/verify/qr-leads-schema.mjs — read-only check via Supabase Management API.
// Prints QR_LEADS_SCHEMA_OK only when table, RLS, unique index and event types exist.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
const PAT = readFileSync(`${homedir()}/.supabase-pat`, "utf8").trim();
const q = async (query) => {
  const r = await fetch("https://api.supabase.com/v1/projects/udqwjqgdsjobdufdxbpn/database/query", {
    method: "POST", headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return r.json();
};
const fail = (m) => { console.error("FAIL:", m); process.exit(1); };
const cols = await q("select column_name from information_schema.columns where table_schema='public' and table_name='qr_leads'");
const names = new Set((Array.isArray(cols) ? cols : []).map((c) => c.column_name));
for (const c of ["email", "email_normalized", "gym_id", "machine_id", "code", "scan_id", "consent_text", "consent_text_version", "consent_at", "ip_hash", "lang", "unsubscribed_at"])
  if (!names.has(c)) fail("missing column " + c);
const rls = await q("select relrowsecurity from pg_class where oid='public.qr_leads'::regclass");
if (!rls?.[0]?.relrowsecurity) fail("RLS off");
const pol = await q("select polname, polroles::regrole[]::text as roles from pg_policy where polrelid='public.qr_leads'::regclass");
if ((Array.isArray(pol) ? pol : []).some((p) => /anon|public/.test(p.roles))) fail("public/anon policy present");
const uq = await q("select indexdef from pg_indexes where tablename='qr_leads' and indexdef ilike '%unique%email_normalized%'");
if (!uq?.length) fail("no unique email_normalized index");
const ck = await q("select pg_get_constraintdef(oid) d from pg_constraint where conname='qr_events_event_type_check'");
for (const t of ["lead_prompt_shown", "lead_prompt_dismissed", "lead_submitted", "scan", "store_click", "first_open", "signup"])
  if (!String(ck?.[0]?.d).includes(t)) fail("event type missing " + t);
console.log("QR_LEADS_SCHEMA_OK");
```

- [ ] **Step 2: Spustit — musí selhat:** `node scripts/verify/qr-leads-schema.mjs` → `FAIL: missing column email`

- [ ] **Step 3: Migrace**

```sql
-- Sběr e-mailu na stránce stroje (app.pumplo.com/s/<code>), fáze 1: jen ukládání.
-- Souhlas = odeslání formuláře s viditelným textem souhlasu (consent_text).
-- Zapisuje jen edge funkce log-qr (service role); anon/člen tabulku nečte.
CREATE TABLE IF NOT EXISTS public.qr_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (length(email) BETWEEN 6 AND 254),
  email_normalized text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  scan_id uuid REFERENCES public.qr_events(id) ON DELETE SET NULL,
  source_type text NOT NULL DEFAULT 'station' CHECK (source_type IN ('station', 'flyer')),
  code text,
  gym_id uuid REFERENCES public.gyms(id) ON DELETE SET NULL,
  machine_id uuid,
  platform text NOT NULL DEFAULT 'other' CHECK (platform IN ('ios', 'android', 'other')),
  lang text NOT NULL DEFAULT 'cs' CHECK (lang IN ('cs', 'en')),
  ip_hash text,
  consent_text text NOT NULL,
  consent_text_version text NOT NULL,
  consent_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS qr_leads_email_normalized_key ON public.qr_leads (email_normalized);
CREATE INDEX IF NOT EXISTS qr_leads_gym_id_idx ON public.qr_leads (gym_id);
CREATE INDEX IF NOT EXISTS qr_leads_ip_hash_created_idx ON public.qr_leads (ip_hash, created_at);

ALTER TABLE public.qr_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admins_read_qr_leads ON public.qr_leads;
CREATE POLICY admins_read_qr_leads ON public.qr_leads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
REVOKE ALL ON public.qr_leads FROM anon;

ALTER TABLE public.qr_events DROP CONSTRAINT IF EXISTS qr_events_event_type_check;
ALTER TABLE public.qr_events ADD CONSTRAINT qr_events_event_type_check
  CHECK (event_type = ANY (ARRAY['scan', 'store_click', 'first_open', 'signup',
                                 'lead_prompt_shown', 'lead_prompt_dismissed', 'lead_submitted']));
```

- [ ] **Step 4: Aplikovat** přes Management API (stejný `fetch` jako ve skriptu, `query` = obsah souboru) → `[]`
- [ ] **Step 5: Ověřit:** `node scripts/verify/qr-leads-schema.mjs` → `QR_LEADS_SCHEMA_OK`
- [ ] **Step 6: Commit:** `git add supabase/migrations/20261005120000_qr_leads.sql scripts/verify/qr-leads-schema.mjs && git commit -m "feat(qr): tabulka qr_leads a události okna s e-mailem"`

### Task 2: `log-qr` — akce `lead_prompt_shown`, `lead_prompt_dismissed`, `lead`

**Files:**
- Create: `supabase/functions/log-qr/lead.ts`, `supabase/functions/log-qr/lead_test.ts`, `scripts/verify/lead-endpoint.mjs`
- Modify: `supabase/functions/log-qr/index.ts` (POST handler)

**Interfaces:**
- Consumes: `qr_leads`, nové typy `qr_events` (Task 1)
- Produces: `POST {action:'lead_prompt_shown'|'lead_prompt_dismissed', sourceType:'station', code, scanId?, platform}` → `{ok:true}`; `POST {action:'lead', sourceType:'station', code, scanId?, platform, email, lang:'cs'|'en', website:''}` → `{ok:true}` | `400 {error:'bad email'}`

- [ ] **Step 1: Testy**

```ts
// supabase/functions/log-qr/lead_test.ts
import { assertEquals } from "jsr:@std/assert";
import { normalizeEmail, isValidEmail, isBot, consentTextFor, toLang, CONSENT_TEXT_VERSION } from "./lead.ts";

Deno.test("normalize trims and lowercases", () => assertEquals(normalizeEmail("  Ana@Gmail.COM "), "ana@gmail.com"));
Deno.test("normalize non-string", () => assertEquals(normalizeEmail(42), ""));
Deno.test("valid emails", () => { for (const e of ["ana@gmail.com", "a.b+c@seznam.cz", "xy@yz.co"]) assertEquals(isValidEmail(e), true, e); });
Deno.test("invalid emails", () => { for (const e of ["", "ana", "ana@", "ana@gmail", "a na@gmail.com", "a@b.c", "x".repeat(250) + "@gmail.com"]) assertEquals(isValidEmail(e), false, e); });
Deno.test("honeypot", () => { assertEquals(isBot("http://x"), true); assertEquals(isBot(""), false); assertEquals(isBot(undefined), false); });
Deno.test("lang + consent text", () => {
  assertEquals(toLang("en"), "en"); assertEquals(toLang("de"), "cs");
  assertEquals(consentTextFor("cs"), "Odesláním souhlasíš se zasíláním tipů a novinek od Pumpla. Odhlásit se můžeš kdykoli.");
  assertEquals(consentTextFor("en"), "By sending you agree to receive tips and news from Pumplo. You can unsubscribe anytime.");
  assertEquals(CONSENT_TEXT_VERSION, "qr-lead-2026-10-05");
});
```

- [ ] **Step 2: Selže:** `deno test supabase/functions/log-qr/lead_test.ts` → `Module not found`

- [ ] **Step 3: `lead.ts`**

```ts
// Pure helpers for e-mail capture on the machine page (app.pumplo.com/s/<code>).
export const CONSENT_TEXT_VERSION = "qr-lead-2026-10-05";
export const LEAD_RATE_LIMIT_PER_HOUR = 20;

const CONSENT_TEXT = {
  cs: "Odesláním souhlasíš se zasíláním tipů a novinek od Pumpla. Odhlásit se můžeš kdykoli.",
  en: "By sending you agree to receive tips and news from Pumplo. You can unsubscribe anytime.",
} as const;

export type LeadLang = keyof typeof CONSENT_TEXT;
export const toLang = (v: unknown): LeadLang => (v === "en" ? "en" : "cs");
export const consentTextFor = (lang: LeadLang): string => CONSENT_TEXT[lang];

export const normalizeEmail = (raw: unknown): string =>
  typeof raw === "string" ? raw.trim().toLowerCase() : "";

// One @, a dot in the domain, no spaces, TLD ≥ 2 chars, sane length.
export const isValidEmail = (email: string): boolean =>
  email.length >= 6 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

// A filled honeypot field means a bot; such requests get a fake success.
export const isBot = (honeypot: unknown): boolean =>
  typeof honeypot === "string" && honeypot.trim().length > 0;
```

- [ ] **Step 4: Projde:** `deno test supabase/functions/log-qr/lead_test.ts` → `6 passed`

- [ ] **Step 5: `index.ts`.** Import nahoře:

```ts
import { CONSENT_TEXT_VERSION, LEAD_RATE_LIMIT_PER_HOUR, consentTextFor, isBot, isValidEmail, normalizeEmail, toLang } from "./lead.ts";
```

Nahradit řádky s parsováním těla a whitelistem akcí:

```ts
    const body = await req.json();
    const { action, sourceType, code, scanId, platform } = body;
    if (!["scan", "store_click", "lead_prompt_shown", "lead_prompt_dismissed", "lead"].includes(action)) return json({ error: "bad action" }, 400);
```

Za blok `if (action === "scan") { … }` vložit:

```ts
    if (action === "lead_prompt_shown" || action === "lead_prompt_dismissed") {
      await supabase.from("qr_events").insert({
        event_type: action, source_type: sourceType, code, gym_id: gymId, machine_id: machineId,
        scan_id: scanId ?? null, platform: plat, ip_hash: ipHash, ua_hash: uaHash,
      });
      return json({ ok: true });
    }

    if (action === "lead") {
      if (isBot(body.website)) return json({ ok: true });
      const email = normalizeEmail(body.email);
      if (!isValidEmail(email)) return json({ error: "bad email" }, 400);
      const lang = toLang(body.lang);

      const { data: existing } = await supabase.from("qr_leads").select("id, unsubscribed_at").eq("email_normalized", email).maybeSingle();
      if (!existing && ipHash) {
        const since = new Date(Date.now() - 3_600_000).toISOString();
        const { count } = await supabase.from("qr_leads").select("id", { count: "exact", head: true })
          .eq("ip_hash", ipHash).gte("created_at", since);
        if ((count ?? 0) >= LEAD_RATE_LIMIT_PER_HOUR) return json({ ok: true });
      }

      const now = new Date().toISOString();
      const context = { scan_id: scanId ?? null, source_type: sourceType, code, gym_id: gymId, machine_id: machineId, platform: plat, lang, ip_hash: ipHash, updated_at: now };
      const consent = { consent_text: consentTextFor(lang), consent_text_version: CONSENT_TEXT_VERSION, consent_at: now, unsubscribed_at: null };
      // Re-sending after an unsubscribe is a new consent; otherwise only the context moves.
      const { error: leadErr } = existing
        ? await supabase.from("qr_leads").update({ ...context, ...(existing.unsubscribed_at ? consent : {}) }).eq("id", existing.id)
        : await supabase.from("qr_leads").insert({ email, ...context, ...consent });
      if (leadErr) return json({ error: leadErr.message }, 500);

      await supabase.from("qr_events").insert({
        event_type: "lead_submitted", source_type: sourceType, code, gym_id: gymId, machine_id: machineId,
        scan_id: scanId ?? null, platform: plat, ip_hash: ipHash, ua_hash: uaHash,
      });
      return json({ ok: true });
    }
```

- [ ] **Step 6:** `deno check supabase/functions/log-qr/index.ts` → bez chyb
- [ ] **Step 7: Nasadit:** `npx supabase functions deploy log-qr --project-ref udqwjqgdsjobdufdxbpn --no-verify-jwt`
- [ ] **Step 8: Živé ověření** `scripts/verify/lead-endpoint.mjs`:

```js
// POSTs to live log-qr; checks scan still works, lead row, dedupe, bad email, honeypot; cleans up. Prints LEAD_ENDPOINT_OK.
import { readFileSync } from "node:fs"; import { homedir } from "node:os";
const PAT = readFileSync(`${homedir()}/.supabase-pat`, "utf8").trim();
const FN = "https://udqwjqgdsjobdufdxbpn.supabase.co/functions/v1/log-qr";
const q = async (query) => (await fetch("https://api.supabase.com/v1/projects/udqwjqgdsjobdufdxbpn/database/query", { method: "POST", headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }) })).json();
const post = async (b) => { const r = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const fail = (m) => { console.error("FAIL:", m); process.exit(1); };
const E = `qa+lead-${Date.now()}@pumplo.com`;
const base = { action: "lead", sourceType: "station", code: "fk797g7Z", platform: "ios", lang: "cs", website: "" };
try {
  let r = await post({ action: "scan", sourceType: "station", code: "fk797g7Z", platform: "ios" }); if (!r.j.scanId) fail("scan broke " + JSON.stringify(r));
  r = await post({ ...base, email: "  " + E.toUpperCase() + " " }); if (r.s !== 200 || !r.j.ok) fail("lead post " + JSON.stringify(r));
  r = await post({ ...base, email: E }); if (r.s !== 200) fail("dup post");
  const rows = await q(`select gym_id, machine_id, consent_text_version from qr_leads where email_normalized='${E}'`);
  if (rows.length !== 1) fail("expected 1 row, got " + rows.length);
  if (!rows[0].gym_id || !rows[0].machine_id) fail("gym/machine not resolved");
  if (rows[0].consent_text_version !== "qr-lead-2026-10-05") fail("consent version");
  r = await post({ ...base, email: "nope" }); if (r.s !== 400) fail("bad email not rejected");
  const bot = `qa+bot-${Date.now()}@pumplo.com`;
  r = await post({ ...base, email: bot, website: "x" }); if (!r.j.ok) fail("bot not fake-ok");
  if ((await q(`select 1 from qr_leads where email_normalized='${bot}'`)).length) fail("bot row stored");
  r = await post({ action: "lead_prompt_shown", sourceType: "station", code: "fk797g7Z", platform: "ios" }); if (!r.j.ok) fail("prompt_shown");
  console.log("LEAD_ENDPOINT_OK");
} finally {
  await q(`delete from qr_leads where email_normalized like 'qa+%@pumplo.com'`);
}
```

Run: `node scripts/verify/lead-endpoint.mjs` → `LEAD_ENDPOINT_OK` (testovací `scan`/`lead_*` události v `qr_events` mají kód fk797g7Z a ip_hash Davidova Macu; smazat je v `finally` dotazem `delete from qr_events where code='fk797g7Z' and created_at > now() - interval '10 minutes' and ip_hash = (…ip_hash testovacího leadu…)` — ip_hash si skript přečte z řádku leadu před smazáním).

- [ ] **Step 9: Commit:** `git add supabase/functions/log-qr scripts/verify/lead-endpoint.mjs && git commit -m "feat(qr): log-qr ukládá e-mail z okna na stránce stroje"`

### Task 3: Frontend — logika zobrazení, okno, napojení

**Files:**
- Create: `src/lib/leadCapture.ts`, `src/lib/leadCapture.test.ts`, `src/components/station/StationLeadPopup.tsx`
- Modify: `src/lib/qrTracking.ts` (přidat `getLastScanId`, `logLeadPromptEvent`, `submitLead`), `src/pages/StationPage.tsx` (render okna), `src/components/station/StationVideoPlayer.tsx:239` (`data-station-title`), `src/i18n/locales/cs.ts`, `src/i18n/locales/en.ts`

**Interfaces:**
- Consumes: `log-qr` akce (Task 2)
- Produces: `shouldAutoShowLeadPrompt(raw: string|null, cookie: string, now: number): boolean`; `leadPromptRecord(state, now): string`; `writeLeadPromptState(state: 'dismissed'|'submitted'): void`; `readLeadPromptState(): string|null`; `isValidLeadEmail(raw: string): boolean`; konstanty `LEAD_PROMPT_DELAY_MS=6000`, `LEAD_DISMISS_DAYS=7`, `LEAD_THANKS_MS=3000`; `submitLead(code, email, lang:'cs'|'en', website): Promise<'ok'|'bad_email'|'error'>`; `logLeadPromptEvent(code, action:'lead_prompt_shown'|'lead_prompt_dismissed'): void`

- [ ] **Step 1: Testy `src/lib/leadCapture.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { shouldAutoShowLeadPrompt, leadPromptRecord, isValidLeadEmail, LEAD_DISMISS_DAYS } from './leadCapture';
const NOW = 1_800_000_000_000; const DAY = 86_400_000;
describe('shouldAutoShowLeadPrompt', () => {
  it('shows when nothing stored', () => expect(shouldAutoShowLeadPrompt(null, '', NOW)).toBe(true));
  it('never after submit', () => expect(shouldAutoShowLeadPrompt(leadPromptRecord('submitted', NOW - 400 * DAY), '', NOW)).toBe(false));
  it('cookie alone blocks (localStorage wiped)', () => expect(shouldAutoShowLeadPrompt(null, 'a=1; pumplo_lead=1', NOW)).toBe(false));
  it('hidden within 7 days of dismiss', () => expect(shouldAutoShowLeadPrompt(leadPromptRecord('dismissed', NOW - 6 * DAY), '', NOW)).toBe(false));
  it('back after 7 days', () => expect(shouldAutoShowLeadPrompt(leadPromptRecord('dismissed', NOW - (LEAD_DISMISS_DAYS * DAY + 1)), '', NOW)).toBe(true));
  it('corrupt storage counts as nothing', () => expect(shouldAutoShowLeadPrompt('{oops', '', NOW)).toBe(true));
});
describe('isValidLeadEmail', () => {
  it('accepts', () => ['ana@gmail.com', ' Ana@Seznam.CZ '].forEach((e) => expect(isValidLeadEmail(e)).toBe(true)));
  it('rejects', () => ['', 'ana', 'ana@gmail', 'a na@x.cz'].forEach((e) => expect(isValidLeadEmail(e)).toBe(false)));
});
```

- [ ] **Step 2: Selže:** `npx vitest run src/lib/leadCapture.test.ts` → `Failed to resolve import "./leadCapture"`

- [ ] **Step 3: `src/lib/leadCapture.ts`**

```ts
// When the e-mail prompt on the machine page (/s/<code>) may appear.
// Once sent: never again on this device (localStorage + long cookie, either one blocks).
export const LEAD_PROMPT_DELAY_MS = 6_000;
export const LEAD_DISMISS_DAYS = 7;
export const LEAD_THANKS_MS = 3_000;
export const LEAD_STORAGE_KEY = 'pumplo_lead_prompt';
const LEAD_COOKIE = 'pumplo_lead=1';

type Stored = { state: 'dismissed' | 'submitted'; at: number };
const parse = (raw: string | null): Stored | null => {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if ((v?.state === 'dismissed' || v?.state === 'submitted') && typeof v.at === 'number') return v;
  } catch { /* corrupted value counts as nothing stored */ }
  return null;
};

export const shouldAutoShowLeadPrompt = (raw: string | null, cookie: string, now: number): boolean => {
  if (cookie.split(';').some((c) => c.trim() === LEAD_COOKIE)) return false;
  const stored = parse(raw);
  if (!stored) return true;
  if (stored.state === 'submitted') return false;
  return now - stored.at > LEAD_DISMISS_DAYS * 86_400_000;
};

export const leadPromptRecord = (state: Stored['state'], now: number): string => JSON.stringify({ state, at: now });

export const isValidLeadEmail = (raw: string): boolean => {
  const email = raw.trim().toLowerCase();
  return email.length >= 6 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
};

export const readLeadPromptState = (): string | null => {
  try { return window.localStorage.getItem(LEAD_STORAGE_KEY); } catch { return null; }
};

export const writeLeadPromptState = (state: Stored['state']): void => {
  try { window.localStorage.setItem(LEAD_STORAGE_KEY, leadPromptRecord(state, Date.now())); } catch { /* private mode */ }
  if (state === 'submitted') {
    try { document.cookie = `${LEAD_COOKIE}; Max-Age=34560000; Path=/; SameSite=Lax`; } catch { /* blocked */ }
  }
};
```

- [ ] **Step 4: Projde:** `npx vitest run src/lib/leadCapture.test.ts` → `8 passed`

- [ ] **Step 5: `qrTracking.ts` — přidat na konec**

```ts
export const getLastScanId = (code: string): string | null => (lastScan && lastScan.code === code ? lastScan.scanId : null);

export const logLeadPromptEvent = (code: string, action: 'lead_prompt_shown' | 'lead_prompt_dismissed'): void => {
  try {
    fetch(FN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ action, sourceType: 'station', code, scanId: getLastScanId(code), platform: detectPlatform() }),
    }).catch(() => {});
  } catch { /* noop */ }
};

export const submitLead = async (code: string, email: string, lang: 'cs' | 'en', website: string): Promise<'ok' | 'bad_email' | 'error'> => {
  try {
    const res = await fetch(FN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lead', sourceType: 'station', code, scanId: getLastScanId(code), platform: detectPlatform(), email, lang, website }),
    });
    if (res.status === 400) return 'bad_email';
    return res.ok ? 'ok' : 'error';
  } catch { return 'error'; }
};
```

- [ ] **Step 6: i18n** — cs.ts za `'station.title_suffix'`:

```ts
  'station.lead_title': 'Tréninkové tipy z {{gym}} do mailu 💪',
  'station.lead_placeholder': 'tvuj@email.cz',
  'station.lead_submit': 'Odebírat',
  'station.lead_consent': 'Odesláním souhlasíš se zasíláním tipů a novinek od Pumpla. Odhlásit se můžeš kdykoli.',
  'station.lead_terms': 'Podmínky',
  'station.lead_thanks': 'Hotovo, jsi přihlášený ✅',
  'station.lead_bad_email': 'Zkontroluj e-mail',
  'station.lead_error': 'Nepodařilo se, zkus to znovu',
  'station.lead_close': 'Zavřít',
```

en.ts za `'station.title_suffix'`:

```ts
  'station.lead_title': 'Training tips from {{gym}} by e-mail 💪',
  'station.lead_placeholder': 'your@email.com',
  'station.lead_submit': 'Subscribe',
  'station.lead_consent': 'By sending you agree to receive tips and news from Pumplo. You can unsubscribe anytime.',
  'station.lead_terms': 'Terms',
  'station.lead_thanks': "Done, you're subscribed ✅",
  'station.lead_bad_email': 'Check your e-mail',
  'station.lead_error': 'Something went wrong, try again',
  'station.lead_close': 'Close',
```

- [ ] **Step 7:** `StationVideoPlayer.tsx:239` → `<p data-station-title className="font-bold text-xl leading-tight" …>`

- [ ] **Step 8: `src/components/station/StationLeadPopup.tsx`**

```tsx
import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import i18n from '@/i18n';
import {
  LEAD_PROMPT_DELAY_MS, LEAD_THANKS_MS, isValidLeadEmail, readLeadPromptState,
  shouldAutoShowLeadPrompt, writeLeadPromptState,
} from '@/lib/leadCapture';
import { logLeadPromptEvent, submitLead } from '@/lib/qrTracking';

type Phase = 'hidden' | 'form' | 'sending' | 'thanks' | 'leaving';

/** Small subscribe card over the exercise title; dims the page until closed or sent. */
export const StationLeadPopup = ({ code, gymName }: { code: string; gymName: string }) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('hidden');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled || !shouldAutoShowLeadPrompt(readLeadPromptState(), document.cookie, Date.now())) return;
      const { data } = await supabase.auth.getSession();
      if (cancelled || data.session) return;
      setPhase('form');
      logLeadPromptEvent(code, 'lead_prompt_shown');
    }, LEAD_PROMPT_DELAY_MS);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [code]);

  // Align the card's top edge with the exercise title; keep it above the keyboard.
  useLayoutEffect(() => {
    if (phase === 'hidden') return;
    const place = () => {
      const el = document.querySelector('[data-station-title]');
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const titleTop = el ? el.getBoundingClientRect().top - 6 : null;
      setTop(titleTop === null ? null : Math.max(72, Math.min(titleTop, vh - 200)));
    };
    place();
    window.visualViewport?.addEventListener('resize', place);
    window.addEventListener('resize', place);
    return () => { window.visualViewport?.removeEventListener('resize', place); window.removeEventListener('resize', place); };
  }, [phase]);

  if (phase === 'hidden') return null;

  const close = () => {
    if (phase !== 'form') return;
    writeLeadPromptState('dismissed');
    logLeadPromptEvent(code, 'lead_prompt_dismissed');
    setPhase('hidden');
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidLeadEmail(email)) { setMessage(t('station.lead_bad_email')); return; }
    setMessage(null);
    setPhase('sending');
    const lang = i18n.language?.startsWith('en') ? 'en' : 'cs';
    const result = await submitLead(code, email.trim(), lang, website);
    if (result === 'bad_email') { setMessage(t('station.lead_bad_email')); setPhase('form'); return; }
    if (result === 'error') { setMessage(t('station.lead_error')); setPhase('form'); return; }
    writeLeadPromptState('submitted');
    setPhase('thanks');
    window.setTimeout(() => setPhase('leaving'), LEAD_THANKS_MS);
    window.setTimeout(() => setPhase('hidden'), LEAD_THANKS_MS + 300);
  };

  const dimmed = phase === 'form' || phase === 'sending';
  const pos = top === null ? { bottom: 176 } : { top };

  return (
    <>
      {dimmed && <div data-lead-dim onClick={close} className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,.6)' }} />}
      <div
        data-lead-popup={phase}
        role="dialog"
        aria-label={t('station.lead_title', { gym: gymName })}
        className="fixed left-4 right-4 z-[61] rounded-[18px] text-white"
        style={{
          ...pos,
          background: 'rgba(11,18,34,.94)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(76,201,255,.3)', boxShadow: '0 14px 40px rgba(0,0,0,.5)',
          padding: '12px 12px 10px 14px',
          transition: 'transform 300ms ease-in, opacity 300ms ease-in',
          transform: phase === 'leaving' ? 'translateY(120%)' : 'none',
          opacity: phase === 'leaving' ? 0 : 1,
        }}
      >
        {phase === 'thanks' || phase === 'leaving' ? (
          <p className="text-[15px] font-extrabold">{t('station.lead_thanks')}</p>
        ) : (
          <form onSubmit={send} noValidate>
            <button type="button" data-lead-close aria-label={t('station.lead_close')} onClick={close}
              className="absolute top-2 right-2 w-[26px] h-[26px] rounded-full text-[15px] leading-[26px]"
              style={{ background: 'rgba(255,255,255,.12)' }}>×</button>
            <p className="text-[15px] font-extrabold leading-tight mr-8 mb-2">{t('station.lead_title', { gym: gymName })}</p>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website}
              onChange={(e) => setWebsite(e.target.value)} className="hidden" aria-hidden="true" />
            <div className="flex gap-1.5">
              <input type="email" inputMode="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder={t('station.lead_placeholder')}
                className="flex-1 min-w-0 h-10 rounded-[11px] px-3 text-base text-white placeholder:text-white/40"
                style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.2)' }} />
              <button type="submit" disabled={phase === 'sending'} data-lead-submit
                className="h-10 px-3.5 rounded-[11px] font-extrabold text-sm disabled:opacity-60"
                style={{ background: '#4CC9FF', color: '#0B1222' }}>{t('station.lead_submit')}</button>
            </div>
            {message && <p data-lead-message className="text-xs mt-1.5" style={{ color: '#FF8A8A' }}>{message}</p>}
            <p className="mt-1.5 leading-snug" style={{ fontSize: '10.5px', color: 'rgba(255,255,255,.55)' }}>
              {t('station.lead_consent')}{' '}
              <a href="/privacy#email" target="_blank" rel="noopener noreferrer" className="underline">{t('station.lead_terms')}</a>
            </p>
          </form>
        )}
      </div>
    </>
  );
};
```

- [ ] **Step 9: `StationPage.tsx`** — `import { StationLeadPopup } from '@/components/station/StationLeadPopup';` a v hlavním returnu (stránka s videi) za `<StationCTA />`: `{code && <StationLeadPopup code={code} gymName={data.gymName} />}`
- [ ] **Step 10:** `node scripts/ci/typecheck-baseline.mjs && npx vitest run` → žádné nové chyby, testy zelené
- [ ] **Step 11: Commit:** `git add src && git commit -m "feat(qr): okno s e-mailem na stránce stroje (6 s, ztmavení, jednou na zařízení)"`

### Task 4: Zásady — sekce `#email`

**Files:** Modify: `src/pages/Privacy.tsx` (app); `~/pumplo-web/src/pages/Privacy.tsx` (web, samostatný commit v repu pumplo-web, nasazení `npx vercel --prod --yes`)

- [ ] **Step 1:** Do obou (CS i EN) přidat odstavec s `id="email"`:
  CS: „**E-maily z QR stránek strojů.** Když na stránce stroje (app.pumplo.com/s/…) zadáš e-mail a klikneš na Odebírat, souhlasíš se zasíláním tréninkových tipů a novinek od Pumpla. Uložíme e-mail, posilovnu a stroj, ze kterého ses přihlásil, jazyk, typ zařízení, čas a přesné znění souhlasu (a anonymizovaný otisk IP adresy jako důkaz). Údaje držíme do odhlášení, nejdéle 3 roky od posledního kontaktu. Odhlásit se můžeš kdykoli odkazem v každém e-mailu nebo na info.pumplo@gmail.com. Správce: GynTools CZ s.r.o., IČ 27804461.“
  EN: „**E-mails from machine QR pages.** When you enter your e-mail on a machine page (app.pumplo.com/s/…) and tap Subscribe, you agree to receive training tips and news from Pumplo. We store the e-mail, the gym and machine you subscribed from, language, device type, time and the exact consent wording (plus a hashed IP fingerprint as evidence). We keep it until you unsubscribe, at most 3 years after last contact. Unsubscribe anytime via the link in every e-mail or at info.pumplo@gmail.com. Controller: GynTools CZ s.r.o., Reg. No. 27804461.“
- [ ] **Step 2:** `grep -c 'id="email"' src/pages/Privacy.tsx` → `1` v obou repech
- [ ] **Step 3:** Commit v obou repech: `docs(privacy): e-maily z QR stránek strojů`

### Task 5: E2E v prohlížeči (lokální build, `log-qr` zachycený)

**Files:** Create: `scripts/verify/lead-popup-e2e.mjs`

- [ ] **Step 1:** Skript spustí proti `BASE` (výchozí `http://localhost:4173`, `vite preview`) puppeteer-core s Chrome, viewport 390×844, iPhone UA, `setRequestInterception`: `functions/v1/log-qr` odpoví lokálně (`scan` → `{scanId:'00000000-0000-0000-0000-000000000000', appStoreUrl:'', playStoreUrl:''}`, ostatní → `{ok:true}`; v testu 7 `lead` → status 500), nic nejde do produkce. Ověří:
  1. před 5 s `[data-lead-popup]` neexistuje; po 7 s existuje i `[data-lead-dim]`;
  2. `|popup.top − title.top| ≤ 12 px`; s viewportem 390×500 je spodní hrana okna ≤ 500;
  3. zachycený POST `lead_prompt_shown`;
  4. `[data-lead-close]` → okno pryč, POST `lead_prompt_dismissed`; reload + 7 s → okno se neukáže;
  5. nový kontext: `nope` → `[data-lead-message]`; `qa@pumplo.com` + `[data-lead-submit]` → POST `action:'lead'` s `email`, `lang`, `website:''`; `[data-lead-popup="thanks"]`; do 3,6 s okno pryč;
  6. reload s vymazaným localStorage (cookie zůstává) + 7 s → okno se neukáže;
  7. nový kontext, `lead` → 500 → `[data-lead-message]` s chybou, okno zůstane, tlačítko aktivní;
  8. nový kontext, před 6 s odstranit `[data-station-title]` z DOM → okno se ukáže s `style.bottom === '176px'`.
  Tiskne `LEAD_POPUP_E2E_OK`.
- [ ] **Step 2:** `npm run build && (npx vite preview --port 4173 &) && node scripts/verify/lead-popup-e2e.mjs` → `LEAD_POPUP_E2E_OK`
- [ ] **Step 3:** Screenshoty formuláře a poděkování pro Davida.
- [ ] **Step 4:** Commit skriptu.

### Task 6: Nasazení a živé ověření

- [ ] **Step 1:** David schválí screenshoty.
- [ ] **Step 2:** `git push -u origin feat/qr-email-capture-v2 && gh pr create --base main` (popis česky), po zelené CI merge → Vercel nasadí app.pumplo.com.
- [ ] **Step 3:** `node scripts/verify/lead-popup-e2e.mjs https://app.pumplo.com` → `LEAD_POPUP_E2E_OK`; jeden skutečný lead `qa+live@pumplo.com` přes živou stránku → řádek v `qr_leads` s gym_id Eurogymu → smazat.
- [ ] **Step 4:** Zápis do vaultu (`strategie/2026-10-05 QR sběr e-mailů — rozhodnutí a spec (fáze 1).md`).
