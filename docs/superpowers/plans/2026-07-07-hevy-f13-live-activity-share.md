# Hevy F13 — Rest widget + share karty: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock-screen rest widget (iOS Live Activity + Android ongoing notifikace) a dvě nové share karty (svalová postavička, fun fact) — dle specu `docs/superpowers/specs/2026-07-07-hevy-f13-live-activity-share-design.md`.

**Architecture:** Vlastní app-lokální Capacitor plugin `RestActivity` (Swift + Java) volaný z JS wrapperu `src/lib/restLiveActivity.ts` ze stávající rest-timer logiky. Share karty = 2 nové šablony ve stávajícím karuselu `WorkoutShareCard`, svalová data ze sdílené utility extrahované z P3.

**Tech Stack:** Capacitor 8, React + TypeScript + Vite, SwiftUI + ActivityKit (iOS 16.2+), Java NotificationCompat (Android), react-i18next, html2canvas.

## Global Constraints

- Repo nemá unit-test framework → verifikace každého tasku = `npx tsc -p tsconfig.app.json --noEmit` + `npm run build` (web), `./gradlew :app:compileDebugJavaWithJavac` (Android), `xcodebuild ... CODE_SIGNING_ALLOWED=NO` (iOS), + manuální test na zařízení na konci.
- Větev: `feat/push-notifications`. Commit po každém tasku.
- iOS minimum pro Live Activity: **16.2** (guard `#available`), plugin na starším iOS tiše no-op.
- Existující vzor registrace pluginů: iOS `MainViewController.capacitorDidLoad()` (`bridge?.registerPluginInstance(...)`), Android `MainActivity.onCreate()` (`registerPlugin(...)` PŘED `super.onCreate`).
- Notifikační ID: rest-end notifikace používá 9911 (kanál `pumplo_rest`); widget-notifikace použije **9912** a NOVÝ tichý kanál **`pumplo_rest_live`**.
- Pumplo cyan: `#4CC9FF`.
- Nikdy neposílat updaty Live Activity každou vteřinu — odpočet kreslí systém (`Text(timerInterval:)` / `setUsesChronometer`).

---

### Task 1: JS wrapper `restLiveActivity.ts`

**Files:**
- Create: `src/lib/restLiveActivity.ts`

**Interfaces:**
- Produces (používají Tasky 5 a 6):
  - `startRestActivity(o: { exerciseName: string; nextSetText: string; endsAt: number; totalSeconds: number }): Promise<void>` — `endsAt` = epoch ms
  - `updateRestActivity(o: { nextSetText?: string; endsAt: number; totalSeconds: number }): Promise<void>`
  - `endRestActivity(): Promise<void>`
- Consumes: nic (jen `@capacitor/core`)

- [ ] **Step 1: Napsat wrapper**

```ts
// src/lib/restLiveActivity.ts
import { Capacitor, registerPlugin } from '@capacitor/core';

// Lock-screen rest widget: iOS Live Activity (16.2+) / Android ongoing
// notification with a system chronometer. The native side draws the countdown
// itself, so JS only calls start/update/end on rest lifecycle changes.
// All methods are silent no-ops on web and when the native plugin is missing
// or the user disabled Live Activities / notifications.
interface RestActivityPlugin {
  start(options: { exerciseName: string; nextSetText: string; endsAt: number; totalSeconds: number }): Promise<void>;
  update(options: { nextSetText?: string; endsAt: number; totalSeconds: number }): Promise<void>;
  end(): Promise<void>;
}

const RestActivity = registerPlugin<RestActivityPlugin>('RestActivity');

export async function startRestActivity(options: { exerciseName: string; nextSetText: string; endsAt: number; totalSeconds: number }): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await RestActivity.start(options); } catch { /* plugin missing / disabled → noop */ }
}

export async function updateRestActivity(options: { nextSetText?: string; endsAt: number; totalSeconds: number }): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await RestActivity.update(options); } catch { /* noop */ }
}

export async function endRestActivity(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await RestActivity.end(); } catch { /* noop */ }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd ~/pumplo && npx tsc -p tsconfig.app.json --noEmit`
Expected: bez chyb

- [ ] **Step 3: Commit**

```bash
git add src/lib/restLiveActivity.ts
git commit -m "feat(rest-widget): JS wrapper for RestActivity plugin (F13)"
```

---

### Task 2: Android plugin — ongoing notifikace s chronometrem

**Files:**
- Create: `android/app/src/main/java/com/pumplo/app/RestActivityPlugin.java`
- Modify: `android/app/src/main/java/com/pumplo/app/MainActivity.java` (registrace)

**Interfaces:**
- Consumes: JS volání `start/update/end` z Tasku 1 (options viz Task 1).
- Produces: nativní notifikaci ID 9912, kanál `pumplo_rest_live`.

- [ ] **Step 1: Napsat plugin**

```java
// android/app/src/main/java/com/pumplo/app/RestActivityPlugin.java
package com.pumplo.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Ongoing rest-timer notification: system-drawn countdown chronometer with the
// current exercise + next set. Silent by design — the audible rest-end alert
// stays with the existing local notification (channel pumplo_rest, id 9911).
@CapacitorPlugin(name = "RestActivity")
public class RestActivityPlugin extends Plugin {

    private static final int NOTIF_ID = 9912;
    private static final String CHANNEL_ID = "pumplo_rest_live";
    private boolean channelEnsured = false;

    @PluginMethod
    public void start(PluginCall call) { show(call); }

    @PluginMethod
    public void update(PluginCall call) { show(call); }

    @PluginMethod
    public void end(PluginCall call) {
        NotificationManagerCompat.from(getContext()).cancel(NOTIF_ID);
        call.resolve();
    }

    private void show(PluginCall call) {
        Context ctx = getContext();
        NotificationManagerCompat mgr = NotificationManagerCompat.from(ctx);
        if (!mgr.areNotificationsEnabled()) { call.resolve(); return; }
        ensureChannel(ctx);

        Double endsAt = call.getDouble("endsAt");
        if (endsAt == null) { call.resolve(); return; }
        String exerciseName = call.getString("exerciseName", "");
        String nextSetText = call.getString("nextSetText", "");

        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        PendingIntent tap = launch == null ? null : PendingIntent.getActivity(
                ctx, 9912, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(ctx.getApplicationInfo().icon)
                .setContentTitle(exerciseName)
                .setContentText(nextSetText)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setShowWhen(true)
                .setWhen((long) (double) endsAt)
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        if (tap != null) b.setContentIntent(tap);

        try { mgr.notify(NOTIF_ID, b.build()); } catch (SecurityException ignored) { }
        call.resolve();
    }

    private void ensureChannel(Context ctx) {
        if (channelEnsured || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) { channelEnsured = true; return; }
        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "Odpočet pauzy", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Průběžný odpočet pauzy mezi sériemi");
        ch.setSound(null, null);
        ch.enableVibration(false);
        ((NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(ch);
        channelEnsured = true;
    }
}
```

- [ ] **Step 2: Registrace v MainActivity**

V `android/app/src/main/java/com/pumplo/app/MainActivity.java` přidat řádek NAD stávající `registerPlugin(InstagramSharePlugin.class);`:

```java
        registerPlugin(RestActivityPlugin.class);
```

- [ ] **Step 3: Ověřit kompilaci**

Run: `cd ~/pumplo && npx cap sync android && cd android && ./gradlew :app:compileDebugJavaWithJavac -q && cd ..`
Expected: BUILD SUCCESSFUL (bez chyb kompilace)

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/pumplo/app/RestActivityPlugin.java android/app/src/main/java/com/pumplo/app/MainActivity.java
git commit -m "feat(rest-widget): Android ongoing chronometer notification (F13)"
```

---

### Task 3: iOS plugin + ActivityAttributes + Info.plist

**Files:**
- Create: `ios/App/App/RestActivityAttributes.swift`
- Create: `ios/App/App/RestActivityPlugin.swift`
- Modify: `ios/App/App/MainViewController.swift` (registrace)
- Modify: `ios/App/App/Info.plist` (`NSSupportsLiveActivities`)

**Interfaces:**
- Consumes: JS volání z Tasku 1 (`endsAt` epoch **ms**).
- Produces: `RestActivityAttributes` (+ `ContentState { endsAt, startedAt, exerciseName, nextSetText }`) — Task 4 (widget) na něm staví UI. Vše proměnlivé je v ContentState, takže jedna aktivita přežije víc restů (update místo start/end).

- [ ] **Step 1: Attributes (sdílený soubor s widgetem)**

```swift
// ios/App/App/RestActivityAttributes.swift
import Foundation
#if canImport(ActivityKit)
import ActivityKit

// Shared between the app target and the PumploWidgets extension (tick BOTH
// target memberships in Xcode). Everything that changes between rests lives in
// ContentState so one activity spans the whole workout via update().
@available(iOS 16.2, *)
struct RestActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var startedAt: Date
        var endsAt: Date
        var exerciseName: String
        var nextSetText: String
    }
}
#endif
```

- [ ] **Step 2: Plugin**

```swift
// ios/App/App/RestActivityPlugin.swift
import Foundation
import Capacitor
#if canImport(ActivityKit)
import ActivityKit
#endif

// Lock-screen Live Activity for the rest timer. The system renders the
// countdown (Text(timerInterval:)) so we only push updates on rest lifecycle
// changes. Silent no-op below iOS 16.2 or when the user disabled Live
// Activities.
@objc(RestActivityPlugin)
public class RestActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RestActivityPlugin"
    public let jsName = "RestActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise)
    ]

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { call.resolve(); return }
        let state = RestActivityPlugin.contentState(from: call)
        Task {
            if let existing = Activity<RestActivityAttributes>.activities.first {
                await existing.update(ActivityContent(state: state, staleDate: state.endsAt.addingTimeInterval(180)))
            } else {
                _ = try? Activity<RestActivityAttributes>.request(
                    attributes: RestActivityAttributes(),
                    content: ActivityContent(state: state, staleDate: state.endsAt.addingTimeInterval(180)))
            }
            call.resolve()
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        Task {
            guard let activity = Activity<RestActivityAttributes>.activities.first else { call.resolve(); return }
            var state = activity.content.state
            let endsAtMs = call.getDouble("endsAt") ?? state.endsAt.timeIntervalSince1970 * 1000
            state.endsAt = Date(timeIntervalSince1970: endsAtMs / 1000)
            if let next = call.getString("nextSetText") { state.nextSetText = next }
            await activity.update(ActivityContent(state: state, staleDate: state.endsAt.addingTimeInterval(180)))
            call.resolve()
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        Task {
            for activity in Activity<RestActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve()
        }
    }

    @available(iOS 16.2, *)
    private static func contentState(from call: CAPPluginCall) -> RestActivityAttributes.ContentState {
        let endsAtMs = call.getDouble("endsAt") ?? Date().timeIntervalSince1970 * 1000
        let totalSeconds = call.getDouble("totalSeconds") ?? 0
        let endsAt = Date(timeIntervalSince1970: endsAtMs / 1000)
        return RestActivityAttributes.ContentState(
            startedAt: endsAt.addingTimeInterval(-max(totalSeconds, 1)),
            endsAt: endsAt,
            exerciseName: call.getString("exerciseName") ?? "",
            nextSetText: call.getString("nextSetText") ?? "")
    }
}
```

- [ ] **Step 3: Registrace + Info.plist**

`ios/App/App/MainViewController.swift` — do `capacitorDidLoad()` přidat:

```swift
        bridge?.registerPluginInstance(RestActivityPlugin())
```

`ios/App/App/Info.plist` — přidat do root `<dict>` (např. hned za `UIBackgroundModes` blok):

```xml
	<key>NSSupportsLiveActivities</key>
	<true/>
```

- [ ] **Step 4: Přidat soubory do Xcode projektu a ověřit build**

Nové .swift soubory musí být v app targetu. Přes `xcodebuild` to nejde — buď je přidá David v Xcode (drag do skupiny App, target App), nebo ověřit, zda projekt používá filesystem-synchronized groups (Xcode 16 default u nových projektů — pokud ano, soubory se přidají samy).

Run: `cd ~/pumplo/ios/App && xcodebuild -project App.xcodeproj -scheme App -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build 2>&1 | tail -5`
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 5: Commit**

```bash
git add ios/App/App/RestActivityAttributes.swift ios/App/App/RestActivityPlugin.swift ios/App/App/MainViewController.swift ios/App/App/Info.plist ios/App/App.xcodeproj
git commit -m "feat(rest-widget): iOS RestActivity plugin + ActivityKit attributes (F13)"
```

---

### Task 4: Widget extension `PumploWidgets` (Live Activity UI)

**Files:**
- Create (Xcode template → nahradit): `ios/App/PumploWidgets/PumploWidgetsBundle.swift`
- Manuální krok v Xcode (David): nový target

**Interfaces:**
- Consumes: `RestActivityAttributes` z Tasku 3 (target membership: App + PumploWidgets).
- Produces: lock-screen UI + Dynamic Island. Nic pro další tasky.

- [ ] **Step 1: MANUÁLNÍ (David v Xcode, ~5 min)**

1. Otevřít `ios/App/App.xcodeproj` v Xcode.
2. File → New → Target… → **Widget Extension**, Product Name: `PumploWidgets`, **odškrtnout** „Include Configuration App Intent", zaškrtnout „Include Live Activity" (pokud dialog nabízí). Activate scheme: ano.
3. Target `PumploWidgets` → General → Minimum Deployments: **iOS 16.2**.
4. Smazat vygenerované template soubory kromě `PumploWidgetsBundle.swift` (a `Info.plist` extensionu nechat).
5. Vybrat `App/RestActivityAttributes.swift` → File Inspector → Target Membership: zaškrtnout **App i PumploWidgets**.
6. Signing extensionu: stejný tým jako App (automatic signing si vyrobí profil sám).

- [ ] **Step 2: Nahradit obsah `PumploWidgetsBundle.swift`**

```swift
// ios/App/PumploWidgets/PumploWidgetsBundle.swift
import WidgetKit
import SwiftUI
import ActivityKit

@main
struct PumploWidgetsBundle: WidgetBundle {
    var body: some Widget {
        RestActivityWidget()
    }
}

private let pumploCyan = Color(red: 0x4C / 255, green: 0xC9 / 255, blue: 0xFF / 255)

struct RestActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestActivityAttributes.self) { context in
            // Lock screen / banner
            LockScreenRestView(state: context.state)
                .activityBackgroundTint(Color.black.opacity(0.85))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.exerciseName)
                        .font(.caption).bold().foregroundColor(.white)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: true)
                        .font(.caption).bold().monospacedDigit()
                        .foregroundColor(pumploCyan)
                        .frame(width: 50)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 6) {
                        Text(context.state.nextSetText)
                            .font(.caption2).foregroundColor(.gray).lineLimit(1)
                        ProgressView(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: false)
                            .progressViewStyle(.linear).tint(pumploCyan).labelsHidden()
                    }
                }
            } compactLeading: {
                Image(systemName: "figure.strengthtraining.traditional")
                    .foregroundColor(pumploCyan)
            } compactTrailing: {
                Text(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: true)
                    .font(.caption2).monospacedDigit().foregroundColor(pumploCyan)
                    .frame(width: 40)
            } minimal: {
                Image(systemName: "timer").foregroundColor(pumploCyan)
            }
        }
    }
}

struct LockScreenRestView: View {
    let state: RestActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "figure.strengthtraining.traditional")
                    .foregroundColor(pumploCyan)
                Text("Pumplo").font(.caption).bold().foregroundColor(.white.opacity(0.7))
                Spacer()
                Text(timerInterval: state.startedAt...state.endsAt, countsDown: true)
                    .font(.title2).bold().monospacedDigit()
                    .foregroundColor(pumploCyan)
                    .frame(maxWidth: 70)
            }
            Text(state.exerciseName)
                .font(.headline).foregroundColor(.white).lineLimit(1)
            if !state.nextSetText.isEmpty {
                Text(state.nextSetText)
                    .font(.subheadline).foregroundColor(.white.opacity(0.6)).lineLimit(1)
            }
            ProgressView(timerInterval: state.startedAt...state.endsAt, countsDown: false)
                .progressViewStyle(.linear).tint(pumploCyan).labelsHidden()
        }
        .padding(14)
    }
}
```

- [ ] **Step 3: Build na zařízení**

Run (nebo Xcode ⌘B): `cd ~/pumplo/ios/App && xcodebuild -project App.xcodeproj -scheme App -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build 2>&1 | tail -5`
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 4: Commit**

```bash
git add ios/App/PumploWidgets ios/App/App.xcodeproj
git commit -m "feat(rest-widget): PumploWidgets extension - lock screen + Dynamic Island (F13)"
```

---

### Task 5: Napojení na rest bar v LogWorkoutView

**Files:**
- Modify: `src/components/workout/LogWorkoutView.tsx` (funkce `startRest` ~ř. 185, `adjustRest` ~ř. 191, `skipRest` ~ř. 200, rest effect ~ř. 202–230, `toggleSet` ~ř. 270–290)
- Modify: `src/i18n/locales/cs.ts`, `src/i18n/locales/en.ts` (klíč `log_workout.next_set`)

**Interfaces:**
- Consumes: `startRestActivity`, `updateRestActivity`, `endRestActivity` z Tasku 1.
- Produces: nic pro další tasky.

- [ ] **Step 1: i18n klíče**

Do `cs.ts` vedle ostatních `log_workout.*` klíčů:

```ts
  'log_workout.next_set': 'Další: série {{num}} z {{total}}',
  'log_workout.next_exercise': 'Další cvik: {{name}}',
  'log_workout.workout_done_next': 'Poslední série ✅',
```

Do `en.ts`:

```ts
  'log_workout.next_set': 'Next: set {{num}} of {{total}}',
  'log_workout.next_exercise': 'Next exercise: {{name}}',
  'log_workout.workout_done_next': 'Last set ✅',
```

- [ ] **Step 2: Import + helper `nextSetText`**

Import nahoru do `LogWorkoutView.tsx`:

```ts
import { startRestActivity, updateRestActivity, endRestActivity } from '@/lib/restLiveActivity';
```

Helper vedle `toggleSet` (používá existující `rowCount`, `inputs`, `exName`, `t`):

```ts
  // Text for the lock-screen widget: what comes after the rest ends.
  const nextSetText = (idx: number, si: number): string => {
    const total = rowCount(idx);
    if (si + 1 < total) {
      const inp = inputs[`${idx}-${si + 1}`];
      const detail = inp?.w && inp?.r ? ` (${inp.w} kg × ${inp.r})` : '';
      return t('log_workout.next_set', { num: si + 2, total }) + detail;
    }
    const nextEx = exercises[idx + 1];
    if (nextEx) return t('log_workout.next_exercise', { name: exName(nextEx) });
    return t('log_workout.workout_done_next');
  };
```

- [ ] **Step 3: Napojit lifecycle**

`startRest` — přidat parametr s kontextem a volání pluginu:

```ts
  const startRest = (seconds: number, ctx?: { exerciseName: string; nextText: string }) => {
    if (seconds <= 0) return;
    restEndRef.current = Date.now() + seconds * 1000;
    restBeeps.current = { b3: false, b2: false, b1: false, done: false };
    setRest({ total: seconds, remaining: seconds });
    startRestActivity({
      exerciseName: ctx?.exerciseName ?? '',
      nextSetText: ctx?.nextText ?? '',
      endsAt: restEndRef.current,
      totalSeconds: seconds,
    });
  };
```

V `toggleSet` změnit volání `startRest(restSec);` na:

```ts
      startRest(restSec, { exerciseName: exName(ex), nextText: nextSetText(idx, si) });
```

`adjustRest` — na konec funkce přidat:

```ts
    updateRestActivity({ endsAt: restEndRef.current, totalSeconds: rest.total });
```

`skipRest` — přidat `endRestActivity();`:

```ts
  const skipRest = () => { stopRestBeeps(); restNativeRef.current = false; setRest(null); endRestActivity(); };
```

V rest effectu (tick): kde `remaining <= 0 && !b.done` končí rest, přidat `endRestActivity();` za `setRest(null);`. A do cleanup returnu efektu přidat `endRestActivity();` (pokrývá unmount = dokončení/minimalizace tréninku):

```ts
    return () => { cancelled = true; clearInterval(iv); document.removeEventListener('visibilitychange', onVis); endRestActivity(); };
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run build`
Expected: bez chyb

- [ ] **Step 5: Commit**

```bash
git add src/components/workout/LogWorkoutView.tsx src/i18n/locales/cs.ts src/i18n/locales/en.ts
git commit -m "feat(rest-widget): wire Live Activity into Log Workout rest bar (F13)"
```

---

### Task 6: Napojení na klasický RestTimer

**Files:**
- Modify: `src/components/workout/RestTimer.tsx` (mount effect ~ř. 60–80, skip handler, restart handler ~ř. 135–141)

**Interfaces:**
- Consumes: `startRestActivity`, `updateRestActivity`, `endRestActivity` z Tasku 1; existující props `duration`, `nextExerciseName`, `label`.

- [ ] **Step 1: Import + lifecycle**

Import:

```ts
import { startRestActivity, endRestActivity } from '@/lib/restLiveActivity';
```

V hlavním effectu, hned vedle stávajícího `scheduleRestEndNotification(remaining, ...)` (ř. ~74) přidat:

```ts
    startRestActivity({
      exerciseName: nextExerciseName || label || t('workout.rest'),
      nextSetText: nextExerciseName ? t('log_workout.next_exercise', { name: nextExerciseName }) : '',
      endsAt: Date.now() + remaining * 1000,
      totalSeconds: remaining,
    });
```

Do cleanup returnu téhož efektu (ř. ~75, vedle `cancelRestEndNotification()`) přidat `endRestActivity();`.

V restart handleru (ř. ~139–140, kde se volá `cancelRestEndNotification(); scheduleRestEndNotification(duration, ...)`) přidat za ně:

```ts
    startRestActivity({
      exerciseName: nextExerciseName || label || t('workout.rest'),
      nextSetText: '',
      endsAt: Date.now() + duration * 1000,
      totalSeconds: duration,
    });
```

A v místě, kde timer doběhne v aplikaci (ř. ~98, `cancelRestEndNotification(); // finished in-app`) přidat `endRestActivity();`.

- [ ] **Step 2: Typecheck + build, commit**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run build`

```bash
git add src/components/workout/RestTimer.tsx
git commit -m "feat(rest-widget): wire Live Activity into classic RestTimer (F13)"
```

---

### Task 7: Sdílená utilita `muscleDistribution.ts` + refaktor LogWorkoutView

**Files:**
- Create: `src/lib/muscleDistribution.ts`
- Modify: `src/components/workout/LogWorkoutView.tsx` (useMemo `muscleDist` ~ř. 244–262)

**Interfaces:**
- Consumes: `groupForMuscle` z `@/lib/muscleGroups`.
- Produces (používá Task 9 a LogWorkoutView):
  - `computeMuscleDistribution(items: { primaryMuscles: string[]; secondaryMuscles: string[]; completedSets: number }[]): { key: string | null; raw: string; value: number }[]` — seřazené sestupně, `key` = groupKey nebo null (raw sval), `raw` = původní název svalu prvního výskytu
  - `muscleIntensities(dist: ReturnType<typeof computeMuscleDistribution>): Record<string, number>` — jen položky s `key`, normalizované 0–1

- [ ] **Step 1: Utilita**

```ts
// src/lib/muscleDistribution.ts
import { groupForMuscle } from '@/lib/muscleGroups';

// Hevy-style muscle distribution: primary muscle = 1 point per completed set,
// secondary = 0.5. Grouped by MUSCLE_GROUPS keys; unmatched raw muscle names
// keep their own bucket (key: null) so the caller can label them directly.
export interface MuscleDistItem {
  primaryMuscles: string[];
  secondaryMuscles: string[];
  completedSets: number;
}

export interface MuscleDistEntry { key: string | null; raw: string; value: number }

export function computeMuscleDistribution(items: MuscleDistItem[]): MuscleDistEntry[] {
  const buckets = new Map<string, MuscleDistEntry>();
  const add = (muscle: string, amount: number) => {
    const gk = groupForMuscle(muscle);
    const bucketKey = gk ?? 'raw:' + muscle;
    const cur = buckets.get(bucketKey) || { key: gk, raw: muscle, value: 0 };
    cur.value += amount;
    buckets.set(bucketKey, cur);
  };
  items.forEach(it => {
    if (!it.completedSets) return;
    it.primaryMuscles.forEach(m => add(m, it.completedSets));
    it.secondaryMuscles.forEach(m => add(m, it.completedSets * 0.5));
  });
  return [...buckets.values()].filter(b => b.value > 0).sort((a, b) => b.value - a.value);
}

// Normalised 0–1 intensity per GROUP key (raw-only buckets dropped) — feeds
// the MuscleBodySvg highlight.
export function muscleIntensities(dist: MuscleDistEntry[]): Record<string, number> {
  const max = dist[0]?.value || 1;
  const out: Record<string, number> = {};
  dist.forEach(d => { if (d.key) out[d.key] = Math.max(out[d.key] ?? 0, d.value / max); });
  return out;
}
```

- [ ] **Step 2: Refaktor LogWorkoutView**

Nahradit tělo useMemo `muscleDist` (ř. 244–262) — zachovat identické chování (label logika zůstává v komponentě):

```ts
  const muscleDist = useMemo(() => {
    const dist = computeMuscleDistribution(exercises.map((ex, idx) => ({
      primaryMuscles: ex.primary_muscles,
      secondaryMuscles: ex.secondary_muscles,
      completedSets: (completedSetsMap.get(idx) || []).filter(s => s.completed).length,
    })));
    return dist.map(d => ({
      label: d.key ? t(`custom_plan.muscle_${d.key}`) : translateMuscle(d.raw, isEn),
      value: d.value,
    }));
  }, [exercises, completedSetsMap, isEn, t]);
```

Import: `import { computeMuscleDistribution } from '@/lib/muscleDistribution';` a smazat nepoužitý import `groupForMuscle`, pokud už není potřeba jinde v souboru.

POZOR na drobný rozdíl: původní kód sléval raw svaly podle PŘELOŽENÉHO názvu (`'raw:' + translateMuscle(...)`), nový podle původního — dva různé raw názvy se stejným překladem se teď zobrazí zvlášť. To je přijatelné (přesnější), jen to zmínit v commit message.

- [ ] **Step 3: Typecheck + build, commit**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run build`

```bash
git add src/lib/muscleDistribution.ts src/components/workout/LogWorkoutView.tsx
git commit -m "refactor(workout): extract shared muscle distribution util (F13)"
```

---

### Task 8: Komponenta `MuscleBodySvg`

**Files:**
- Create: `src/components/workout/MuscleBodySvg.tsx`

**Interfaces:**
- Consumes: nic.
- Produces (používá Task 9): `MuscleBodySvg({ intensities, side, width }: { intensities: Record<string, number>; side: 'front' | 'back'; width?: number })` — klíče = MUSCLE_GROUPS keys (`chest, back, shoulders, biceps, triceps, legs, glutes, calves, core, arms`), hodnoty 0–1.

- [ ] **Step 1: Komponenta**

Stylizovaná postavička (viewBox 0 0 100 220). Region se vybarví cyanem s opacitou `0.25 + 0.75 * intensity`; neprocvičené regiony šedě.

```tsx
// src/components/workout/MuscleBodySvg.tsx

// Stylised front/back body figure with per-muscle-group highlight, Hevy-style.
// Keys follow MUSCLE_GROUPS (src/lib/muscleGroups.ts). Deliberately standalone
// so it can be reused on exercise detail / statistics later.
interface MuscleBodySvgProps {
  intensities: Record<string, number>; // group key -> 0..1
  side: 'front' | 'back';
  width?: number;
}

const BASE = 'rgba(255,255,255,0.10)';
const fillFor = (intensities: Record<string, number>, key: string) => {
  const v = intensities[key];
  if (!v || v <= 0) return BASE;
  return `rgba(76, 201, 255, ${(0.25 + 0.75 * Math.min(v, 1)).toFixed(2)})`;
};

export const MuscleBodySvg = ({ intensities, side, width = 110 }: MuscleBodySvgProps) => {
  const f = (key: string) => fillFor(intensities, key);
  const outline = 'rgba(255,255,255,0.25)';

  return (
    <svg width={width} viewBox="0 0 100 220" fill="none">
      {/* head + neck (never highlighted) */}
      <circle cx="50" cy="14" r="9" fill={BASE} stroke={outline} strokeWidth="1" />
      <rect x="46" y="23" width="8" height="7" rx="2" fill={BASE} />

      {side === 'front' ? (
        <g stroke={outline} strokeWidth="0.75">
          {/* shoulders */}
          <ellipse cx="29" cy="38" rx="8" ry="6" fill={f('shoulders')} />
          <ellipse cx="71" cy="38" rx="8" ry="6" fill={f('shoulders')} />
          {/* chest */}
          <path d="M36 36 h28 v14 a14 8 0 0 1 -28 0 z" fill={f('chest')} />
          {/* biceps */}
          <ellipse cx="24" cy="55" rx="5.5" ry="10" fill={f('biceps')} />
          <ellipse cx="76" cy="55" rx="5.5" ry="10" fill={f('biceps')} />
          {/* forearms (arms) */}
          <ellipse cx="21" cy="76" rx="4.5" ry="11" fill={f('arms')} />
          <ellipse cx="79" cy="76" rx="4.5" ry="11" fill={f('arms')} />
          {/* core */}
          <rect x="39" y="54" width="22" height="26" rx="6" fill={f('core')} />
          {/* quads (legs) */}
          <ellipse cx="41" cy="106" rx="8" ry="22" fill={f('legs')} />
          <ellipse cx="59" cy="106" rx="8" ry="22" fill={f('legs')} />
          {/* shins (not highlighted from front) */}
          <ellipse cx="42" cy="155" rx="5.5" ry="20" fill={BASE} />
          <ellipse cx="58" cy="155" rx="5.5" ry="20" fill={BASE} />
        </g>
      ) : (
        <g stroke={outline} strokeWidth="0.75">
          {/* rear shoulders */}
          <ellipse cx="29" cy="38" rx="8" ry="6" fill={f('shoulders')} />
          <ellipse cx="71" cy="38" rx="8" ry="6" fill={f('shoulders')} />
          {/* back (traps + lats as one region) */}
          <path d="M36 34 h28 l-2 30 a12 10 0 0 1 -24 0 z" fill={f('back')} />
          {/* triceps */}
          <ellipse cx="24" cy="55" rx="5.5" ry="10" fill={f('triceps')} />
          <ellipse cx="76" cy="55" rx="5.5" ry="10" fill={f('triceps')} />
          {/* forearms (arms) */}
          <ellipse cx="21" cy="76" rx="4.5" ry="11" fill={f('arms')} />
          <ellipse cx="79" cy="76" rx="4.5" ry="11" fill={f('arms')} />
          {/* glutes */}
          <ellipse cx="43" cy="86" rx="9" ry="8" fill={f('glutes')} />
          <ellipse cx="57" cy="86" rx="9" ry="8" fill={f('glutes')} />
          {/* hamstrings (legs) */}
          <ellipse cx="41" cy="115" rx="8" ry="19" fill={f('legs')} />
          <ellipse cx="59" cy="115" rx="8" ry="19" fill={f('legs')} />
          {/* calves */}
          <ellipse cx="42" cy="155" rx="5.5" ry="18" fill={f('calves')} />
          <ellipse cx="58" cy="155" rx="5.5" ry="18" fill={f('calves')} />
        </g>
      )}
    </svg>
  );
};
```

- [ ] **Step 2: Vizuální kontrola na webu**

Run: `npm run dev` a dočasně vyrenderovat `<MuscleBodySvg intensities={{ chest: 1, shoulders: 0.5, triceps: 0.3 }} side="front" />` např. na Home; zkontrolovat, upravit tvary dle potřeby, dočasný render zase odstranit.
Expected: rozpoznatelná postavička, prsa nejsytější.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/components/workout/MuscleBodySvg.tsx
git commit -m "feat(share): MuscleBodySvg body-highlight component (F13)"
```

---

### Task 9: Šablony T_MuscleMap + T_FunFact a zapojení do karuselu

**Files:**
- Modify: `src/components/workout/WorkoutShareCard.tsx` (props ~ř. 19–26, šablony za `T_SingleExercise`, `TEMPLATE_NAMES` ř. 252, `renderTemplate` ~ř. 489–498, tap-cycle ~ř. 404)
- Modify: `src/pages/CustomWorkoutPlayer.tsx` (`ShareCacheData` + cache useMemo ~ř. 235–258, render `WorkoutShareCard` ~ř. 1143–1166)
- Modify: `src/i18n/locales/cs.ts`, `src/i18n/locales/en.ts`

**Interfaces:**
- Consumes: `MuscleBodySvg` (Task 8), `muscleIntensities`/`computeMuscleDistribution` (Task 7).
- Produces: nová optional prop `muscleIntensities?: Record<string, number>` na `WorkoutShareCardProps` — `WorkoutSession.tsx` ji neposílá (karta se tam prostě nezobrazí), to je záměr.

- [ ] **Step 1: i18n klíče**

`cs.ts` (sekce workout_share):

```ts
  'workout_share.muscles_title': 'Procvičené svaly',
  'workout_share.funfact_lifted': 'Zvedl jsi celkem',
  'workout_share.funfact_dog': 'To je jako zvednout psa!',
  'workout_share.funfact_motorbike': 'To je jako zvednout motorku!',
  'workout_share.funfact_horse': 'To je jako zvednout koně!',
  'workout_share.funfact_car': 'To je jako zvednout auto!',
  'workout_share.funfact_rhino': 'To je jako zvednout nosorožce!',
  'workout_share.funfact_elephant': 'To je jako zvednout slona!',
  'workout_share.funfact_bus': 'To je jako zvednout autobus!',
  'workout_share.funfact_whale': 'To je jako zvednout velrybu!',
```

`en.ts`:

```ts
  'workout_share.muscles_title': 'Muscles worked',
  'workout_share.funfact_lifted': 'You lifted a total of',
  'workout_share.funfact_dog': "That's like lifting a dog!",
  'workout_share.funfact_motorbike': "That's like lifting a motorbike!",
  'workout_share.funfact_horse': "That's like lifting a horse!",
  'workout_share.funfact_car': "That's like lifting a car!",
  'workout_share.funfact_rhino': "That's like lifting a rhino!",
  'workout_share.funfact_elephant': "That's like lifting an elephant!",
  'workout_share.funfact_bus': "That's like lifting a bus!",
  'workout_share.funfact_whale': "That's like lifting a whale!",
```

- [ ] **Step 2: Šablony ve WorkoutShareCard**

Import nahoru: `import { MuscleBodySvg } from './MuscleBodySvg';`

Za `T_SingleExercise` přidat:

```tsx
// 6. Muscle map — front + back body figures with highlighted groups
const T_MuscleMap = ({ photo, title, gym, gymIg, date, exCount, reps, transform, exercisesLabel, repsLabel, muscles, musclesTitle }: TProps & { muscles: Record<string, number>; musclesTitle: string }) => (
  <>
    <BG photo={photo} gradient="linear-gradient(135deg, #0B1222 0%, #16213e 100%)" />
    <Overlay photo={photo} />
    <Center>
      <Draggable transform={transform}>
        <div className="rounded-2xl px-5 py-4 mb-3" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', maxWidth: '320px', width: '100%' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', textAlign: 'center' }}>{musclesTitle}</p>
          <div className="flex justify-center gap-6">
            <MuscleBodySvg intensities={muscles} side="front" width={104} />
            <MuscleBodySvg intensities={muscles} side="back" width={104} />
          </div>
        </div>
        <TitleBar title={title} gym={gym} gymIg={gymIg} date={date} exCount={exCount} reps={reps} bg="rgba(0,0,0,0.5)" exercisesLabel={exercisesLabel} repsLabel={repsLabel} />
      </Draggable>
    </Center>
  </>
);

// 7. Fun fact — total volume compared to a real-world thing (Hevy elephant)
const FUNFACT_TIERS: { min: number; key: string; emoji: string }[] = [
  { min: 30000, key: 'whale', emoji: '🐋' },
  { min: 12000, key: 'bus', emoji: '🚌' },
  { min: 6000, key: 'elephant', emoji: '🐘' },
  { min: 3000, key: 'rhino', emoji: '🦏' },
  { min: 1500, key: 'car', emoji: '🚗' },
  { min: 700, key: 'horse', emoji: '🐎' },
  { min: 200, key: 'motorbike', emoji: '🏍️' },
  { min: 50, key: 'dog', emoji: '🐕' },
];
export const funFactTier = (kg: number) => FUNFACT_TIERS.find(t => kg >= t.min) ?? null;

const T_FunFact = ({ photo, gym, gymIg, title, date, exCount, reps, transform, exercisesLabel, repsLabel, totalKg, liftedLabel, factText, emoji }: TProps & { totalKg: number; liftedLabel: string; factText: string; emoji: string }) => (
  <>
    <BG photo={photo} gradient="linear-gradient(160deg, #0B1222 0%, #0f3460 100%)" />
    <Overlay photo={photo} />
    <Center>
      <Draggable transform={transform}>
        <div className="rounded-2xl px-6 py-6 mb-3 text-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', maxWidth: '320px', width: '100%' }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '4px' }}>{liftedLabel}</p>
          <p style={{ color: '#fff', fontSize: '40px', fontWeight: 800, lineHeight: 1.1 }}>{Math.round(totalKg).toLocaleString('cs')} kg</p>
          <p style={{ color: '#4CC9FF', fontSize: '15px', fontWeight: 600, marginTop: '8px' }}>{factText}</p>
          <p style={{ fontSize: '72px', lineHeight: 1.3 }}>{emoji}</p>
        </div>
        <TitleBar title={title} gym={gym} gymIg={gymIg} date={date} exCount={exCount} reps={reps} bg="rgba(0,0,0,0.5)" exercisesLabel={exercisesLabel} repsLabel={repsLabel} />
      </Draggable>
    </Center>
  </>
);
```

- [ ] **Step 3: Dynamický seznam šablon**

Do `WorkoutShareCardProps` přidat: `muscleIntensities?: Record<string, number>;` a do destrukturace v komponentě přidat `muscleIntensities`.

Smazat konstantu `TEMPLATE_NAMES` (ř. 252). V těle komponenty (za výpočet `tp`) definovat:

```tsx
  const fact = funFactTier(totalWeight);
  const hasMuscles = !!muscleIntensities && Object.keys(muscleIntensities).length > 0;

  const templates: (() => JSX.Element)[] = [
    () => <T_DarkBlur {...tp} />,
    () => <T_Minimal {...tp} />,
    () => <T_Bold {...tp} />,
    () => <T_ExerciseList {...tp} exercises={exerciseDetails} />,
    () => <T_SingleExercise {...tp} exercises={exerciseDetails} selectedEx={selectedEx} onSelectEx={setSelectedEx} />,
    ...(hasMuscles ? [() => <T_MuscleMap {...tp} muscles={muscleIntensities!} musclesTitle={t('workout_share.muscles_title')} />] : []),
    ...(fact ? [() => <T_FunFact {...tp} totalKg={totalWeight} liftedLabel={t('workout_share.funfact_lifted')} factText={t(`workout_share.funfact_${fact.key}`)} emoji={fact.emoji} />] : []),
  ];
```

Nahradit `renderTemplate` za `templates[templateIndex % templates.length]()` a v tap-cycle handleru (ř. ~404) nahradit `TEMPLATE_NAMES.length` za `templates.length` — POZOR, tap handler žije v useEffectu; nejjednodušší je uložit počet do refu:

```tsx
  const templateCountRef = useRef(5);
  templateCountRef.current = templates.length;
```

a v handleru: `setTemplateIndex(i => (i + 1) % templateCountRef.current);`

- [ ] **Step 4: Poslat data z CustomWorkoutPlayer**

V `src/pages/CustomWorkoutPlayer.tsx`:

Import: `import { computeMuscleDistribution, muscleIntensities } from '@/lib/muscleDistribution';`

Do `interface ShareCacheData` (ř. 161) přidat pole `muscleIntensities?: Record<string, number>;`.

V cache useEffectu (ř. ~239, objekt `cache`) přidat klíč:

```ts
        muscleIntensities: muscleIntensities(computeMuscleDistribution(exercises.map((ex, i) => ({
          primaryMuscles: ex.primary_muscles || [],
          secondaryMuscles: ex.secondary_muscles || [],
          completedSets: (completedSetsMap.get(i) || []).filter(s => s.completed).length,
        })))),
```

V renderu `WorkoutShareCard` (ř. ~1146) přidat prop:

```tsx
        muscleIntensities={sc?.muscleIntensities ?? muscleIntensities(computeMuscleDistribution(exercises.map((ex, i) => ({
          primaryMuscles: ex.primary_muscles || [],
          secondaryMuscles: ex.secondary_muscles || [],
          completedSets: (completedSetsMap.get(i) || []).filter(s => s.completed).length,
        }))))}
```

Ověřeno: typ cviku v CustomWorkoutPlayer `primary_muscles`/`secondary_muscles` má (ř. 45, 61; select ř. 469) — žádná další úprava dat není potřeba.

- [ ] **Step 5: Typecheck + build + vizuální kontrola**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run build`
Expected: bez chyb. Pak `npm run dev` → dokončit testovací trénink ve web preview → projet karusel tapnutím: 7 karet (5 starých + svaly + fun fact), vygenerovaný JPEG obsahuje postavičku (kontrola html2canvas ↔ SVG — riziko č. 2 ze specu; kdyby SVG chybělo v exportu, převést SVG na inline `<img src="data:image/svg+xml,...">`).

- [ ] **Step 6: Commit**

```bash
git add src/components/workout/WorkoutShareCard.tsx src/pages/CustomWorkoutPlayer.tsx src/i18n/locales/cs.ts src/i18n/locales/en.ts
git commit -m "feat(share): muscle map + fun fact share cards (F13)"
```

---

### Task 10: Sync, build, test na zařízeních

**Files:** žádné nové (jen `npx cap sync` artefakty)

- [ ] **Step 1: Sync + web build**

Run: `npm run build && npx cap sync`
Expected: sync OK pro ios i android

- [ ] **Step 2: iOS test (David, fyzický iPhone)**

Xcode → Run na telefonu. Checklist:
1. Spustit vlastní trénink → dokončit sérii → zamknout telefon → **widget na zamčené obrazovce**: název cviku, „Další: série…", odpočet běží, progress bar roste.
2. ±15 s v appce → widget se přizpůsobí. Skip → widget zmizí.
3. Nechat rest doběhnout → widget zmizí, stávající notifikace/beep funguje jako dřív.
4. Dokončit trénink → widget nikde nevisí; share karusel má karty Svaly + Fun fact; sdílení do IG Stories obsahuje postavičku.
5. Dynamic Island (iPhone 14 Pro+, jinak přeskočit): kompaktní odpočet.

- [ ] **Step 3: Android test (emulátor nebo telefon)**

1. Trénink → dokončit sérii → notifikační lišta: **tichá ongoing notifikace** s odpočtem.
2. Skip / doběhnutí → notifikace zmizí. Rest-end alert (zvuk) beze změny.

- [ ] **Step 4: Commit sync artefaktů (pokud nějaké) + handoff poznámka do vaultu**

```bash
git add -A && git status --short   # zkontrolovat, commitnout jen smysluplné změny
git commit -m "chore: cap sync after F13 rest widget + share cards"
```

Aktualizovat handoff `~/Vaults/pumplo/handoffy/2026-07-07 custom-workout-hevy-p1.md` (F13 hotovo → zbývá F18–F20, bump 1.3.0, submit).
