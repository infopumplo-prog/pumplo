# In-app analytics (Firebase Analytics + Meta App Events) — design

Approved by David on 5 Oct 2026 (vault: `pumplo/strategie/2026-10-05 Měření v appce — Firebase + Meta (rozhodnutí).md`).
Release: 1.3.1 (build 14), iOS + Android. Native only — the web build at app.pumplo.com is unchanged
(the QR machine pages keep their own cookie banner in `webAnalytics.ts`).

## Goals
- Funnel measurement in GA4 (Firebase project `pumplo-app`, already linked to the Pumplo GA account).
- Meta App Events for install/registration campaigns, switched off until the Meta App ID + Client Token exist.
- GDPR/ePrivacy: nothing is collected before an explicit opt-in; choice can be changed in Settings.

## Plugins
| Need | Package | Why |
|---|---|---|
| Firebase Analytics | `@capacitor-firebase/analytics` 8.2.0 | Same family and exact version as the existing `@capacitor-firebase/messaging` 8.2.0, same firebase-ios-sdk (SPM `upToNextMajor 12.7.0`) |
| ATT | `@capgo/capacitor-app-tracking-transparency` 8.x | Capacitor ≥8 peer, SPM support, maintained (Sept 2026 release) |
| Meta App Events | `@capgo/capacitor-facebook-analytics` 8.x | Only maintained Capacitor 8 App Events plugin; explicit consent-gated `initAppEvents()`, FBSDK 18 (iOS SPM / Android facebook-core) |
| Play Install Referrer | `@capgo/capacitor-install-referrer` 8.x | Capacitor ≥8 peer, wraps Google `installreferrer` library; iOS returns no referrer (ignored) |

## Consent
- Stored in `localStorage` key `pumplo_app_consent` as `{v, analytics, marketing, ts}`; version `APP_CONSENT_VERSION = 1`.
  A different version ⇒ treated as undecided and the screen is shown again.
- Native defaults: iOS `FIREBASE_ANALYTICS_COLLECTION_ENABLED=false` + `GOOGLE_ANALYTICS_DEFAULT_ALLOW_*=false`;
  Android `firebase_analytics_collection_enabled=false` + `google_analytics_default_allow_*=false`;
  Meta `AutoInitEnabled/AutoLogAppEventsEnabled/AdvertiserIDCollectionEnabled=false`.
- On decision: `setEnabled(analytics)`, `setConsent` for analytics_storage / ad_storage / ad_user_data / ad_personalization.
  Marketing on iOS ⇒ ATT prompt; Meta initialised only if `META_APP_ID` + `META_CLIENT_TOKEN` are set, marketing is on and (iOS) ATT is `authorized`.
- Events fired while the user has not decided yet (e-mail sign-up and onboarding happen before the screen) are held
  locally (max 20, never sent) and flushed only if analytics is accepted on the first decision; dropped on reject.
- Screen ("Pomoz nám zlepšovat Pumplo 💪"): shown once after onboarding is complete (also existing users on next open),
  never on auth/public pages or during an active workout. Layer 1: Přijmout vše / Odmítnout vše / Upravit; layer 2 toggles
  Nezbytné (locked on), Analytické, Marketingové (default off). Settings → "Soukromí a měření" reopens it.

## Events (one wrapper, `src/lib/appAnalytics.ts`; params whitelisted, no PII)
| Event | Params | Where | Meta |
|---|---|---|---|
| sign_up | method email/google/apple | Auth.tsx after register; AuthContext SIGNED_IN for new OAuth accounts (created_at ≈ last_sign_in_at, once per user) | fb_mobile_complete_registration |
| tutorial_complete | – | Auth.tsx after profile verified; OnboardingDrawer first completion (not edit mode) | TutorialComplete (custom) |
| select_gym | gym_id | Map.tsx selectGym, Training.tsx handleGymSelect (on success) | – |
| workout_start | resumed | WorkoutSession mount | – |
| workout_complete | is_bonus | WorkoutSession after saveWorkoutSession (not queue flush / Hevy) | WorkoutComplete (custom) |
| first_workout | – | same, when the user has exactly one stored session | FirstWorkout (custom) |
| screen_view | screen_name (route pattern, ids replaced by `:id`) | ScreenViewTracker in App.tsx | – |
| app_open_deeplink | path (route pattern) | PlanDeepLinkNavigator | – |
| install_attributed | scan_id | Android first launch, referrer `pumplo_scan_<id>` | – |
User property `install_source` = `qr_scan` or `utm_source`.

## Meta setup (David)
JS: `src/lib/analyticsConfig.ts` → `META_APP_ID`, `META_CLIENT_TOKEN`.
iOS `ios/App/App/Info.plist`: `FacebookAppID`, `FacebookClientToken`, `FacebookDisplayName` (Pumplo),
`LSApplicationQueriesSchemes` + `fbapi`, `fb-messenger-share-api` (only needed for login/share, harmless).
Android: `res/values/strings.xml` `facebook_app_id`, `facebook_client_token` + manifest meta-data
`com.facebook.sdk.ApplicationId` / `com.facebook.sdk.ClientToken` (commented block prepared in AndroidManifest.xml).
All three places must be filled in the same build — iOS FBSDK throws if `initAppEvents` runs without `FacebookAppID`.

## Out of scope
iOS install attribution (SKAN/AdServices), server-side events, web app analytics.
