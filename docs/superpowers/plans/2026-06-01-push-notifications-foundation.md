# Push Notifications Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make push notifications arrive on the native iOS and Android Pumplo apps via FCM, with a unified backend send path, verified end-to-end on real devices.

**Architecture:** Native apps register an FCM token (via `@capacitor-firebase/messaging`) stored in a new `device_tokens` table. A shared Deno helper sends to FCM over the HTTP v1 API using a Firebase service account. Existing VAPID web push (browser/PWA) is untouched. A throwaway `send-test-push` function proves delivery before wiring FCM into the existing reminder pipeline.

**Tech Stack:** Capacitor 8, `@capacitor-firebase/messaging`, Firebase Cloud Messaging HTTP v1, Supabase (Postgres + Edge Functions / Deno), React/TS.

**Prerequisites (DONE — files in `~/Downloads`):** `GoogleService-Info.plist`, real `google-services.json`, service account `pumplo-app-firebase-adminsdk-fbsvc-9a3470cdcc.json`, APNs key `3JU63V36PS` uploaded to Firebase. Firebase project `pumplo-app` / `556331013170`. See `docs/superpowers/specs/2026-06-01-push-notifications-foundation-design.md`.

**Testing note:** Push delivery cannot be unit-tested or run in a simulator. "Verify" steps for delivery are manual, on a **real device**. Code that can be tested (token shape, payload builders) gets tests.

---

### Task 1: `device_tokens` table

**Files:**
- Create: `supabase/migrations/20260601_device_tokens.sql`

- [ ] **Step 1: Write the migration**

```sql
create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios','android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists device_tokens_user_id_idx on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='device_tokens' and policyname='own_tokens_select') then
    create policy own_tokens_select on public.device_tokens for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='device_tokens' and policyname='own_tokens_insert') then
    create policy own_tokens_insert on public.device_tokens for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='device_tokens' and policyname='own_tokens_update') then
    create policy own_tokens_update on public.device_tokens for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='device_tokens' and policyname='own_tokens_delete') then
    create policy own_tokens_delete on public.device_tokens for delete using (auth.uid() = user_id);
  end if;
end $$;
```

- [ ] **Step 2: Apply via Supabase Dashboard SQL Editor** (per CLAUDE.md: DDL through the dashboard). Paste the migration, run it.

- [ ] **Step 3: Verify** — in SQL Editor: `select * from public.device_tokens limit 1;` → returns 0 rows, no error. Confirm RLS is on (table shows shield in dashboard).

- [ ] **Step 4: Commit** `git add supabase/migrations/20260601_device_tokens.sql && git commit -m "feat: device_tokens table for native push"`

---

### Task 2: Install plugin + place native config files

**Files:**
- Modify: `package.json` (dependency)
- Replace: `android/app/google-services.json`
- Create: `ios/App/App/GoogleService-Info.plist`

- [ ] **Step 1: Install the FCM plugin**

Run: `npm install @capacitor-firebase/messaging`
Expected: added to dependencies, no peer-dep errors (it targets Capacitor 8).

- [ ] **Step 2: Replace the placeholder Android config**

Run: `cp ~/Downloads/google-services.json android/app/google-services.json`
Verify: `python3 -c "import json;d=json.load(open('android/app/google-services.json'));print(d['client'][0]['client_info']['mobilesdk_app_id'])"` → prints `1:556331013170:android:aa1ba033021c1e106a982b` (NOT the old `...android:pumplo`).

- [ ] **Step 3: Place the iOS config**

Run: `cp ~/Downloads/GoogleService-Info.plist ios/App/App/GoogleService-Info.plist`
(It will be added to the Xcode target in Task 3.)

- [ ] **Step 4: Sync Capacitor**

Run: `npm run build && npx cap sync`
Expected: plugin appears in the sync output for both ios and android; no errors.

- [ ] **Step 5: Commit** `git add package.json package-lock.json android/app/google-services.json ios/App/App/GoogleService-Info.plist && git commit -m "chore: add FCM plugin + real Firebase config files"`

---

### Task 3: iOS native config in Xcode (manual GUI)

**Files:** Xcode project `ios/App/App.xcworkspace` (David performs these in Xcode).

- [ ] **Step 1: Open the workspace** — `open ios/App/App.xcworkspace`

- [ ] **Step 2: Add GoogleService-Info.plist to the target** — In Xcode, right-click the `App` group → "Add Files to App…" → select `ios/App/App/GoogleService-Info.plist` → ensure "App" target is checked. (Skip if already shown in the project tree with target membership.)

- [ ] **Step 3: Add the Push Notifications capability** — Select the `App` target → "Signing & Capabilities" → "+ Capability" → "Push Notifications". This creates/updates `App.entitlements` with `aps-environment`.

- [ ] **Step 4: Add Background Modes → Remote notifications** — "+ Capability" → "Background Modes" → check "Remote notifications".

- [ ] **Step 5: Verify entitlement** — Run: `grep -A2 aps-environment ios/App/App/App.entitlements` → shows `aps-environment` key. Commit: `git add ios/App && git commit -m "chore(ios): push notifications capability + entitlement"`

---

### Task 4: App-side FCM registration (native only)

**Files:**
- Create: `src/hooks/usePushRegistration.ts`
- Modify: `src/App.tsx` (mount the hook)

- [ ] **Step 1: Write the registration hook**

```ts
// src/hooks/usePushRegistration.ts
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const platform = (): 'ios' | 'android' | null => {
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android' ? p : null;
};

async function saveToken(userId: string, token: string) {
  const plat = platform();
  if (!plat) return;
  await supabase
    .from('device_tokens')
    .upsert({ user_id: userId, token, platform: plat, updated_at: new Date().toISOString() },
            { onConflict: 'token' });
}

// Registers this device's FCM token while a user is logged in (native only).
export const usePushRegistration = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;
    let removeRefresh: (() => void) | undefined;

    (async () => {
      const perm = await FirebaseMessaging.requestPermissions();
      if (perm.receive !== 'granted') return;
      const { token } = await FirebaseMessaging.getToken();
      if (token) await saveToken(user.id, token);

      const handle = await FirebaseMessaging.addListener('tokenReceived', async (e) => {
        if (e.token) await saveToken(user.id, e.token);
      });
      removeRefresh = () => { handle.remove(); };
    })();

    return () => { removeRefresh?.(); };
  }, [user]);
};
```

- [ ] **Step 2: Mount the hook in App** — In `src/App.tsx`, inside `AppRoutes` (which is rendered under `AuthProvider`), add `usePushRegistration();` at the top of the component, and import it. `AppRoutes` already runs inside `<AuthProvider>` so `useAuth()` works.

```ts
import { usePushRegistration } from '@/hooks/usePushRegistration';
// ...
const AppRoutes = () => {
  usePushRegistration();
  return ( <> ... existing JSX ... </> );
};
```

- [ ] **Step 3: Typecheck** — Run: `npx tsc --noEmit 2>&1 | head` → no new errors. (Delivery verified later on device.)

- [ ] **Step 4: Commit** `git add src/hooks/usePushRegistration.ts src/App.tsx && git commit -m "feat: register FCM device token on login (native)"`

---

### Task 5: Notification tap → navigation

**Files:**
- Create: `src/hooks/usePushNavigation.ts`
- Modify: `src/App.tsx` (mount alongside registration)

- [ ] **Step 1: Write the navigation hook**

```ts
// src/hooks/usePushNavigation.ts
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { useNavigate } from 'react-router-dom';

// On notification tap, navigate to the route carried in the data payload.
export const usePushNavigation = () => {
  const navigate = useNavigate();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    (async () => {
      const handle = await FirebaseMessaging.addListener('notificationActionPerformed', (e) => {
        const route = (e.notification?.data as Record<string, string> | undefined)?.route;
        if (route && route.startsWith('/')) navigate(route);
      });
      remove = () => { handle.remove(); };
    })();
    return () => { remove?.(); };
  }, [navigate]);
};
```

- [ ] **Step 2: Mount in App** — In `src/App.tsx` `AppRoutes`, add `usePushNavigation();` next to `usePushRegistration();` and import it. It must be inside `<BrowserRouter>` (AppRoutes already is) so `useNavigate` works.

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit 2>&1 | head` → clean.

- [ ] **Step 4: Commit** `git add src/hooks/usePushNavigation.ts src/App.tsx && git commit -m "feat: navigate on push notification tap"`

---

### Task 6: FCM HTTP v1 sender (shared Deno helper) + Supabase secret

**Files:**
- Create: `supabase/functions/_shared/fcm.ts`

- [ ] **Step 1: Add the service account as a Supabase secret**

Run (reads the file, never prints it):
`npx supabase secrets set FCM_SERVICE_ACCOUNT_JSON="$(cat ~/Downloads/pumplo-app-firebase-adminsdk-fbsvc-9a3470cdcc.json)"`
Expected: "Finished supabase secrets set." (Requires `supabase login` + linked project `udqwjqgdsjobdufdxbpn`.)

- [ ] **Step 2: Write the FCM helper** (mints an OAuth token from the service account JWT, then POSTs to FCM v1)

```ts
// supabase/functions/_shared/fcm.ts
import { createClient } from "npm:@supabase/supabase-js@2";

interface PushPayload { title: string; body: string; data?: Record<string, string>; }

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  })));
  const unsigned = `${header}.${claim}`;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const json = await res.json();
  if (!json.access_token) throw new Error('FCM token mint failed: ' + JSON.stringify(json));
  return json.access_token;
}

// Sends `payload` to every native device token of `userId`. Deletes dead tokens.
export async function sendFcmToUser(
  supabase: ReturnType<typeof createClient>, userId: string, payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  const sa = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')!);
  const { data: tokens } = await supabase
    .from('device_tokens').select('token').eq('user_id', userId);
  if (!tokens?.length) return { sent: 0, removed: 0 };

  const accessToken = await getAccessToken(sa);
  let sent = 0, removed = 0;
  for (const { token } of tokens) {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: {
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        apns: { payload: { aps: { sound: 'default' } } },
      } }),
    });
    if (res.ok) { sent++; continue; }
    const err = await res.json().catch(() => ({}));
    const code = err?.error?.details?.[0]?.errorCode || err?.error?.status;
    if (code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT') {
      await supabase.from('device_tokens').delete().eq('token', token); removed++;
    }
  }
  return { sent, removed };
}
```

- [ ] **Step 3: Commit** `git add supabase/functions/_shared/fcm.ts && git commit -m "feat: FCM HTTP v1 sender helper"`

---

### Task 7: `send-test-push` function (delivery proof)

**Files:**
- Create: `supabase/functions/send-test-push/index.ts`

- [ ] **Step 1: Write the test function**

```ts
// supabase/functions/send-test-push/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendFcmToUser } from "../_shared/fcm.ts";

Deno.serve(async (req) => {
  const { userId, title, body, route } = await req.json();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const result = await sendFcmToUser(supabase, userId,
    { title: title ?? 'Pumplo test', body: body ?? 'Funguje to! 🎉', data: route ? { route } : {} });
  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
});
```

- [ ] **Step 2: Deploy** — Run: `npx supabase functions deploy send-test-push`
Expected: deployed to project `udqwjqgdsjobdufdxbpn`.

- [ ] **Step 3: Commit** `git add supabase/functions/send-test-push/index.ts && git commit -m "feat: send-test-push for FCM delivery verification"`

---

### Task 8: End-to-end verification on REAL devices (manual)

No automated test possible — this is the "everything works" gate from the spec.

- [ ] **Step 1: iOS** — Build & run on a real iPhone from Xcode (or distribute a TestFlight build). Log in. Grant the notification permission prompt.
- [ ] **Step 2:** In Supabase SQL Editor: `select user_id, platform, left(token,12) from device_tokens;` → a row with platform `ios` appears.
- [ ] **Step 3:** Invoke the test function (replace USER_ID):
`curl -X POST "https://udqwjqgdsjobdufdxbpn.supabase.co/functions/v1/send-test-push" -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -H "Content-Type: application/json" -d '{"userId":"USER_ID","route":"/training"}'`
Expected response `{"sent":1,"removed":0}` and a banner appears on the iPhone (app backgrounded).
- [ ] **Step 4:** Foreground the app, send again → notification still surfaces (not silently dropped).
- [ ] **Step 5: Tap** the notification → app opens on `/training`.
- [ ] **Step 6: Android** — Repeat Steps 1–5 on a real Android device (platform `android` row, banner, tap-navigation).
- [ ] **Step 7: Regression** — Confirm existing web/PWA push still works (subscribe in a browser PWA via Settings, trigger send-push-notifications test mode, banner arrives).
- [ ] **Step 8: Dead-token cleanup** — Uninstall the app on one device, send again → that token row is deleted (`removed:1`).
- [ ] **Step 9: Google Sign-In regression (Android)** — Sign out and sign back in with Google on Android (new google-services.json) → still works. If it fails, add the app's SHA-1 fingerprints to the Firebase Android app (Project settings → Android app → Add fingerprint) using `cd android && ./gradlew signingReport` and the Play App Signing SHA-1 from Play Console.

---

### Task 9: Wire FCM into the reminder pipeline

**Files:**
- Modify: `supabase/functions/send-push-notifications/index.ts`

The function currently sends VAPID web push to each user with a non-null `push_subscription`. Make it also send FCM to that user's device tokens, so existing reminders (morning/missed/closing/streak) reach native devices.

- [ ] **Step 1: Import the helper** — at the top of `index.ts`, add: `import { sendFcmToUser } from "../_shared/fcm.ts";`

- [ ] **Step 2: Send FCM alongside VAPID** — at each location where the function sends a VAPID push to a user (search for the `sendWebPush`/fetch-to-`subscription.endpoint` call sites around lines 633, 752, 826), immediately after the VAPID send for that user add:
```ts
try { await sendFcmToUser(supabase, user.user_id, { title: message.title, body: message.body }); }
catch (e) { console.error('FCM send failed', user.user_id, e); }
```
Use the same `title`/`body` already computed for that user's web push. Wrap in try/catch so an FCM failure never breaks the existing VAPID path.

- [ ] **Step 3: Also notify native-only users** — the current queries filter `.not('push_subscription','is',null)`, so users with ONLY a device token (no web sub) are skipped. Broaden each user query to also include users who have a row in `device_tokens` (e.g. fetch device-token user_ids separately and union), so native-only users get reminders. Keep the existing condition logic (training day, time, streak) unchanged.

- [ ] **Step 4: Deploy** — `npx supabase functions deploy send-push-notifications`

- [ ] **Step 5: Verify** — trigger the function's test mode; confirm a reminder lands on a real native device AND a web/PWA subscriber. 

- [ ] **Step 6: Commit** `git add supabase/functions/send-push-notifications/index.ts && git commit -m "feat: reminders deliver to native devices via FCM"`

---

## Out of scope (later phases / specs)
- Phase 1 reminder tidy-up, Phase 2 admin→members + gym-manager email (Resend) + desktop web push, Phase 3 trainer→client. New native build → v1.1 App Store/Play submission (covered by the dual-platform release flow).
