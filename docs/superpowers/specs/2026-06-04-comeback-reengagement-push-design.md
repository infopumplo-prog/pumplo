# Comeback / Re-engagement Push — Design

**Date:** 2026-06-04
**Status:** Design approved (David), templates pending review
**Scope:** A Duolingo-style escalating push system that wins back users who stop training. Localized (cs/en), progress-personalized, young/human tone. iOS + Android. Part of [[push-notifications-project]]. This is core to Pumplo's value (retention / churn reduction).

## Goal

A user who stops completing workouts receives escalating "come back" pushes at increasing intervals, in their chosen language, referencing how far they got (streak / total workouts / plan progress / goal). When they train again, the clock resets.

## Trigger

- **D = whole days since the user's last *completed* workout** (`workout_sessions` where `completed_at IS NOT NULL`, max `started_at`/`completed_at`), in Prague time.
- Only users with **≥1 completed workout ever** are eligible (this is "comeback", not onboarding). Users who never trained are out of scope.
- D resets automatically when they complete a workout (it's computed live, no stored state).

## Cadence (approved)

Fire on absence **day 2, 4, 7, 11, 16, 23, 30**, then **every 14 days** (44, 58, 72, 86). **Hard stop after day 86** (~90-day cap) to avoid forever-nagging / uninstalls.

- Stage set: `[2, 4, 7, 11, 16, 23, 30, 44, 58, 72, 86]`.
- A push fires only on a day where D exactly equals a stage value.
- Max **1 comeback push/user/day**; dedup via `notification_logs` (type `comeback`, `date_key` = send date).
- Send at the user's `preferred_time` hour (6/10/14/18) if set, else **10:00 Prague**. The hourly cron self-gates to that hour.

## Interaction with existing reminders

To avoid double-spam, **on a day a comeback push fires, the morning/missed/closing reminders are suppressed for that user** (they check for a `comeback` log today and skip; comeback is processed first in the handler). On non-stage days, normal reminders run as usual. After the user returns (D back to 0–1), only normal reminders apply.

## Personalization (approved: all four)

Build a **hook** from the strongest signal the user actually has, in priority order, then pick the matching template variant:

1. **Streak** — `max_streak` (or `current_streak` if higher historically) ≥ 3 → "your {n}-day record".
2. **Total workouts** — count of completed `workout_sessions` ≥ 5 → "{n} workouts behind you".
3. **Plan progress / level** — active plan `current_day_index` or `user_level` → "you were partway through your plan".
4. **Goal** — `primary_goal` → "your goal — {goal} — is still waiting".

Always include **first name**. If no signal qualifies (sparse new-ish user), use the **generic** template variant. Each stage therefore has two variants: **personalized** (uses one hook) and **generic**.

## Opt-out

Add `user_profiles.notification_comeback boolean NOT NULL DEFAULT true`. Add a "Připomínky návratu / Comeback reminders" toggle in Settings (next to the other notification toggles). Comeback only sends when true. (Store-policy friendly.)

## Delivery & localization

- New `processComebackNotifications` in the existing `send-push-notifications` Edge Function (hourly cron). Delivers via the shared `sendFcmToUser` → **iOS + Android** (+ optional web push), exactly like the other reminders.
- Templates live in the `MESSAGES` bundles (`cs` / `en`); selection is **server-side** by `user_profiles.language` (proven mechanism, platform-agnostic — verified on iOS and Android).

## Data / DB changes

- `ALTER TABLE user_profiles ADD COLUMN notification_comeback boolean NOT NULL DEFAULT true;`
- `notification_logs`: reuse with `notification_type = 'comeback'`. (Extend the `NotificationType` union in code.)
- No new state table (D is computed live; per-day dedup via logs).

## Templates (young, human, escalating — cs + en)

Placeholders: `{name}`, `{streak}`, `{workouts}`, `{goal}`. Each stage: **A = personalized**, **B = generic** fallback. Final copy may be tuned; this is the v1 set.

### Czech (cs)

| Day | A (personalized) | B (generic) |
|----|------------------|-------------|
| 2 | `👋 Hej {name}, dva dny pauza? Tělo už kouká, kde seš.` | `👋 Hej {name}, dva dny pauza? Vídíme se v posilce?` |
| 4 | `🙏 {name}, čtyři dny… tvůj rekord {streak} dní by to neschvaloval.` | `🙏 {name}, čtyři dny ticho. Dáme to zítra?` |
| 7 | `🔥 Týden bez tréninku, {name}. {workouts} tréninků za tebou — teď to nezahodíš.` | `🔥 Týden bez tréninku, {name}. Pojď se vrátit do hry.` |
| 11 | `😅 {name}, svaly ti píšou, že jim chybíš. Tvůj cíl ({goal}) pořád čeká.` | `😅 {name}, svaly ti píšou, že jim chybíš. Vrátíš se?` |
| 16 | `😤 {name}, {workouts} tréninků a teď ticho? Deal byl jinej. Zítra náprava?` | `😤 {name}, dva týdny? Deal byl jinej. Zítra náprava?` |
| 23 | `🥺 {name}, fakt tě tam chybíš. Jeden trénink a jsi zpátky v sérii.` | `🥺 {name}, fakt tě tam chybíš. Jeden trénink stačí.` |
| 30 | `💔 Poslední šťouch, {name}. Pak tě nechám bejt — ale rekord {streak} dní by byl škoda.` | `💔 Poslední šťouch, {name}. Pak tě nechám bejt. Bylo by škoda toho nechat.` |
| 44+ (tail) | `🌱 {name}, pořád tu na tebe čeká tvůj plán. Kdykoliv budeš chtít.` | `🌱 {name}, pořád tu pro tebe jsme. Kdykoliv budeš chtít.` |

### English (en)

| Day | A (personalized) | B (generic) |
|----|------------------|-------------|
| 2 | `👋 Hey {name}, two days off? Your body's already asking where you are.` | `👋 Hey {name}, two days off? See you at the gym?` |
| 4 | `🙏 {name}, four days… your {streak}-day record wouldn't approve.` | `🙏 {name}, four quiet days. Get back to it tomorrow?` |
| 7 | `🔥 A week off, {name}. {workouts} workouts behind you — don't throw it away now.` | `🔥 A week off, {name}. Come back into the game.` |
| 11 | `😅 {name}, your muscles say they miss you. Your goal ({goal}) is still waiting.` | `😅 {name}, your muscles say they miss you. Coming back?` |
| 16 | `😤 {name}, {workouts} workouts and now silence? That wasn't the deal. Fix it tomorrow?` | `😤 {name}, two weeks? That wasn't the deal. Fix it tomorrow?` |
| 23 | `🥺 {name}, we really miss you. One workout and you're back in the game.` | `🥺 {name}, we really miss you. One workout is all it takes.` |
| 30 | `💔 Last nudge, {name}. Then I'll leave you be — but a {streak}-day record would be a shame to lose.` | `💔 Last nudge, {name}. Then I'll leave you be. Would be a shame to quit.` |
| 44+ (tail) | `🌱 {name}, your plan is still here waiting. Whenever you're ready.` | `🌱 {name}, we're still here for you. Whenever you're ready.` |

Title for all comeback pushes: a short branded line, e.g. cs `Pumplo` / en `Pumplo` with the emoji in the body, OR reuse the body's lead. (Final title decided in implementation — likely `💪 Pumplo` so the lock screen reads cleanly.) Tap → opens `/` (home) or `/training`.

## Edge cases

- **No qualifying signal** → generic (B) variant.
- **Missing first name** → drop the name token gracefully ("Hej, dva dny pauza?").
- **Cron downtime** skips a stage day → acceptable (sparse, no catch-up).
- **User disabled `notification_comeback`** → never sent.
- **Every-other-day trainers**: day-2 may replace a normal morning nudge; day-2 copy is intentionally soft so it reads fine either way.
- **No device token / web only** → FCM no-op / optional web push (same as other reminders).

## Testing

- Set a test user's last `workout_sessions.completed_at` to N days ago for each stage (2/4/7/…); run the function at the send hour; verify the correct stage + variant + language arrives on iOS and Android.
- Verify personalized vs generic selection (user with streak/workouts vs sparse user).
- Verify suppression: on a stage day, the morning/closing reminder does not also fire.
- Verify opt-out: `notification_comeback=false` → nothing.
- Verify reset: completing a workout drops D to 0 → flow stops.

## Out of scope

- "Never started" onboarding nudges (users with 0 workouts).
- In-app inbox / non-push channels.
- ML-based send-time optimization.
