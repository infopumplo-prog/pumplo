# Push Notifications — Foundation (Phase 0) Design

**Date:** 2026-06-01
**Status:** Approved (design), pending spec review
**Author:** David Novotný + Claude

## Goal

Make push notifications actually **arrive and work** on the native iOS and Android
Pumplo member apps. Today the app has a Web Push (VAPID) system that only works in
browsers / installed PWAs — it does not work inside the native Capacitor WKWebView
(iOS) or the Android Capacitor WebView. This phase adds **native push delivery
(FCM)** and a unified send path, so all later notification triggers can reach every
device.

David's headline requirement: **everything works end-to-end** — not just "deployed",
but verified arriving on a real phone with the tapped notification navigating
correctly.

## Scope

This spec covers **Phase 0 (Foundation)** only — the delivery infrastructure. It is the
prerequisite for the later phases, which get their own specs:

- **Phase 1 — Automated reminders** (mostly already exists in `send-push-notifications`:
  morning / missed-workout / closing-soon / streak templates + Prague-time logic).
  Will "just work" on native once Phase 0 lands; minor tidy-up afterward.
- **Phase 2 — Admin → members broadcast** (gym owner / super_admin sends a push to a
  gym's members). Lives in the separate `pumplo-admin` repo + a Supabase function.
- **Phase 3 — Trainer → client** (message / plan assignment fires a push, wired into the
  existing Messages / ChatThread feature).

All later phases call the same `sendToUser()` entry point this phase creates.

## Architecture

Single fan-out entry point in the backend:

```
sendToUser(userId, { title, body, data }) →
   ├─ native devices  → FCM HTTP v1   (iOS via APNs bridge + Android)
   └─ web / PWA        → Web Push VAPID (existing, unchanged)
```

Every trigger (reminders, admin, trainer) calls only `sendToUser()`. One entry point,
one place to maintain delivery, retries, and dead-token cleanup.

## Data model

New table `device_tokens`:

| column      | type        | notes                                  |
|-------------|-------------|----------------------------------------|
| id          | uuid pk     |                                        |
| user_id     | uuid        | FK → auth.users, indexed               |
| token       | text        | FCM registration token, unique         |
| platform    | text        | 'ios' \| 'android'                     |
| created_at  | timestamptz | default now()                          |
| updated_at  | timestamptz | refreshed on re-register               |

RLS: a user may insert/update/delete only their own rows; the service role (edge
functions) may read all. Web push subscriptions stay where they are
(`user_profiles.push_subscription`) — not migrated.

Dead-token handling: when FCM returns `UNREGISTERED` / `INVALID_ARGUMENT` for a token,
the sender deletes that row.

## App side (ships in the new native build)

1. Add `@capacitor-firebase/messaging` (FCM token on both iOS and Android).
2. After login, if the user has opted in (or on first onboarding prompt): request
   notification permission → fetch FCM token → upsert into `device_tokens`.
3. Listen for token refresh → upsert the new token.
4. On logout / account delete: delete this device's token row.
5. Receive notifications in foreground and background; **tap → navigate** using the
   `data` payload (e.g. `{ route: '/training' }` or a chat/plan deep target).
6. Reuse the existing onboarding flag `notification_onboarding_shown` for the
   permission primer; respect existing per-type prefs in `user_profiles`
   (`notification_morning_reminder`, `notification_missed_workout`,
   `notification_closing_soon`).

Native-only: registration runs only when `Capacitor.isNativePlatform()`. In the
browser/PWA the existing VAPID path is unchanged.

## Native configuration

**iOS**
- Add the **Push Notifications** capability and `aps-environment` entitlement
  (`development` for debug, `production` for release) to the App target.
- Add `GoogleService-Info.plist` (from the Firebase iOS app) to the Xcode project.
- Create an **APNs Auth Key (.p8)** in the Apple Developer account and upload it to
  Firebase (Project Settings → Cloud Messaging) so FCM can deliver to iOS.
- Enable Background Modes → Remote notifications.

**Android**
- `google-services.json` already present ✅.
- FCM works once the plugin is installed and synced.

## Backend

- New shared helper `sendToUser(userId, payload)` (used by all senders).
- FCM delivery via **FCM HTTP v1 API** authenticated with a **Firebase service
  account** (stored as a Supabase secret, e.g. `FCM_SERVICE_ACCOUNT_JSON`).
- Refactor `send-push-notifications` so its existing template/scheduling logic calls
  `sendToUser()` instead of sending VAPID directly; VAPID becomes one of the two
  delivery channels inside the helper.
- Keep the existing cron trigger and message templates intact.

## External prerequisites (David provides, manual)

1. **Firebase service account key** (JSON) from the existing Firebase project →
   stored as Supabase secret.
2. **APNs Auth Key (.p8)** from Apple Developer → uploaded to Firebase.
3. **GoogleService-Info.plist** (iOS Firebase app) → added to Xcode.

(Confirm the Firebase project behind the existing `android/app/google-services.json`
is the one we'll use, and that it has an iOS app registered for `com.pumplo.app`.)

## Verification / success criteria — "everything works"

Phase 0 is done only when ALL of these pass on **real devices**:

1. Fresh install of the native app on a real **iOS** device → grant permission → a row
   appears in `device_tokens` with platform `ios`.
2. Same on a real **Android** device → row with platform `android`.
3. Calling `sendToUser(testUserId, …)` (via a temporary admin/test invocation) delivers
   a visible notification to **both** devices within seconds, app in background.
4. App in foreground also surfaces the notification (no silent drop).
5. **Tapping** the notification opens the app and navigates to the route in `data`.
6. Existing **web/PWA** push still works (no regression).
7. A revoked/uninstalled token is removed from `device_tokens` on the next send.

## Risks & notes

- **New build → new App Store + Play review.** Adding the push capability/entitlement
  requires a new native build and resubmission. The current v1.0 stays live; this ships
  as v1.1.
- iOS push **cannot** be tested in the Simulator — needs a physical device.
- iOS web push never works inside WKWebView — that's exactly why native FCM is needed;
  do not try to "fix" web push for the native app.
- Token lifecycle: handle refresh and multi-device (a user can have several rows).
- Keep secrets (service account, APNs key) out of git — Supabase secrets / Xcode only.

## Out of scope (Phase 0)

- Admin broadcast UI (Phase 2, `pumplo-admin` repo).
- Trainer → client wiring (Phase 3).
- New reminder types / richer scheduling (Phase 1 tidy-up).
- Notification analytics / open-rate tracking.
- Rich media / images in notifications.
