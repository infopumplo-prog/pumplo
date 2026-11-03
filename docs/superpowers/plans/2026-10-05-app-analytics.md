# In-app analytics — implementation plan

Spec: `docs/superpowers/specs/2026-10-05-app-analytics-design.md`. Branch `feat/app-analytics` (local only).

1. **Deps + docs** — install the four plugins, spec + plan. Commit.
2. **Pure core (TDD)** — `appConsent.ts` (parse/save versioned consent), `appAnalyticsCore.ts` (consent gating, pending queue,
   param whitelist, Meta mapping + ATT gate), `installReferrer.ts` (parse `pumplo_scan_` / `utm_source`), `screenName.ts`.
   Tests first, then code. Commit.
3. **Native adapter** — `analyticsConfig.ts` (Meta constants), `appAnalytics.ts` (Firebase / Meta / ATT / referrer wiring,
   `applyConsent`, `track*` helpers), Vite stub for `firebase/analytics`. Commit.
4. **Native config** — Info.plist (collection off, consent defaults, FB autolog off, NSUserTrackingUsageDescription +
   InfoPlist.strings cs/en if present), AndroidManifest meta-data, prepared Meta placeholders. Commit.
5. **Consent UI** — `AnalyticsConsentScreen` + gate in App.tsx, Settings row "Soukromí a měření", i18n cs/en. Commit.
6. **Events** — sign_up, tutorial_complete, select_gym, workout_start/complete/first_workout, screen_view, deeplink. Commit.
7. **Privacy + version** — Privacy section 7, 1.3.1 / build 14 (all iOS targets + Android). Commit.
8. **Verify** — typecheck baseline, vitest, web build, cap sync, Android assembleDebug, iOS simulator build, self-review.
