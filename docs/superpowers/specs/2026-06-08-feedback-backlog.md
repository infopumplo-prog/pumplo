# Pumplo v1.1 — Feedback Backlog (2026-06-08)

Captured from David's training-session notes + 4 screenshots. Big update before store submit.

## A. App bugs / features (member app — this repo)

### 🔴 High priority
- **A1. Regenerace plánu NEFUNGUJE** (marked !!!): "mám 5 dní a stále mám upper/lower, mám mít PPL". Plan regeneration ignores the day count / split — produces wrong split. David's #1 concern.
- **A2. Videa se nepřehrávají hned** — first set video doesn't play immediately (plays on 2nd set). Also: video doesn't autoplay when returning from another app. Also: on slow connections videos load extremely slowly or not at all ("přítah kolen k hrudníku se nenačetl vůbec").

### 🟡 Workout UX
- **A3. Časomíra pauzy musí zaznít i na pozadí** — rest timer sound must fire even when app is backgrounded / when it ends.
- **A4. Pauza → ukázat rovnou video dalšího cviku** — during rest before next exercise, show the next exercise's video so user can walk to the next machine during the rest.
- **A5. Trénink jde zobrazit i mimo gym, ale nesmí se spustit** — show the workout even when not at the gym, but block starting it (currently?). Confirm exact current behavior.

### 🟡 Onboarding / profile
- **A6. Jméno / username povinný údaj** — make name a required field.
- **A7. První volba posilovny není intuitivní** — gym selection on first run is hard to find; needs clearer UX.
- **A8. Poloha (Simona)** — location didn't work, had to enable via Settings. Improve location permission prompt/flow.

### 🟡 Content / sharing
- **A9. Nesrovnaný překlad cviků** — exercise descriptions are mixed EN/CS (headings "Description & technique / Setup / Common mistakes / Tips" in English, body partly EN partly CS). Needs consistent localization per user language.
- **A10. Instagram sdílení** — shared photo stretches/distorts; Instagram (and other targets) not auto-offered in the share sheet.

## B. Team/staff member feature (code + data)
- **B1. Team-member "train anywhere" flag** — Pumplo team members (staff) must be able to use/start the app ANYWHERE regardless of gym geofence, even if they selected Eurogym. Needs a staff designation on their profile + bypass of the location/gym gate. (Related to A5's gym gate.)

### ✅ GYM GATE DECISION (David, 2026-06-08)
- **Normal users:** after selecting a gym, they SEE the workout with the exercises that will be there, CAN regenerate the plan, and CAN view exercise info — all WITHOUT being at the gym. But they **cannot START a workout unless their location is physically inside that gym**.
- **Team/staff members:** a profile flag lets them turn it on / start a workout **anywhere** (location bypass). These are Pumplo staff who validate the app with David.
- So A5 = "view + regenerate + info anywhere; start only when on-site (location)"; B1 = staff flag bypasses the on-site requirement.

## C. Ops / external (David's accounts / not app code)
- **C1. App nejde stáhnout na Slovensku** — Samko can't download in SK. App Store + Google Play country/region availability must include Slovakia.
- **C2. Odstranit "Vercel" ze všech domén** — e.g. scanning the QR code shows a *.vercel.app URL. Map all surfaces to the real pumplo.com domain (QR target, any vercel.app references).
- **C3. Změnit e-mail + heslo pro přihlášení Eurogymu** — set real credentials so we can show the gym their admin login.
- **C4. Plakát na recepci** — design the reception poster (QR + value prop).
- **C5. Polepit vše** — physical stickers/QR at the gym, ASAP.

## Status
Triage done 2026-06-08. Order/priority pending David's confirmation.
