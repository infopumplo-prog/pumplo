# Pumplo v1.1 — Feedback Backlog (2026-06-08)

Captured from David's training-session notes + 4 screenshots. Big update before store submit.

## A. App bugs / features (member app — this repo)

### 🔴 High priority
- **A1. ✅ NOT A BUG (resolved 2026-06-08).** 5 days → upper/lower (not PPL) is an INTENTIONAL beginner safety cap in `getSplitFromFrequency` (src/lib/trainingGoals.ts:47-49): `userLevel==='beginner' && frequency>=5 → upper_lower`. David is `beginner` with 5 days. David accepted it as correct ("tím pádem je to v pořádku"). No code change. (Possible future UX: surface WHY a beginner with 5 days gets upper/lower, to avoid the same confusion for other users.)
- **A2. ✅ DONE (commit 800252b).** Reliable video autoplay (play on canplay/loadeddata, resume on app return) + next-exercise preview during rest also preloads for slow connections.

### 🟡 Workout UX
- **A3. ✅ DONE (878dfea).** Rest-end local notification when app is backgrounded.
- **A4. ✅ DONE (800252b).** Next-exercise video preview during the between-exercise rest.
- **A5. ✅ ALREADY DONE.** The location gate only triggers on START, so view/regenerate/info already work anywhere; start is on-site-only. Confirmed in B1 commit.

### 🟡 Onboarding / profile
- **A6. ✅ DONE (b952578).** Name required in onboarding demographics (covers OAuth users).
- **A7. ✅ DONE (9e0d5d9).** First gym pick: map quick-preview shows a prominent green "Vybrat tuto posilovnu" CTA (driven by `hasNoGymYet = !profile.selected_gym_id`) instead of just Detail/Navigate; the gym detail select button is green/emphasised. David's ask: replace navigation with green "select" on the very first choice + highlight the detail more.
- **A8. ✅ DONE (f4ebb21).** Native location-denied now guides the user to Settings (Simona's stuck case).

### 🟡 Content / sharing
- **A9. ✅ DONE (33e1be6).** Exercise mistakes/tips now localize consistently with the app language.
- **A10. ✅ DONE (27ba938).** True 9:16 export (no stretch) + share as image file so Instagram is offered.

## B. Team/staff member feature (code + data)
- **B1. ✅ DONE (c742d73).** `user_profiles.is_staff` flag; GymLocationGate bypasses on-site check for staff. David marked is_staff=true for testing. TODO: optional admin UI toggle to mark team members as staff (currently set via DB). Mark the real Pumplo team accounts as staff when known.

### ✅ GYM GATE DECISION (David, 2026-06-08)
- **Normal users:** after selecting a gym, they SEE the workout with the exercises that will be there, CAN regenerate the plan, and CAN view exercise info — all WITHOUT being at the gym. But they **cannot START a workout unless their location is physically inside that gym**.
- **Team/staff members:** a profile flag lets them turn it on / start a workout **anywhere** (location bypass). These are Pumplo staff who validate the app with David.
- So A5 = "view + regenerate + info anywhere; start only when on-site (location)"; B1 = staff flag bypasses the on-site requirement.

## C. Ops / external (David's accounts / not app code)
- **C1. App nejde stáhnout na Slovensku** — Samko can't download in SK. App Store + Google Play country/region availability must include Slovakia.
- **C2. ✅ DONE (main 5aae769) 2026-06-08.** app.pumplo.com live (Cloudflare CNAME→cname.vercel-dns.com, DNS-only). Added a host redirect in vercel.json: pumplo-nine.vercel.app/* → app.pumplo.com/* (307), so OLD printed QR stickers now resolve to the clean domain with NO reprinting. Verified: /s/test123 → 307 → app.pumplo.com/s/test123. NOTE: deployed to main (production); the 35 feature-branch commits are still NOT on main. ~~Odstranit "Vercel" ze všech domén~~ — confirmed: the QR resolves to `pumplo-nine.vercel.app` (whole app has no custom domain). Root: `src/lib/qrGenerator.ts:6` uses `window.location.origin`, and the app is only served from vercel.app. FIX (ops, with David): add a custom domain to the Vercel project (e.g. `app.pumplo.com`) → then window.location.origin (and QR) become the real domain automatically. Optional hardening: hardcode/env the QR base URL so QRs are always correct regardless of where the admin generates them. Physical QR codes already printed encode vercel.app — keep vercel.app working (Vercel serves both) or reprint after domain is set.
- **C3. Změnit e-mail + heslo pro přihlášení Eurogymu** — set real credentials so we can show the gym their admin login.
- **C4. Plakát na recepci** — design the reception poster (QR + value prop).
- **C5. Polepit vše** — physical stickers/QR at the gym, ASAP.

## Status
Triage done 2026-06-08. Order/priority pending David's confirmation.

## D. Second feedback batch (2026-06-10, David's training notes)
- **D1. Wrong day after rest day** 🔴 — trained on a rest day; workout started as LOWER (same as last completed) instead of UPPER (next in sequence). Day-progression (current_day_index) doesn't advance / off-schedule start picks wrong day.
- **D2. Pre-start exercise swap not persisted** 🔴 — refreshing/swapping an exercise in the workout PREVIEW (before starting) changes the video, but starting the workout uses the ORIGINAL exercise.
- **D3. Store screenshots look amateur** 🟡 — Google Play + App Store screenshots show status bar (flashlight/battery etc.). Redo with clean frames. (Ops/assets, with David. Desktop folders: pumplo-appstore-screenshots, pumplo-ipad-screenshots.)
- **D4. Exercise names in Czech in EN mode** 🟡 — many exercise names render in Czech although app language is EN. name_en is 100% populated (201/201) — so some UI render paths use `name` without resolving `name_en`.
