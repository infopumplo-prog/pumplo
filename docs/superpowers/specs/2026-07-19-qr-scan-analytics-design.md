# QR Scan Analytics — Design

**Date:** 2026-07-19 · **Status:** Approved by David (chat)

## Goal
Measure the full funnel per gym and per period: QR scan (machine sticker or flyer)
→ store click → install → signup → usage. Scans must be exact and recorded even
when the person never installs anything, attributed to the concrete machine or flyer.

## Decisions (from brainstorm)
- Attribution as precise as platforms allow: Android exact via Play Install
  Referrer; iOS server-side inference (network hash + time window + selected gym),
  labeled as inferred in UI.
- Machine stickers are already printed and already point to
  `https://app.pumplo.com/s/<short_code>` — no reprint; the station page keeps its
  current member experience and only adds silent scan logging. Its existing
  download CTA additionally logs `store_click`.
- Flyers get a new tracked URL `https://app.pumplo.com/go/<code>` (mini landing
  with a download button) and will be re-generated before printing. Granularity:
  one code per gym (first: `eurogym`).
- Dashboard: **super admin only for now** (pumplo-admin). Gym-admin view postponed.

## Architecture
- **DB (Supabase):**
  - `qr_codes` — flyer codes: id, code (unique), gym_id → gyms, label, created_at.
    (Station codes stay in `gym_machines.short_code`; no duplication.)
  - `qr_events` — one row per funnel event: id, event_type
    (`scan` | `store_click` | `first_open` | `signup`), source_type
    (`station` | `flyer`), code, gym_id, machine_id (nullable), scan_id
    (nullable self-ref), platform (`ios` | `android` | `other`), ip_hash,
    ua_hash, created_at. RLS enabled with **no policies** — service role only;
    the admin dashboard reads through an edge function that verifies the
    caller's admin role.
- **Edge function `log-qr`** (public, CORS): actions `scan` and `store_click`.
  Resolves gym from `qr_codes` (flyer) or `gym_machines` (station), hashes
  IP+UA (SHA-256, salted), dedups repeated scans (same ip_hash+code within
  10 min returns the existing scan_id), inserts the event, returns
  `{ scan_id, appStoreUrl, playStoreUrl }` where the Play URL carries
  `referrer=pumplo_scan_<scan_id>`.
- **Edge function `qr-stats`** (Phase 1b): admin-authenticated aggregate reads
  for the super-admin dashboard (per gym, per period, per machine/flyer,
  funnel counts).
- **Web (app.pumplo.com, Vercel):**
  - New public route `/go/:code` — branded mini landing (logo, one benefit
    line, Stáhnout button), logs scan on mount, logs store_click on tap, then
    redirects to the right store (desktop: shows both store badges).
  - `StationPage` — logs scan on mount; `StationCTA` logs store_click before
    the existing redirect. No visual change for members.
- **Phase 2 (later, app 1.2.3+):** Install Referrer plugin on Android →
  `claim-install` edge function pairs first_open exactly; iOS inferred pairing;
  signup events linked at registration; usage joined from workout_sessions.

## Failure handling
Tracking must never break the flow: all logging calls are fire-and-forget with
catch-to-noop; the landing works and redirects even if the function is down.

## Rollout
Tonight: migration, `log-qr`, `/go/:code`, station logging, `eurogym` flyer code,
styled QR PNG for print, Vercel prod deploy. Dashboard (`qr-stats` + admin page)
follows right after; scans collect from day one regardless.
