# QR stránka stroje — sběr e-mailů pro remarketing (fáze 1)

Datum: 2026-10-05 · Autor: Claude s Davidem · Stav: návrh ke schválení (revize 2: jen sběr, bez e-mailů)
Navazuje na: 2026-04-08-qr-station-system-design.md, 2026-07-19-qr-scan-analytics-design.md

## Cíl

Z anonymního skenu QR samolepky na stroji (`app.pumplo.com/s/<code>`) udělat adresovatelný kontakt s vazbou na posilovnu a stroj, aby šlo posílat remarketingové e-maily. Dnes: 254 skenů / 165 zařízení za 30 dní, 0 kontaktů. Úspěch = ≥ 15 % zařízení, která okno uvidí, zadá e-mail.

## Co David chtěl (rozhodnuto 5. 10. 2026)

- Okno uvidí každý, kdo naskenuje stroj a ještě e-mail nezadal (i u jiného stroje).
- Malé okno zarovnané s názvem cviku, zbytek obrazovky ztmavený, dokud ho člověk nezavře (×) nebo nezadá e-mail.
- Jedno pole + tlačítko „Odebírat“. Bez zaškrtávátka, bez potvrzovacího e-mailu.
- Po odeslání krátké poděkování, po 3 s okno odjede dolů a zmizí.
- Souhlas = odeslání formuláře. Text souhlasu malý, šedý, ale čitelný přímo pod polem + odkaz „Podmínky“. Nadpis i tlačítko jasně říkají, že jde o odběr e-mailů — proto je souhlas platný (schovaný souhlas by platný nebyl).

## Mimo rozsah fáze 1 (David 5. 10. 2026: „zatím jen sbírat“)

- Žádné odesílání e-mailů (ani uvítací), žádná funkce `unsubscribe`, žádný Resend. Přidá se ve fázi 2 spolu s remarketingovou sekvencí (M1+ z poznámky vaultu 2026-10-01 Retargeting) — PŘED prvním odeslaným e-mailem musí existovat odhlášení jedním klikem.
- Fáze 1 končí uloženým kontaktem a poděkováním v okně.

## UX

1. Otevře se stránka stroje, běží video. Po **6 s** se zobrazí okno (pokud platí podmínky níže). Fade-in, ztmavení `rgba(0,0,0,.6)` přes celou obrazovku.
2. Okno: `left/right 16px`, horní hrana zarovnaná s horní hranou názvu cviku. Obsah: nadpis „Tréninkové tipy z {posilovna} do mailu 💪“, pole e-mail (`type=email`, `autocomplete=email`, `inputmode=email`, 16px kvůli iOS zoomu), tlačítko „Odebírat“, pod tím 10,5px `rgba(255,255,255,.55)`: „Odesláním souhlasíš se zasíláním tipů a novinek od Pumpla. Odhlásit se můžeš kdykoli. Podmínky“ (odkaz na `/privacy#email`).
3. × nebo klik na ztmavení = zavřít. Uloží `pumplo_lead_dismissed_at` do localStorage; znovu nejdřív za 7 dní.
4. Odeslání: validace formátu → POST na edge funkci → stav „Hotovo, jsi přihlášený ✅“ → po 3 s `translateY(120%)` + fade 300 ms → odebrat. Uloží `pumplo_lead_email_sent=1` (localStorage) a cookie `pumplo_lead=1` (Max-Age 400 dní, SameSite=Lax) → na tomhle zařízení a prohlížeči se okno už nikdy neukáže, u žádného stroje. Pozn.: Safari (ITP) maže úložiště webu, který člověk 7 dní neotevřel; kdo skenuje jednou za čas, může okno vidět znovu. Opětovné zadání stejného e-mailu nevytvoří duplicitu (upsert), takže to nevadí.
5. Chyba sítě: text „Nepodařilo se, zkus to znovu“ v okně, okno zůstane.
6. CZ/EN podle jazyka stránky (i18n `station.lead_*`).

### Kdy se okno neukáže

- přihlášený uživatel appky (Supabase session existuje),
- `pumplo_lead_email_sent` v localStorage,
- zavřeno před < 7 dny,
- stránka bez videí (stav „no videos“) nebo chyba / nenalezený kód,
- uvnitř nativní appky (Capacitor) — stránka je pro prohlížeč.

## Data

Nová tabulka `public.marketing_leads`:

| sloupec | typ | poznámka |
|---|---|---|
| id | uuid pk default gen_random_uuid() | |
| email | text not null unique | uloženo `lower(trim())` |
| source | text not null default 'qr_station' | připraveno pro další zdroje (leták, web) |
| gym_id | uuid null → gyms(id) | z QR kódu |
| machine_id | uuid null | z QR kódu (stejně jako qr_events.machine_id) |
| qr_code | text null | kód samolepky |
| scan_id | uuid null | qr_events.id skenu, ze kterého přišel |
| lang | text | 'cs' / 'en' |
| platform | text | ios / android / other |
| consent_text | text not null | přesné znění souhlasu zobrazené v okně |
| consent_version | int not null | 1 |
| consent_at | timestamptz not null default now() | |
| ip_hash | text | stejný hash jako log-qr (důkaz souhlasu bez IP v čisté podobě) |
| unsubscribed_at | timestamptz null | |
| user_id | uuid null → auth.users | doplní se, když se později zaregistruje se stejným e-mailem |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | |

- Opakované odeslání téhož e-mailu aktualizuje `gym_id`, `machine_id`, `qr_code`, `scan_id`, `updated_at`. Pokud byl odhlášený, nové odeslání je nový souhlas: `unsubscribed_at = null`, nový `consent_at`.
- RLS zapnuté, žádné veřejné policy. Zápis jen přes edge funkci (service role). Čtení: super_admin.

## Backend

Rozšířit existující edge funkci `log-qr` o `action: 'lead'` (už má CORS, hashování IP a rozlišení kódu → posilovna/stroj):

- vstup `{ action:'lead', code, email, scanId, lang, platform, website }` (`website` = honeypot, musí být prázdný),
- validace e-mailu (tvar + délka ≤ 254); rate limit max 5 leadů z jednoho `ip_hash` za hodinu,
- upsert do `marketing_leads`, zápis `qr_events` s `event_type='lead'` (trychtýř sken → lead),
- odpověď `{ ok: true }` i při duplicitě (neprozrazovat, kdo už v databázi je).

Události okna (`lead_popup_shown`, `lead_popup_dismissed`) jako další `action` v `log-qr` → `qr_events`.

## Právo a zásady

- Doplnit do zásad (`/privacy` v appce i na pumplo.com) sekci „E-maily z QR stránek“ s kotvou `#email`: účel, rozsah (e-mail, posilovna, stroj), doba uchování (do odhlášení, nejdéle 3 roky od posledního kontaktu), odvolání souhlasu.
- Souhlas se ukládá s přesným textem, verzí, časem a `ip_hash`.

## Testování

- Unit: funkce „ukázat okno?“ (session, localStorage, 7 dní).
- E2E (puppeteer, stejný vzor jako pumplo-web): okno po 6 s; × zavře a do 7 dní se neukáže; odeslání → poděkování → po 3 s zmizí; neplatný e-mail = chyba; po odeslání už nikdy.
- Edge funkce: lead uložen; duplicitní e-mail neudělá druhý řádek; rate limit; honeypot.
- Živé ověření po nasazení: lead z testovací adresy → řádek v DB → okno se na tom zařízení už neukáže → testovací řádek smazat.

## Nasazení

- Migrace přes Supabase Management API (PAT), nasazení edge funkce `log-qr`.
- Frontend `~/pumplo` → app.pumplo.com (git push main → Vercel). Repo je teď na větvi `release/1.3.0-b13` — práce v samostatném worktree z `main`, merge až po schválení.
- `/s/<code>` je webová stránka, nativní build appky není potřeba.
