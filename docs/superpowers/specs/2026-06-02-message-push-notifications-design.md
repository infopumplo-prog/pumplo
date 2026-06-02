# Message Push Notifications — Design

**Date:** 2026-06-02
**Status:** Approved (design), pending spec review
**Scope:** Phase 2 of [[push-notifications-project]] — deliver a **push notification** to app users when they receive a message. Builds on the FCM foundation (`_shared/fcm.ts`, `device_tokens`) and the per-user language column (`user_profiles.language`) shipped 2026-06-02.

## Goal

When a user (member **or** trainer — both use the app) receives a message, their device gets a push immediately, in their chosen language (CS/EN framing). Two message sources:

1. **Gym → member** (`gym_messages`): a gym sends an announcement to one member or broadcasts to all members.
2. **Conversation message** (`direct_messages`): a 1:1 conversation between a member and a trainer (or member and gym owner). Push goes to whichever participant did **not** send the message.

**Out of scope (separate follow-on):** Email to gym managers on reply. The gym owner participates from the web admin (no device token) and needs an **email** channel, which requires an email provider (Resend) David has not set up yet. This spec is **push only**; gym-owner recipients simply no-op here (no token) and will be handled by the email feature later.

## Non-goals (YAGNI)

- No "shared workout" push — sharing is token/link based, there is no A→B share event. (David: keep via link for now.)
- No quiet hours / batching — messages deliver immediately, always.
- No per-user "mute messages" toggle — messages always push (reminders have toggles; messages do not). Can be added later if needed.
- No read-state syncing / badge counts in this spec.

## Architecture

**Postgres `AFTER INSERT` trigger → `pg_net` async HTTP POST → new Edge Function `send-message-push`.**

Rationale: message rows are created from multiple places and repos (member app hooks, `telegram-bot`, the separate pumplo-admin repo). A row-level DB trigger catches **every** insert regardless of origin, and `pg_net` makes the call asynchronously so the insert stays fast and never fails because of push. Alternatives rejected: inline push at each insert site (misses admin-repo/other inserts); cron polling (adds latency, messages should be immediate).

Both `pg_net` and `pg_cron` are already installed on the project (verified).

### Components

1. **Trigger function (plpgsql)** `notify_message_push()` — one `AFTER INSERT FOR EACH ROW` trigger on `gym_messages` and one on `direct_messages`. Each calls `net.http_post` to the Edge Function with `{ table, row_id }` and an `Authorization` / `x-cron-secret` header carrying `CRON_SECRET` (read from a DB setting / vault — resolved in plan). Fire-and-forget.
2. **Edge Function** `supabase/functions/send-message-push/index.ts` (`verify_jwt = false`, matching the established pattern of `send-push-notifications`). It:
   - Verifies the shared secret header; rejects otherwise.
   - Loads the message row by `table` + `row_id`.
   - Resolves recipient auth uid(s) (see Recipient Resolution).
   - For each recipient: skips the sender, builds localized title/body, calls `sendFcmToUser(supabase, recipientUid, payload)`.
   - Returns a small JSON summary (sent/skipped). Errors are logged, never thrown back to the DB.
3. **Config** — add `[functions.send-message-push] verify_jwt = false` to `supabase/config.toml`.

### Recipient Resolution (the correctness core)

All recipient ids must be **auth uids** (that is what `device_tokens.user_id` holds — verified). Resolution per source:

**`gym_messages`** (`sender_id` = gym owner auth uid):
- `target_user_id IS NOT NULL` → recipient = `target_user_id` (single member).
- else (broadcast, e.g. `target_type='all'`) → recipients = all `user_profiles.user_id WHERE selected_gym_id = gym_id`.
- Skip any recipient equal to `sender_id`.

**`direct_messages`** (belongs to a `conversation`; `sender_id` = sender auth uid, verified):
- Load the conversation. The recipient is the participant who is **not** the sender:
  - If `sender_id = participant_user_id` (the member sent it) → recipient is the other side:
    - `participant_type = 'trainer'` → **resolve trainer auth uid via `gym_trainers`**: `conversations.trainer_id = gym_trainers.id`, recipient = `gym_trainers.user_id`. ⚠️ `trainer_id` is NOT an auth uid — it references `gym_trainers.id`; the auth uid lives in `gym_trainers.user_id`. If that is NULL (trainer has not linked an app account) → no push (no-op).
    - `participant_type = 'user'` (member ↔ gym owner) → recipient = `gyms.owner_id` (gym owner). Gym owner is on the web → typically no device token → push no-ops now; this is the **email** case handled later.
  - else (sender is the trainer or `gym_owner`) → recipient = `participant_user_id` (the member).
- `conversations.other_user_id` is unused (always null in data) — ignore.

> Plan must double-check exact `participant_type` values and the `trainer_id → gym_trainers.user_id` join against live data (sampled here, but a small dataset).

### User → Trainer conversion (verified safe)

A regular user becomes a trainer via `src/pages/BecomeTrainer.tsx` (`handleSubmit`, ~line 138). It uses the **same authenticated user** (`useAuth`) — no new account — and:
- inserts `user_roles` (role='trainer', `user_id = user.id`),
- inserts `gym_trainers` with **`user_id: user.id`** (the auth uid) — line 145,
- inserts `trainer_gym_requests`, marks any invite used.

Implications for push (all favorable):
- **Auth uid is stable across the role change.** `device_tokens`, `user_profiles`, and the new `gym_trainers` row all key off the same `auth.uid()`.
- The user **already has a `device_tokens` row** from using the app as a member, so trainer-message pushes reach them **immediately** — no re-registration.
- `gym_trainers.user_id` is populated at conversion, so the `conversations.trainer_id → gym_trainers.user_id` join resolves to a real auth uid with tokens. The recipient logic works **with zero extra steps** for anyone who converts through this flow.
- `user_profiles.language` is unchanged → push stays localized correctly.

**Minor risk (pre-existing, not introduced here):** the flow always **INSERTs** a fresh `gym_trainers` row rather than claiming a gym-pre-created one. A trainer profile created some other way (admin/seed, `user_id` NULL — like the current legacy data row) is a *separate* row from the self-signup one. If a conversation points at a NULL-`user_id` row, push no-ops. Mitigation: test/back-fill links the test trainer; long-term, ensure conversations point at the linked row. Not a blocker for the push logic itself.

## Notification Content

Title = sender name (with 💬), body = message preview. Only the **framing/fallback** words are localized to the recipient's `user_profiles.language` (fallback `cs`); the sender's name and the message text are content and are not translated.

- **`gym_messages`** → title = `💬 {gym name}` (from `gyms.name`); body = `{message.title}` if present, then `{message.body}` preview, trimmed to ~140 chars.
- **`direct_messages`** → title = `💬 {sender display name}` (from the sender's `user_profiles` first/last name, or `gym_trainers.name`; fallback localized "Trenér"/"Trainer" or "Posilovna"/"Gym"); body = `{message.body}` preview ~140 chars.
- **Non-text message** (`direct_messages.message_type <> 'text'` or empty body) → body = localized fallback ("Nová zpráva" / "New message"; attachment → "📷 Příloha" / "📷 Attachment").

### Tap → deep link (`data.route`)

- `gym_messages` → open the member's messages screen / message detail.
- `direct_messages` → open that specific conversation.
- Exact route strings are resolved from the app router during planning (reuse the existing `usePushNavigation` deep-link mechanism that already handles `data.route`).

## Edge cases / guards

1. **Never notify the sender** (compare recipient uid to `sender_id`).
2. **No device token** → `sendFcmToUser` already no-ops (returns sent:0). Includes gym-owner (web) recipients.
3. **Broadcast fan-out** for `gym_messages` `target_user_id IS NULL` → loop all gym members; large gyms produce many pushes (acceptable).
4. **NULL trainer `user_id`** (legacy `gym_trainers` rows) → no push, logged. New trainers (via "Become Trainer" flow, which sets `user_id`) are fine.
5. **One push per message** — `AFTER INSERT FOR EACH ROW`; no dedup table needed (each message is a distinct event, unlike daily reminders).
6. **Auth** — function rejects calls without the correct `CRON_SECRET` header. `verify_jwt = false` so `pg_net` can reach it.
7. **Failure isolation** — `pg_net` is async; function errors are logged and never block or roll back the insert.

## Testing

- Insert a `gym_messages` row with `target_user_id` = a test member who has a device token → push arrives, correct language framing, tap opens messages.
- Insert a broadcast `gym_messages` (`target_type='all'`) → all gym members with tokens receive it; sender excluded.
- Insert a `direct_messages` row in a `participant_type='trainer'` conversation, sent by the member, where the trainer has a linked `gym_trainers.user_id` + token → trainer receives push. (Backfill/link the test trainer's `user_id` first — current data row is NULL.)
- Insert a `direct_messages` row sent by the trainer → member receives push.
- Verify the sender never receives their own push.
- Verify EN framing by setting a recipient's `user_profiles.language='en'`.

## Dependencies / prerequisites

- Existing: `_shared/fcm.ts` (`sendFcmToUser`), `device_tokens`, `user_profiles.language`, `CRON_SECRET`, `pg_net`, `pg_cron`. All present.
- New: trigger functions + triggers (DDL on prod via Management API query endpoint — same method used for the language column; `supabase db push` is unsafe here because remote migration history is empty), new Edge Function, `config.toml` entry.
- A test trainer with a linked `gym_trainers.user_id` and a registered device token (to verify the trainer path end-to-end).

## Deploy order

1. Create the Edge Function + `config.toml` entry; deploy it (`verify_jwt=false`).
2. Apply the trigger DDL to prod (Management API query). Triggers reference the deployed function URL + `CRON_SECRET`.
3. Test via inserts (above). Ships to users with the next native build (v1.1) — but server-side push works for any already-registered device immediately.
