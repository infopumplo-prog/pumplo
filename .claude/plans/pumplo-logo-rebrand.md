# Pumplo Logo Rebrand — Comprehensive Rollout

> Status: APPROVED, READY TO EXECUTE
> Created: 2026-04-11
> Approved direction: **Clean wordmark** — "Pumplo" in Nunito Black, no accents, no icon

## Design decision

**Final logo:** Čistý "Pumplo" wordmark v Nunito 900 (Black), letter-spacing -5, cyan `#4CC9FF`.

Žádná ikona, žádný hex, žádné akcenty. Jen slovo.

**Why:** Prošli jsme 3 rounds logo iterací (refined hex crest, P monogram, dumbbell literal, lightning, stacked plates, pulse ring). Žádný z ikonických přístupů nesedl — vždycky vypadalo buď generické nebo chunky. Čistý typografický přístup (inspirovaný Strava/Future/Freeletics) je nejvyzralejší řešení co:
- Škáluje od favicon po plakát
- Funguje v tisku, digital, merch
- Nezávisí na ikoně kterou by lidi museli interpretovat
- Nestará se o "co ta hexagon znamená" — prostě řekne Pumplo

**Approved master files** (uloženo v `src/assets/`):
- `pumplo-wordmark.svg` — cyan na světlém (primary)
- `pumplo-wordmark-white.svg` — bílé na tmavém
- `pumplo-wordmark-dark.svg` — navy na cyan (reverse)
- `pumplo-app-icon.svg` — 512×512 square s plným wordmarkem uprostřed + rounded square gradient bg

**Design system:**
- Font: Nunito 900 (Google Fonts)
- Primary color: `#4CC9FF` (Pumplo Cyan)
- Secondary: `#0B1222` (Pumplo Navy)
- Dark bg: `#050d1e` → `#0B1628` gradient
- Letter-spacing: -5 at 108px font-size (relative scale)

## Pre-production TODO (před hromadným rolloutem)

- [ ] **Convert wordmark to outline paths** (Illustrator: Type → Create Outlines) aby nebyl závislý na installed Nunito fontě
- [ ] **Generate PNG exports** z outline SVG ve standardních velikostech:
  - [ ] 1024×1024 (master app icon source)
  - [ ] 180×180 (iOS @3x)
  - [ ] 120×120 (iOS @2x)
  - [ ] 512×512 (Android / PWA)
  - [ ] 192×192 (PWA)
  - [ ] 32×32, 16×16 (favicon)
- [ ] **Export favicon.ico** (multi-res: 16, 32, 48)
- [ ] **OG image 1200×630** pro social sharing (wordmark + tagline)
- [ ] **Splash screen PNGs** pro iOS launch

## Rollout checklist — KDE všude nahradit

### 1. Main Pumplo app (`pumplo` repo)
- [ ] `src/assets/pumplo-logo.png` — nahradit nebo deprecated (staré hex logo)
- [ ] `src/pages/Home.tsx` — import + render update
- [ ] `src/pages/Auth.tsx` — import + render update
- [ ] `src/hooks/useTrainingNotifications.ts` — notification icon
- [ ] `public/favicon.ico` — nový favicon
- [ ] `public/apple-touch-icon.png` — nová ikona
- [ ] `public/pwa-192x192.png` — nová PWA ikona
- [ ] `public/pwa-512x512.png` — nová PWA ikona
- [ ] `public/sw.js` — service worker notification icon reference
- [ ] `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` — iOS native app icon
- [ ] `ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json` — verify všechny velikosti
- [ ] `android/app/src/main/res/mipmap-*/ic_launcher.png` — Android launcher ikona (všechny density)
- [ ] `index.html` — `<link rel="icon">`, `<meta property="og:image">`, `<meta name="apple-mobile-web-app-title">`
- [ ] Splash screens (iOS + Android Capacitor config)
- [ ] `capacitor.config.ts` — verify iconPath / splashImage references

### 2. Pumplo Admin (`pumplo-admin` repo)
- [ ] `src/assets/pumplo-logo.png` nebo podobný asset — nahradit
- [ ] Dashboard header logo reference
- [ ] Login/register page logo
- [ ] `public/favicon.ico`
- [ ] `index.html` meta tags + OG image

### 3. Landing Page (pumplo.com v Lovable)
- [ ] Hero logo v header
- [ ] Footer logo
- [ ] OG image
- [ ] Favicon
- [ ] `/client` page branding
- [ ] `/business` page branding
- [ ] Publish na Lovable

### 4. Stripe Dashboard — Business Profile
- [ ] Business logo (Account Settings → Business Details → Logo) — nahradit hex logo novým wordmarkem
- [ ] Brand icon (square) pro checkout
- [ ] Statement descriptor — verify "PUMPLO" konzistence
- [ ] Customer Portal branding (Settings → Billing → Customer Portal → Appearance)
- [ ] Email template header (Settings → Emails → Branding) — pro invoice/receipt PDFs

### 5. Supabase
- [ ] Auth emails — update logo v email templates (Settings → Auth → Email Templates)
- [ ] Password reset email
- [ ] Magic link email
- [ ] Confirmation email

### 6. Third-party branding
- [ ] **Telegram bot** (@Pumplo_admin_bot) — update bot picture via @BotFather /setuserpic
- [ ] **Telegram bot description** — verify konzistence
- [ ] **Facebook page** profile + cover photo
- [ ] **Instagram** profile picture
- [ ] **LinkedIn** company page logo
- [ ] **Google Business Profile** (pro GynTools CZ jako vydavatele Pumpla)
- [ ] **Youtube channel** (pokud budeme mít)
- [ ] **Discord server icon** (pokud vytvoříme community)

### 7. Physical marketing materials (blocked — nejdřív nutná tiskárna)
- [ ] **A5 reception stojánek** — design s wordmarkem nahoře (už máme mockup)
- [ ] **Samolepky 5×5 cm na stroje** — QR s "Pumplo" badge uprostřed (místo starého hex)
- [ ] **Business cards** (David Novotný) — dark + light varianta (mockupy hotové)
- [ ] **Letterhead template** pro smlouvy / contracts
- [ ] **Invoice PDF template** (i když Stripe generuje automaticky, pro custom invoice backup)
- [ ] **Merch** (budoucí): trička, tašky, bidony
- [ ] **Gym branding kit** pro partner posilovny (Eurogym)

### 8. Internal / operations
- [ ] **Email signature** (david@pumplo.com) s novým logem
- [ ] **Contract template** `.claude/plans/` nebo dokumenty
- [ ] **Pitch deck** (Newton Angels funding) — refresh se wordmarkem
- [ ] **Product screenshots** pro App Store / Google Play listing
- [ ] **Press kit** (pokud bude PR push)

### 9. Code-level references
- [ ] Hledat ve všech repos: `grep -ri "pumplo-logo.png"` a nahradit
- [ ] Hledat: `grep -ri "pumplo_logo"` / camelCase variants
- [ ] Hledat: `alt="Pumplo"` image src references
- [ ] Update všech TypeScript importů z `.png` na `.svg`
- [ ] Ověř že Vite/Webpack bundluje SVG správně
- [ ] Ověř React Native / Capacitor SVG support (nebo fallback na PNG)

## Rollout strategy — pořadí

**Fáze 1 — Digital primary (0-2 dny):**
1. Main app favicon + PWA icons + OG image
2. pumplo-admin favicon + hero logo
3. Landing page v Lovable
4. Deploy a verify

**Fáze 2 — Third-party (2-3 dny):**
5. Stripe Dashboard business branding
6. Supabase email templates
7. Telegram bot
8. Social media profiles

**Fáze 3 — Physical / merch (blocked until print partner):**
9. A5 stojánky pro first customer
10. Samolepky s novým QR center
11. Business cards
12. Launch marketing materials

**Fáze 4 — Native app stores (před launch do stores):**
13. iOS AppIcon.appiconset (všechny velikosti)
14. Android mipmap assets
15. Splash screens
16. App Store / Google Play listing assets (screenshots, preview)

## Monitoring

- [ ] Po deployi ověř na `pumplo.com`, `app.pumplo.com`, `pumplo-admin.vercel.app` že se nový logo načítá
- [ ] Zkontroluj OG image na: https://www.opengraph.xyz/url/https%3A%2F%2Fpumplo.com
- [ ] Zkontroluj favicon na: https://realfavicongenerator.net/favicon_checker
- [ ] Lighthouse audit (favicon, manifest, OG)

## Poznámky

- **Neodstraňovat starý logo asset hned** — nejdřív kompletní rollout, pak delete starých PNG/SVG souborů v cleanup commitu
- **Git commit strategy:** Jeden commit per fáze (`chore(brand): update logo across main app`, `chore(brand): update Stripe branding`, ...)
- **Backup current logo:** Před commitem ulož `pumplo-logo.png` do `_legacy/` pro případ že se budeme chtít vrátit
