# Watch App — Plán C: Android + Wear OS nativní implementace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Telefonní Capacitor plugin `WatchWorkout` posílá snapshot tréninku přes Wearable Data Layer na hodinky a přijímá zpět akce; nový Gradle modul `wear/` (Kotlin + Compose for Wear OS) zobrazuje aktivní sérii, pauzu a okrajové stavy podle mockupu a ovládá trénink korunkou/bezelem.

**Architecture:** Telefon = zdroj pravdy (web → Capacitor plugin). Stav jde jako **DataItem** na cestě `/pumplo/workout-state` (`DataClient.putDataItem`, pole `json` + `updatedAt`, nejnovější `updatedAt` vyhrává, `setUrgent()` při pauze). Akce z hodinek jdou jako **zpráva** (`MessageClient`) na cestě `/pumplo/action` s kompaktním textovým payloadem, plugin je přeloží a vystrčí do JS přes `notifyListeners("watchAction", …)`. Hodinky odpočítávají pauzu lokálně z `restEndsAt`, takže krátký výpadek spojení nic nerozbije.

**Tech Stack:** Java 21 (modul `:app` — Capacitor plugin), Kotlin 2.2.0 + Jetpack Compose for Wear OS (modul `:wear`), `com.google.android.gms:play-services-wearable`, Gradle 8.14.3 / AGP 8.13.0, JUnit 4 unit testy na obou stranách.

## Global Constraints

- **Nesahat na `src/`** — webový kontrakt je hotový (Plán A) a paralelně běžící Plán B ho dál upravuje. Tento plán mění výhradně `android/**` a `docs/**`.
- Datový kontrakt je daný `src/lib/watchWorkout.ts` a nesmí se měnit: `WatchWorkoutState` = `phase` (`set`|`rest`|`summary`|`idle`), `exerciseName`, `slotCategory`, `setIndex` (0-based), `totalSets`, `targetWeight`, `targetReps`, `repMin`, `repMax`, `rir`, `prevWeight`, `prevReps`, `weightStep` (0.5), `resting`, `restEndsAt` (epoch ms | null), `nextSetLabel`.
- Akce hodinky → web: `logSet{weight,reps}`, `goPrevSet`, `goNextSet`, `skipRest`, `addRest15` — jiné se neposílají.
- Krok váhy **0,5 kg**, krok opakování **1** (parita s Hevy).
- Brand: navy `#0B1222` pozadí, cyan `#4CC9FF` akcent, bold typografie, **české popisky**.
- Plugin musí být **no-op safe**, když nejsou spárované hodinky ani Google Play services (vzor `RestActivityPlugin.java` — vždy `call.resolve()`, chyby spolknout).
- Fyzické Wear OS zařízení **neexistuje** → veškeré UI ověření běží na Wear OS AVD spárovaném s telefonním AVD.
- Prostředí pro každý shell krok (na stroji není `java` ani `adb` v PATH):
  ```bash
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  export PATH="$JAVA_HOME/bin:$HOME/Library/Android/sdk/platform-tools:$HOME/Library/Android/sdk/emulator:$PATH"
  ```

---

## Zjištění z repa (ověřeno čtením, ne odhad)

1. **`:app` NEMÁ Kotlin plugin.** `android/build.gradle` má v `buildscript` jen AGP 8.13.0 + google-services, `android/app/build.gradle` aplikuje pouze `com.android.application`. Nikde v `settings.gradle`, `variables.gradle`, `capacitor.build.gradle` ani `capacitor.settings.gradle` není `kotlin`. Stávající `WatchWorkoutPlugin.kt` (stub z Plánu A) se tedy **nikdy nekompiluje** — je to mrtvý soubor a `registerPlugin(WatchWorkoutPlugin.class)` by v Javě neprošlo.
   → **Rozhodnutí: telefonní plugin přepsat do Javy** (`WatchWorkoutPlugin.java`), `.kt` smazat. Důvody: `:app` je Capacitorem spravovaný Java modul (`MainActivity.java`, `RestActivityPlugin.java`, `InstagramSharePlugin.java`), nepřidáváme kotlin-stdlib do telefonního APK a nezpomalujeme každý `cap sync` build. Kotlin žije jen v novém modulu `:wear`.
   → Důsledek pro build kroky: místo `:app:compileDebugKotlin` (které by neexistovalo) se ověřuje `:app:compileDebugJavaWithJavac`.
2. **Registrace pluginů** je v `android/app/src/main/java/com/pumplo/app/MainActivity.java` **před** `super.onCreate()` — tam přibude `registerPlugin(WatchWorkoutPlugin.class);`.
3. **Gradle:** `variables.gradle` → `minSdkVersion 24`, `compileSdkVersion 36`, `targetSdkVersion 36`; wrapper Gradle 8.14.3; `capacitor.build.gradle` nastavuje Java 21. `settings.gradle` obsahuje jen `:app` + `:capacitor-cordova-android-plugins` + `apply from: 'capacitor.settings.gradle'` — a **není generovaný Capacitorem**, takže `include ':wear'` v něm přežije `npx cap sync`.
4. **Modul `wear/` bude první přídavný Android modul projektu** — Kotlin i Compose classpath se musí do root `buildscript` přidat celé.
5. **Nástroje:** `~/Library/Android/sdk` má `platform-tools/adb` a `emulator`, ale **nemá `cmdline-tools`/`sdkmanager`** → Wear OS system image se instaluje přes Android Studio UI. Existující AVD je jen telefonní (`Medium_Phone…`, API 36.1, google_apis_playstore — má Obchod Play, což je pro párování potřeba).
6. **Popisky slotů** (z `src/components/workout/CompactWorkoutView.tsx` + `src/i18n/locales/cs.ts`): `main`→„Hlavní", `secondary`→„Pomocný", `isolation`→„Izolace", `core_or_compensatory`→„Core", `conditioning`→„Kardio".
7. **Launcher ikony** pro `:wear` lze převzít z `android/app/src/main/res/mipmap-*` (obsahují `ic_launcher.png`, `ic_launcher_round.png`).

---

## Drátový kontrakt (platí pro celý plán)

**Stav telefon → hodinky** — `DataClient`, path `/pumplo/workout-state`, DataMap:

| klíč | typ | obsah |
|---|---|---|
| `json` | String | přesný JSON `WatchWorkoutState` tak, jak přišel z JS (`call.getData()` bez `callbackId`) |
| `updatedAt` | Long | `System.currentTimeMillis()` v okamžiku putu; hodinky zahazují starší než poslední viděný |

`setUrgent()` se nastavuje, když `resting == true` (start/změna pauzy musí dorazit hned). `endState()` DataItem smaže (`deleteDataItems` s wildcard URI) → hodinky spadnou do idle.

**Akce hodinky → telefon** — `MessageClient`, path `/pumplo/action`, payload = UTF-8 text, pole oddělená `|`:

| akce | payload | pozn. |
|---|---|---|
| `logSet` s váhou | `logSet\|40.5\|10` | váha vždy `Locale.US`, jedno desetinné místo |
| `logSet` bez váhy | `logSet\|-\|10` | `-` = `null` (vlastní váha / bodyweight) |
| `goPrevSet` | `goPrevSet` | |
| `goNextSet` | `goNextSet` | |
| `skipRest` | `skipRest` | |
| `addRest15` | `addRest15` | |

Textový formát (ne JSON) je zvolený schválně: kodér i dekodér jsou pak čisté funkce testovatelné obyčejným JUnitem bez `org.json` (ten je v JVM unit testech jen stub, který hází výjimku).

---

## File Structure

**Modul `:app` (Java, telefon):**
- `android/app/src/main/java/com/pumplo/app/WatchAction.java` — **Create.** Neměnný datový nosič akce (`type`, `weight`, `reps`).
- `android/app/src/main/java/com/pumplo/app/WatchActionCodec.java` — **Create.** Čistý dekodér drátového textu → `WatchAction`.
- `android/app/src/main/java/com/pumplo/app/WatchWorkoutPlugin.java` — **Create.** Capacitor plugin: `updateState` (putDataItem + deduplikace), `endState` (delete), `MessageClient` listener → `notifyListeners`.
- `android/app/src/main/java/com/pumplo/app/WatchWorkoutPlugin.kt` — **Delete.** Nekompilovaný stub z Plánu A.
- `android/app/src/main/java/com/pumplo/app/MainActivity.java` — **Modify.** `registerPlugin(WatchWorkoutPlugin.class);`.
- `android/app/src/test/java/com/pumplo/app/WatchActionCodecTest.java` — **Create.** JUnit testy dekodéru.
- `android/app/build.gradle` — **Modify.** `play-services-wearable`.
- `android/variables.gradle` — **Modify.** Verze sdílené `:app` i `:wear`.

**Kořen buildu:**
- `android/build.gradle` — **Modify.** Kotlin + Compose compiler classpath.
- `android/settings.gradle` — **Modify.** `include ':wear'`.

**Modul `:wear` (Kotlin + Compose for Wear OS):**
- `android/wear/build.gradle` — **Create.**
- `android/wear/src/main/AndroidManifest.xml` — **Create.**
- `android/wear/src/main/res/values/strings.xml` — **Create.**
- `android/wear/src/main/res/mipmap-*/` — **Create** (kopie z `:app`).
- `android/wear/src/main/java/com/pumplo/wear/WatchWorkoutState.kt` — **Create.** Data class + čistý parser z `Map`.
- `android/wear/src/main/java/com/pumplo/wear/WatchAction.kt` — **Create.** Sealed class akcí + čistý kodér do drátového textu.
- `android/wear/src/main/java/com/pumplo/wear/Formatting.kt` — **Create.** `formatWeight`, `stepWeight`, `stepReps`, `slotLabel`.
- `android/wear/src/main/java/com/pumplo/wear/RestMath.kt` — **Create.** `remainingSeconds`, `formatClock`, `updatedRestTotal`.
- `android/wear/src/main/java/com/pumplo/wear/WearableRepository.kt` — **Create.** DataClient/MessageClient wiring, `StateFlow<WatchWorkoutState?>`.
- `android/wear/src/main/java/com/pumplo/wear/WatchHaptics.kt` — **Create.** Vibrace.
- `android/wear/src/main/java/com/pumplo/wear/MainActivity.kt` — **Create.** ComponentActivity + `setContent`.
- `android/wear/src/main/java/com/pumplo/wear/ui/Theme.kt` — **Create.** Brand barvy.
- `android/wear/src/main/java/com/pumplo/wear/ui/PumploWatchApp.kt` — **Create.** Routing podle `phase`.
- `android/wear/src/main/java/com/pumplo/wear/ui/ActiveSetScreen.kt` — **Create.**
- `android/wear/src/main/java/com/pumplo/wear/ui/RestScreen.kt` — **Create.**
- `android/wear/src/main/java/com/pumplo/wear/ui/EdgeScreens.kt` — **Create.** Idle + souhrn.
- `android/wear/src/test/java/com/pumplo/wear/WatchWorkoutStateTest.kt`, `WatchActionCodecTest.kt`, `FormattingTest.kt`, `RestMathTest.kt` — **Create.**

**Dokumentace:**
- `docs/superpowers/specs/2026-07-25-wear-os-testing-runbook.md` — **Create.** Runbook párování emulátorů a E2E scénářů.

---

### Task 1: Telefonní plugin v Javě + dekodér akcí

**Files:**
- Create: `android/app/src/main/java/com/pumplo/app/WatchAction.java`
- Create: `android/app/src/main/java/com/pumplo/app/WatchActionCodec.java`
- Create: `android/app/src/main/java/com/pumplo/app/WatchWorkoutPlugin.java`
- Delete: `android/app/src/main/java/com/pumplo/app/WatchWorkoutPlugin.kt`
- Modify: `android/app/src/main/java/com/pumplo/app/MainActivity.java:13-14`
- Test: `android/app/src/test/java/com/pumplo/app/WatchActionCodecTest.java`

**Interfaces:**
- Consumes: JS wrapper z Plánu A (`src/lib/watchWorkout.ts`) volá `WatchWorkout.updateState(state)` / `endState()` / `addListener('watchAction', …)`.
- Produces:
  ```java
  public final class WatchAction {
      public final String type;      // "logSet" | "goPrevSet" | "goNextSet" | "skipRest" | "addRest15"
      public final Double weight;    // null = bez váhy
      public final Integer reps;     // null mimo logSet
      public WatchAction(String type, Double weight, Integer reps);
  }
  public final class WatchActionCodec {
      public static final String ACTION_PATH = "/pumplo/action";
      public static WatchAction decode(String payload);   // null = nevalidní
  }
  @CapacitorPlugin(name = "WatchWorkout")
  public class WatchWorkoutPlugin extends Plugin {
      public void updateState(PluginCall call);
      public void endState(PluginCall call);
  }
  ```

- [ ] **Step 1: Napsat padající test dekodéru**

Create `android/app/src/test/java/com/pumplo/app/WatchActionCodecTest.java`:
```java
package com.pumplo.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class WatchActionCodecTest {

    @Test
    public void decodesLogSetWithWeight() {
        WatchAction a = WatchActionCodec.decode("logSet|40.5|10");
        assertEquals("logSet", a.type);
        assertEquals(Double.valueOf(40.5), a.weight);
        assertEquals(Integer.valueOf(10), a.reps);
    }

    @Test
    public void decodesLogSetWithoutWeight() {
        WatchAction a = WatchActionCodec.decode("logSet|-|8");
        assertEquals("logSet", a.type);
        assertNull(a.weight);
        assertEquals(Integer.valueOf(8), a.reps);
    }

    @Test
    public void decodesSimpleActions() {
        assertEquals("goPrevSet", WatchActionCodec.decode("goPrevSet").type);
        assertEquals("goNextSet", WatchActionCodec.decode("goNextSet").type);
        assertEquals("skipRest", WatchActionCodec.decode("skipRest").type);
        assertEquals("addRest15", WatchActionCodec.decode("addRest15").type);
    }

    @Test
    public void rejectsGarbage() {
        assertNull(WatchActionCodec.decode(""));
        assertNull(WatchActionCodec.decode(null));
        assertNull(WatchActionCodec.decode("logSet|40.5"));
        assertNull(WatchActionCodec.decode("logSet|x|y"));
        assertNull(WatchActionCodec.decode("selfDestruct"));
    }
}
```

- [ ] **Step 2: Spustit test — musí selhat**

```bash
cd /Users/davidnovotny/pumplo/android && ./gradlew :app:testDebugUnitTest --tests '*WatchActionCodecTest*'
```
Expected: FAIL — `cannot find symbol: class WatchActionCodec`.

- [ ] **Step 3: Implementovat `WatchAction` + `WatchActionCodec`**

Create `android/app/src/main/java/com/pumplo/app/WatchAction.java`:
```java
package com.pumplo.app;

/** One control action sent from the watch. weight/reps are null unless type is logSet. */
public final class WatchAction {
    public final String type;
    public final Double weight;
    public final Integer reps;

    public WatchAction(String type, Double weight, Integer reps) {
        this.type = type;
        this.weight = weight;
        this.reps = reps;
    }
}
```

Create `android/app/src/main/java/com/pumplo/app/WatchActionCodec.java`:
```java
package com.pumplo.app;

// Wire format (watch -> phone, MessageClient payload, UTF-8):
//   logSet|<weight or ->|<reps>   e.g. "logSet|40.5|10", "logSet|-|8"
//   goPrevSet | goNextSet | skipRest | addRest15
public final class WatchActionCodec {

    public static final String ACTION_PATH = "/pumplo/action";

    private WatchActionCodec() { }

    public static WatchAction decode(String payload) {
        if (payload == null) return null;
        String raw = payload.trim();
        if (raw.isEmpty()) return null;

        if (raw.equals("goPrevSet") || raw.equals("goNextSet")
                || raw.equals("skipRest") || raw.equals("addRest15")) {
            return new WatchAction(raw, null, null);
        }

        String[] parts = raw.split("\\|", -1);
        if (parts.length != 3 || !parts[0].equals("logSet")) return null;
        Double weight = null;
        if (!parts[1].equals("-")) {
            try {
                weight = Double.valueOf(Double.parseDouble(parts[1]));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        try {
            return new WatchAction("logSet", weight, Integer.valueOf(Integer.parseInt(parts[2])));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
```

- [ ] **Step 4: Spustit test — musí projít**

```bash
cd /Users/davidnovotny/pumplo/android && ./gradlew :app:testDebugUnitTest --tests '*WatchActionCodecTest*'
```
Expected: PASS (4 testy).

- [ ] **Step 5: Nahradit Kotlin stub Java pluginem (zatím bez Data Layeru)**

```bash
rm /Users/davidnovotny/pumplo/android/app/src/main/java/com/pumplo/app/WatchWorkoutPlugin.kt
```

Create `android/app/src/main/java/com/pumplo/app/WatchWorkoutPlugin.java`:
```java
package com.pumplo.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Bridge between the web workout session and a paired Wear OS watch.
// Data Layer wiring lands in the next task; every method must stay no-op safe
// when no watch is paired (same contract as RestActivityPlugin).
@CapacitorPlugin(name = "WatchWorkout")
public class WatchWorkoutPlugin extends Plugin {

    @PluginMethod
    public void updateState(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void endState(PluginCall call) {
        call.resolve();
    }
}
```

- [ ] **Step 6: Zaregistrovat plugin v `MainActivity.java`**

V `android/app/src/main/java/com/pumplo/app/MainActivity.java` upravit blok registrací (řádky 10–14) na:
```java
        // App-local plugins — must be registered before super.onCreate() loads
        // the bridge. RestActivity = ongoing rest-timer notification;
        // InstagramShare = native "Share to Instagram Stories" handoff;
        // WatchWorkout = Wear OS Data Layer bridge for the workout session.
        registerPlugin(RestActivityPlugin.class);
        registerPlugin(InstagramSharePlugin.class);
        registerPlugin(WatchWorkoutPlugin.class);
```

- [ ] **Step 7: Ověřit kompilaci `:app`**

```bash
cd /Users/davidnovotny/pumplo/android && ./gradlew :app:compileDebugJavaWithJavac
```
Expected: BUILD SUCCESSFUL. (Kdyby build hlásil chybějící `WatchWorkoutPlugin`, znamená to, že `.kt` soubor nezmizel — smazat.)

- [ ] **Step 8: Commit**

```bash
cd /Users/davidnovotny/pumplo
git add android/app/src/main/java/com/pumplo/app android/app/src/test
git commit -m "feat(watch/android): Java WatchWorkout plugin + tested action codec, registered in MainActivity"
```

---

### Task 2: Wearable Data Layer v telefonním pluginu

**Files:**
- Modify: `android/variables.gradle`
- Modify: `android/app/build.gradle:61-71`
- Modify: `android/app/src/main/java/com/pumplo/app/WatchWorkoutPlugin.java`
- Create: `android/app/src/main/java/com/pumplo/app/WatchStateBridge.java`
- Test: `android/app/src/test/java/com/pumplo/app/WatchStateBridgeTest.java`

**Interfaces:**
- Consumes: `WatchAction`, `WatchActionCodec.decode(String)`, `WatchActionCodec.ACTION_PATH` z Tasku 1.
- Produces:
  ```java
  public final class WatchStateBridge {
      public static final String STATE_PATH = "/pumplo/workout-state";
      public static final String KEY_JSON = "json";
      public static final String KEY_UPDATED_AT = "updatedAt";
      public static boolean shouldSend(String lastPayload, String newPayload); // deduplikace
  }
  ```
  a JS event `watchAction` s payloadem `{ type: string, weight: number|null, reps: number }`.

- [ ] **Step 1: Napsat padající test deduplikace**

Create `android/app/src/test/java/com/pumplo/app/WatchStateBridgeTest.java`:
```java
package com.pumplo.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class WatchStateBridgeTest {

    @Test
    public void sendsFirstPayload() {
        assertTrue(WatchStateBridge.shouldSend(null, "{\"phase\":\"set\"}"));
    }

    @Test
    public void skipsIdenticalPayload() {
        assertFalse(WatchStateBridge.shouldSend("{\"phase\":\"set\"}", "{\"phase\":\"set\"}"));
    }

    @Test
    public void sendsChangedPayload() {
        assertTrue(WatchStateBridge.shouldSend("{\"phase\":\"set\"}", "{\"phase\":\"rest\"}"));
    }

    @Test
    public void skipsEmptyPayload() {
        assertFalse(WatchStateBridge.shouldSend(null, null));
        assertFalse(WatchStateBridge.shouldSend(null, ""));
    }
}
```

- [ ] **Step 2: Spustit test — musí selhat**

```bash
cd /Users/davidnovotny/pumplo/android && ./gradlew :app:testDebugUnitTest --tests '*WatchStateBridgeTest*'
```
Expected: FAIL — `cannot find symbol: class WatchStateBridge`.

- [ ] **Step 3: Implementovat `WatchStateBridge`**

Create `android/app/src/main/java/com/pumplo/app/WatchStateBridge.java`:
```java
package com.pumplo.app;

// Constants + pure helpers for the phone -> watch state channel.
// The workout effect on the web re-fires on many dependency changes, so we
// only put a new DataItem when the serialized snapshot actually differs.
public final class WatchStateBridge {

    public static final String STATE_PATH = "/pumplo/workout-state";
    public static final String KEY_JSON = "json";
    public static final String KEY_UPDATED_AT = "updatedAt";

    private WatchStateBridge() { }

    public static boolean shouldSend(String lastPayload, String newPayload) {
        if (newPayload == null || newPayload.isEmpty()) return false;
        return !newPayload.equals(lastPayload);
    }
}
```

- [ ] **Step 4: Spustit test — musí projít**

```bash
cd /Users/davidnovotny/pumplo/android && ./gradlew :app:testDebugUnitTest --tests '*WatchStateBridgeTest*'
```
Expected: PASS (4 testy).

- [ ] **Step 5: Přidat závislost na Wearable API**

V `android/variables.gradle` do `ext { … }` přidat (verze sdílené i modulem `:wear`):
```gradle
    playServicesWearableVersion = '18.2.0'
    kotlinVersion = '2.2.0'
    composeUiVersion = '1.8.0'
    wearComposeVersion = '1.4.1'
    activityComposeVersion = '1.9.3'
    coroutinesVersion = '1.8.1'
```

V `android/app/build.gradle` do bloku `dependencies` (za `implementation project(':capacitor-android')`) přidat:
```gradle
    implementation "com.google.android.gms:play-services-wearable:$playServicesWearableVersion"
```

- [ ] **Step 6: Doplnit Data Layer do pluginu**

Přepsat `android/app/src/main/java/com/pumplo/app/WatchWorkoutPlugin.java` na:
```java
package com.pumplo.app;

import android.net.Uri;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.wearable.MessageClient;
import com.google.android.gms.wearable.MessageEvent;
import com.google.android.gms.wearable.PutDataMapRequest;
import com.google.android.gms.wearable.PutDataRequest;
import com.google.android.gms.wearable.Wearable;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;

// Wear OS bridge for the running workout.
// State goes out as a DataItem (newest snapshot wins); actions come back as
// MessageClient messages and are re-emitted to JS as the "watchAction" event.
// Everything is best-effort: with no watch paired (or no Play services) the
// calls simply do nothing, exactly like RestActivityPlugin.
@CapacitorPlugin(name = "WatchWorkout")
public class WatchWorkoutPlugin extends Plugin {

    private static final String TAG = "PumploWatch";

    private MessageClient messageClient;
    private MessageClient.OnMessageReceivedListener messageListener;
    private String lastPayload = null;

    @Override
    public void load() {
        try {
            messageClient = Wearable.getMessageClient(getContext());
            messageListener = new MessageClient.OnMessageReceivedListener() {
                @Override
                public void onMessageReceived(MessageEvent event) {
                    handleWatchMessage(event);
                }
            };
            messageClient.addListener(messageListener);
        } catch (Throwable t) {
            Log.d(TAG, "Wearable message client unavailable: " + t);
            messageClient = null;
            messageListener = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (messageClient != null && messageListener != null) {
            try {
                messageClient.removeListener(messageListener);
            } catch (Throwable ignored) { }
        }
    }

    @PluginMethod
    public void updateState(PluginCall call) {
        try {
            JSObject data = call.getData();
            data.remove("callbackId");
            String payload = data.toString();
            if (WatchStateBridge.shouldSend(lastPayload, payload)) {
                lastPayload = payload;
                boolean resting = Boolean.TRUE.equals(call.getBoolean("resting", Boolean.FALSE));
                PutDataMapRequest req = PutDataMapRequest.create(WatchStateBridge.STATE_PATH);
                req.getDataMap().putString(WatchStateBridge.KEY_JSON, payload);
                req.getDataMap().putLong(WatchStateBridge.KEY_UPDATED_AT, System.currentTimeMillis());
                PutDataRequest put = req.asPutDataRequest();
                if (resting) put.setUrgent();
                Wearable.getDataClient(getContext()).putDataItem(put);
                Log.d(TAG, "state sent, urgent=" + resting);
            }
        } catch (Throwable t) {
            Log.d(TAG, "updateState skipped: " + t);
        }
        call.resolve();
    }

    @PluginMethod
    public void endState(PluginCall call) {
        lastPayload = null;
        try {
            Uri uri = new Uri.Builder()
                    .scheme(PutDataRequest.WEAR_URI_SCHEME)
                    .authority("*")
                    .path(WatchStateBridge.STATE_PATH)
                    .build();
            Wearable.getDataClient(getContext()).deleteDataItems(uri);
            Log.d(TAG, "state cleared");
        } catch (Throwable t) {
            Log.d(TAG, "endState skipped: " + t);
        }
        call.resolve();
    }

    private void handleWatchMessage(MessageEvent event) {
        if (!WatchActionCodec.ACTION_PATH.equals(event.getPath())) return;
        String payload = new String(event.getData(), StandardCharsets.UTF_8);
        WatchAction action = WatchActionCodec.decode(payload);
        if (action == null) {
            Log.d(TAG, "ignored watch payload: " + payload);
            return;
        }
        JSObject js = new JSObject();
        js.put("type", action.type);
        if (action.weight == null) {
            js.put("weight", JSONObject.NULL);
        } else {
            js.put("weight", action.weight.doubleValue());
        }
        if (action.reps != null) js.put("reps", action.reps.intValue());
        Log.d(TAG, "watchAction -> JS: " + payload);
        notifyListeners("watchAction", js);
    }
}
```

- [ ] **Step 7: Ověřit build i testy**

```bash
cd /Users/davidnovotny/pumplo/android && ./gradlew :app:testDebugUnitTest :app:assembleDebug
```
Expected: BUILD SUCCESSFUL, 8 unit testů projde.

- [ ] **Step 8: MANUAL CHECKPOINT — no-op bez hodinek**

```bash
cd /Users/davidnovotny/pumplo && npm run build && npx cap sync android
export ANDROID_SERIAL=$(adb devices | awk 'NR==2{print $1}')
cd android && ./gradlew :app:installDebug
adb logcat -c && adb logcat -s PumploWatch:D &
```
Na telefonním emulátoru (bez spárovaných hodinek) spustit trénink, odklikat sérii, nechat naběhnout pauzu, trénink ukončit.
Expected: appka nespadne, trénink funguje beze změny; v logcatu se objeví řádky `state sent, urgent=false/true` a `state cleared`. Žádný `FATAL EXCEPTION`.

- [ ] **Step 9: Commit**

```bash
cd /Users/davidnovotny/pumplo
git add android/variables.gradle android/app/build.gradle android/app/src
git commit -m "feat(watch/android): push workout state via Data Layer, receive watch actions"
```

---

### Task 3: Gradle modul `:wear` + prázdná Wear appka, která jde nainstalovat

**Files:**
- Modify: `android/build.gradle:9-15`
- Modify: `android/settings.gradle:1`
- Create: `android/wear/build.gradle`
- Create: `android/wear/src/main/AndroidManifest.xml`
- Create: `android/wear/src/main/res/values/strings.xml`
- Create: `android/wear/src/main/res/mipmap-*/` (kopie z `:app`)
- Create: `android/wear/src/main/java/com/pumplo/wear/MainActivity.kt`
- Create: `android/wear/src/main/java/com/pumplo/wear/ui/Theme.kt`

**Interfaces:**
- Consumes: verze z `android/variables.gradle` (Task 2, Step 5).
- Produces:
  ```kotlin
  // com.pumplo.wear.ui
  val PumploNavy: Color   // 0xFF0B1222
  val PumploCyan: Color   // 0xFF4CC9FF
  val PumploCard: Color   // 0xFF16203A
  val PumploMuted: Color  // 0xFF9AA7BF
  // com.pumplo.wear.MainActivity : ComponentActivity
  ```
  APK `wear/build/outputs/apk/debug/wear-debug.apk` s `applicationId com.pumplo.app`.

- [ ] **Step 1: Kotlin + Compose classpath do root buildu**

V `android/build.gradle` rozšířit `buildscript.dependencies` na:
```gradle
    dependencies {
        classpath 'com.android.tools.build:gradle:8.13.0'
        classpath 'com.google.gms:google-services:4.4.4'
        // Kotlin + Compose compiler — used by the :wear module only.
        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.0"
        classpath "org.jetbrains.kotlin:compose-compiler-gradle-plugin:2.2.0"

        // NOTE: Do not place your application dependencies here; they belong
        // in the individual module build.gradle files
    }
```
(Classpath je jen k dispozici — `:app` Kotlin plugin neaplikuje a zůstává čistě Java modul.)

- [ ] **Step 2: Zaregistrovat modul**

V `android/settings.gradle` na první řádek přidat pod `include ':app'`:
```gradle
include ':app'
include ':wear'
```
(Soubor Capacitor negeneruje, takže `npx cap sync android` řádek nepřepíše.)

- [ ] **Step 3: `wear/build.gradle`**

Create `android/wear/build.gradle`:
```gradle
apply plugin: 'com.android.application'
apply plugin: 'org.jetbrains.kotlin.android'
apply plugin: 'org.jetbrains.kotlin.plugin.compose'

android {
    namespace = "com.pumplo.wear"
    compileSdk = rootProject.ext.compileSdkVersion

    defaultConfig {
        // Must match the phone app: the Data Layer pairs apps by package name
        // + signing certificate. Different devices, so no install conflict.
        applicationId "com.pumplo.app"
        minSdkVersion 30
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0.0"
    }

    buildFeatures {
        compose true
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_21
        targetCompatibility JavaVersion.VERSION_21
    }

    kotlinOptions {
        jvmTarget = '21'
    }
}

dependencies {
    implementation "androidx.activity:activity-compose:$activityComposeVersion"
    implementation "androidx.compose.ui:ui:$composeUiVersion"
    implementation "androidx.compose.ui:ui-tooling-preview:$composeUiVersion"
    implementation "androidx.wear.compose:compose-material:$wearComposeVersion"
    implementation "androidx.wear.compose:compose-foundation:$wearComposeVersion"
    implementation "com.google.android.gms:play-services-wearable:$playServicesWearableVersion"
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:$coroutinesVersion"
    debugImplementation "androidx.compose.ui:ui-tooling:$composeUiVersion"
    testImplementation "junit:junit:$junitVersion"
}
```
(Kdyby některá verze nešla resolvnout, spustit `./gradlew :wear:dependencies --configuration debugRuntimeClasspath` a vzít nejbližší dostupnou stabilní; kontrakt kódu na verzi nezávisí.)

- [ ] **Step 4: Manifest a resources**

Create `android/wear/src/main/AndroidManifest.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-feature android:name="android.hardware.type.watch" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <application
        android:allowBackup="false"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.DeviceDefault">

        <uses-library
            android:name="com.google.android.wearable"
            android:required="false" />

        <!-- v1 needs the phone: the workout session lives in the web app. -->
        <meta-data
            android:name="com.google.android.wearable.standalone"
            android:value="false" />

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:label="@string/app_name"
            android:taskAffinity="">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

Create `android/wear/src/main/res/values/strings.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Pumplo</string>
</resources>
```

Ikony převzít z telefonní appky:
```bash
cd /Users/davidnovotny/pumplo/android
mkdir -p wear/src/main/res
cp -R app/src/main/res/mipmap-hdpi app/src/main/res/mipmap-mdpi app/src/main/res/mipmap-xhdpi \
      app/src/main/res/mipmap-xxhdpi app/src/main/res/mipmap-xxxhdpi wear/src/main/res/
```
(`mipmap-anydpi-v26` se **nekopíruje** — adaptivní ikona odkazuje na drawable z `:app`, které v `:wear` nejsou.)

- [ ] **Step 5: Brand téma + minimální obrazovka**

Create `android/wear/src/main/java/com/pumplo/wear/ui/Theme.kt`:
```kotlin
package com.pumplo.wear.ui

import androidx.compose.ui.graphics.Color

// Pumplo brand (see docs/superpowers/specs/2026-07-23-watch-app-design.md)
val PumploNavy = Color(0xFF0B1222)
val PumploCyan = Color(0xFF4CC9FF)
val PumploCard = Color(0xFF16203A)
val PumploMuted = Color(0xFF9AA7BF)
val PumploWhite = Color(0xFFFFFFFF)
```

Create `android/wear/src/main/java/com/pumplo/wear/MainActivity.kt`:
```kotlin
package com.pumplo.wear

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.wear.compose.material.Text
import com.pumplo.wear.ui.PumploCyan
import com.pumplo.wear.ui.PumploNavy

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Gym use: the screen must not sleep mid-set.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContent {
            Box(
                modifier = Modifier.fillMaxSize().background(PumploNavy),
                contentAlignment = Alignment.Center,
            ) {
                Text(text = "Pumplo", color = PumploCyan)
            }
        }
    }
}
```

- [ ] **Step 6: Build modulu**

```bash
cd /Users/davidnovotny/pumplo/android && ./gradlew :wear:assembleDebug
```
Expected: BUILD SUCCESSFUL, vznikne `wear/build/outputs/apk/debug/wear-debug.apk`.

- [ ] **Step 7: MANUAL CHECKPOINT — Wear AVD, párování, instalace**

1. Android Studio → **Device Manager → Create Device → Wear OS Large Round** → stáhnout system image (API 34, x86_64) → pojmenovat `Wear_OS_Large_Round_API_34`.
2. Nastartovat obě zařízení:
   ```bash
   emulator -list-avds
   emulator -avd <telefonni_avd> & sleep 40
   emulator -avd Wear_OS_Large_Round_API_34 & sleep 60
   adb devices     # očekávej emulator-5554 (telefon) a emulator-5556 (hodinky)
   ```
3. Párování — primárně Android Studio: **Device Manager → řádek telefonu → ⋮ → Pair Wearable** a projít průvodce.
   Fallback přes CLI:
   ```bash
   adb -s emulator-5556 forward tcp:5601 tcp:5601
   ```
   pak na telefonním emulátoru otevřít appku **Wear OS** → menu → *Pair with emulator*.
4. Instalace Wear appky (POZOR: `ANDROID_SERIAL` musí být hodinky, jinak `installDebug` přepíše telefonní appku — mají stejný `applicationId`):
   ```bash
   adb -s emulator-5556 install -r wear/build/outputs/apk/debug/wear-debug.apk
   ```
Expected: na hodinkovém emulátoru je v seznamu appek „Pumplo", po spuštění tmavě modrá obrazovka s cyan nápisem „Pumplo", obrazovka nezhasíná.

- [ ] **Step 8: Commit**

```bash
cd /Users/davidnovotny/pumplo
git add android/build.gradle android/settings.gradle android/wear
git commit -m "feat(watch/wear): add :wear Gradle module (Kotlin + Compose for Wear OS)"
```

---

### Task 4: Doménová vrstva hodinek — stav, akce, formátování (TDD)

**Files:**
- Create: `android/wear/src/main/java/com/pumplo/wear/WatchWorkoutState.kt`
- Create: `android/wear/src/main/java/com/pumplo/wear/WatchAction.kt`
- Create: `android/wear/src/main/java/com/pumplo/wear/Formatting.kt`
- Test: `android/wear/src/test/java/com/pumplo/wear/WatchWorkoutStateTest.kt`
- Test: `android/wear/src/test/java/com/pumplo/wear/WatchActionCodecTest.kt`
- Test: `android/wear/src/test/java/com/pumplo/wear/FormattingTest.kt`

**Interfaces:**
- Consumes: drátový kontrakt z Tasku 1–2 (`/pumplo/action` payloady, `json` DataMap pole).
- Produces:
  ```kotlin
  enum class WatchPhase { SET, REST, SUMMARY, IDLE }
  data class WatchWorkoutState(
      val phase: WatchPhase, val exerciseName: String, val slotCategory: String?,
      val setIndex: Int, val totalSets: Int,
      val targetWeight: Double?, val targetReps: Int, val repMin: Int, val repMax: Int, val rir: Int?,
      val prevWeight: Double?, val prevReps: Int?, val weightStep: Double,
      val resting: Boolean, val restEndsAt: Long?, val nextSetLabel: String?,
  )
  fun watchStateFromMap(map: Map<String, Any?>): WatchWorkoutState

  sealed class WatchAction {
      data class LogSet(val weight: Double?, val reps: Int) : WatchAction()
      object GoPrevSet : WatchAction()
      object GoNextSet : WatchAction()
      object SkipRest : WatchAction()
      object AddRest15 : WatchAction()
  }
  fun encodeWatchAction(action: WatchAction): String

  fun formatWeight(value: Double?): String      // "40,0" / "37,5" / "–"
  fun stepWeight(current: Double?, direction: Int, step: Double): Double
  fun stepReps(current: Int, direction: Int): Int
  fun slotLabel(raw: String?): String
  ```

- [ ] **Step 1: Napsat padající testy parseru stavu**

Create `android/wear/src/test/java/com/pumplo/wear/WatchWorkoutStateTest.kt`:
```kotlin
package com.pumplo.wear

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WatchWorkoutStateTest {

    private val full = mapOf<String, Any?>(
        "phase" to "set",
        "exerciseName" to "Šikmý tlak na prsa",
        "slotCategory" to "main",
        "setIndex" to 1,
        "totalSets" to 3,
        "targetWeight" to 40.0,
        "targetReps" to 12,
        "repMin" to 8,
        "repMax" to 12,
        "rir" to 2,
        "prevWeight" to 37.5,
        "prevReps" to 10,
        "weightStep" to 0.5,
        "resting" to false,
        "restEndsAt" to null,
        "nextSetLabel" to null,
    )

    @Test
    fun parsesActiveSet() {
        val s = watchStateFromMap(full)
        assertEquals(WatchPhase.SET, s.phase)
        assertEquals("Šikmý tlak na prsa", s.exerciseName)
        assertEquals("main", s.slotCategory)
        assertEquals(1, s.setIndex)
        assertEquals(3, s.totalSets)
        assertEquals(40.0, s.targetWeight!!, 0.001)
        assertEquals(12, s.targetReps)
        assertEquals(8, s.repMin)
        assertEquals(2, s.rir)
        assertEquals(37.5, s.prevWeight!!, 0.001)
        assertEquals(10, s.prevReps)
        assertEquals(0.5, s.weightStep, 0.001)
    }

    @Test
    fun parsesRestWithEndsAt() {
        val s = watchStateFromMap(full + mapOf(
            "phase" to "rest", "resting" to true,
            "restEndsAt" to 1_753_400_000_000L, "nextSetLabel" to "3. série",
        ))
        assertEquals(WatchPhase.REST, s.phase)
        assertEquals(true, s.resting)
        assertEquals(1_753_400_000_000L, s.restEndsAt)
        assertEquals("3. série", s.nextSetLabel)
    }

    @Test
    fun keepsNullsForMissingWeights() {
        val s = watchStateFromMap(full + mapOf("targetWeight" to null, "prevWeight" to null, "prevReps" to null, "rir" to null))
        assertNull(s.targetWeight)
        assertNull(s.prevWeight)
        assertNull(s.prevReps)
        assertNull(s.rir)
    }

    @Test
    fun toleratesNumbersArrivingAsOtherTypes() {
        // JSON may hand us Int where we expect Double and vice versa.
        val s = watchStateFromMap(full + mapOf("targetWeight" to 40, "restEndsAt" to 1_753_400_000_000.0, "setIndex" to 2.0))
        assertEquals(40.0, s.targetWeight!!, 0.001)
        assertEquals(1_753_400_000_000L, s.restEndsAt)
        assertEquals(2, s.setIndex)
    }

    @Test
    fun fallsBackToIdleOnUnknownPhaseAndMissingKeys() {
        val s = watchStateFromMap(mapOf("phase" to "between"))
        assertEquals(WatchPhase.IDLE, s.phase)
        assertEquals("", s.exerciseName)
        assertEquals(0, s.setIndex)
        assertEquals(0.5, s.weightStep, 0.001)
    }
}
```

- [ ] **Step 2: Napsat padající testy kodéru akcí a formátování**

Create `android/wear/src/test/java/com/pumplo/wear/WatchActionCodecTest.kt`:
```kotlin
package com.pumplo.wear

import org.junit.Assert.assertEquals
import org.junit.Test

class WatchActionCodecTest {

    // These literals are the wire contract shared with
    // android/app/src/main/java/com/pumplo/app/WatchActionCodec.java — keep in sync.
    @Test
    fun encodesLogSetWithWeight() {
        assertEquals("logSet|40.5|10", encodeWatchAction(WatchAction.LogSet(40.5, 10)))
    }

    @Test
    fun encodesWholeWeightWithOneDecimal() {
        assertEquals("logSet|40.0|10", encodeWatchAction(WatchAction.LogSet(40.0, 10)))
    }

    @Test
    fun encodesLogSetWithoutWeight() {
        assertEquals("logSet|-|8", encodeWatchAction(WatchAction.LogSet(null, 8)))
    }

    @Test
    fun encodesSimpleActions() {
        assertEquals("goPrevSet", encodeWatchAction(WatchAction.GoPrevSet))
        assertEquals("goNextSet", encodeWatchAction(WatchAction.GoNextSet))
        assertEquals("skipRest", encodeWatchAction(WatchAction.SkipRest))
        assertEquals("addRest15", encodeWatchAction(WatchAction.AddRest15))
    }
}
```

Create `android/wear/src/test/java/com/pumplo/wear/FormattingTest.kt`:
```kotlin
package com.pumplo.wear

import org.junit.Assert.assertEquals
import org.junit.Test

class FormattingTest {

    @Test
    fun formatsWeightWithCzechDecimalComma() {
        assertEquals("40,0", formatWeight(40.0))
        assertEquals("37,5", formatWeight(37.5))
        assertEquals("–", formatWeight(null))
    }

    @Test
    fun stepsWeightByHalfKilo() {
        assertEquals(40.5, stepWeight(40.0, 1, 0.5), 0.001)
        assertEquals(39.5, stepWeight(40.0, -1, 0.5), 0.001)
    }

    @Test
    fun weightNeverGoesNegativeAndNullStartsAtZero() {
        assertEquals(0.0, stepWeight(0.0, -1, 0.5), 0.001)
        assertEquals(0.5, stepWeight(null, 1, 0.5), 0.001)
        assertEquals(0.0, stepWeight(null, -1, 0.5), 0.001)
    }

    @Test
    fun stepsRepsByOneWithFloorOfOne() {
        assertEquals(11, stepReps(10, 1))
        assertEquals(9, stepReps(10, -1))
        assertEquals(1, stepReps(1, -1))
    }

    @Test
    fun mapsSlotCategoriesToCzechLabels() {
        assertEquals("Hlavní", slotLabel("main"))
        assertEquals("Pomocný", slotLabel("secondary"))
        assertEquals("Izolace", slotLabel("isolation"))
        assertEquals("Core", slotLabel("core_or_compensatory"))
        assertEquals("Kardio", slotLabel("conditioning"))
        assertEquals("Cvik", slotLabel(null))
        assertEquals("Cvik", slotLabel("nekonecne_nove_neco"))
    }
}
```

- [ ] **Step 3: Spustit testy — musí selhat**

```bash
cd /Users/davidnovotny/pumplo/android && ./gradlew :wear:testDebugUnitTest
```
Expected: FAIL — `unresolved reference: watchStateFromMap` (a další).

- [ ] **Step 4: Implementovat stav a parser**

Create `android/wear/src/main/java/com/pumplo/wear/WatchWorkoutState.kt`:
```kotlin
package com.pumplo.wear

enum class WatchPhase { SET, REST, SUMMARY, IDLE }

// Mirror of WatchWorkoutState in src/lib/watchWorkout.ts (web = source of truth).
data class WatchWorkoutState(
    val phase: WatchPhase,
    val exerciseName: String,
    val slotCategory: String?,
    val setIndex: Int,
    val totalSets: Int,
    val targetWeight: Double?,
    val targetReps: Int,
    val repMin: Int,
    val repMax: Int,
    val rir: Int?,
    val prevWeight: Double?,
    val prevReps: Int?,
    val weightStep: Double,
    val resting: Boolean,
    val restEndsAt: Long?,
    val nextSetLabel: String?,
)

private fun Map<String, Any?>.num(key: String): Number? = this[key] as? Number
private fun Map<String, Any?>.int(key: String, fallback: Int = 0): Int = num(key)?.toInt() ?: fallback
private fun Map<String, Any?>.dbl(key: String): Double? = num(key)?.toDouble()
private fun Map<String, Any?>.str(key: String): String? = (this[key] as? String)?.takeIf { it.isNotEmpty() }

fun watchStateFromMap(map: Map<String, Any?>): WatchWorkoutState = WatchWorkoutState(
    phase = when (map["phase"] as? String) {
        "set" -> WatchPhase.SET
        "rest" -> WatchPhase.REST
        "summary" -> WatchPhase.SUMMARY
        else -> WatchPhase.IDLE
    },
    exerciseName = map.str("exerciseName") ?: "",
    slotCategory = map.str("slotCategory"),
    setIndex = map.int("setIndex"),
    totalSets = map.int("totalSets"),
    targetWeight = map.dbl("targetWeight"),
    targetReps = map.int("targetReps"),
    repMin = map.int("repMin"),
    repMax = map.int("repMax"),
    rir = map.num("rir")?.toInt(),
    prevWeight = map.dbl("prevWeight"),
    prevReps = map.num("prevReps")?.toInt(),
    weightStep = map.dbl("weightStep")?.takeIf { it > 0.0 } ?: 0.5,
    resting = map["resting"] as? Boolean ?: false,
    restEndsAt = map.num("restEndsAt")?.toLong(),
    nextSetLabel = map.str("nextSetLabel"),
)
```

- [ ] **Step 5: Implementovat akce a formátování**

Create `android/wear/src/main/java/com/pumplo/wear/WatchAction.kt`:
```kotlin
package com.pumplo.wear

import java.util.Locale

const val ACTION_PATH = "/pumplo/action"
const val STATE_PATH = "/pumplo/workout-state"
const val KEY_JSON = "json"
const val KEY_UPDATED_AT = "updatedAt"

sealed class WatchAction {
    data class LogSet(val weight: Double?, val reps: Int) : WatchAction()
    object GoPrevSet : WatchAction()
    object GoNextSet : WatchAction()
    object SkipRest : WatchAction()
    object AddRest15 : WatchAction()
}

// Wire format decoded by WatchActionCodec.java on the phone.
fun encodeWatchAction(action: WatchAction): String = when (action) {
    is WatchAction.LogSet -> {
        val w = action.weight?.let { String.format(Locale.US, "%.1f", it) } ?: "-"
        "logSet|$w|${action.reps}"
    }
    WatchAction.GoPrevSet -> "goPrevSet"
    WatchAction.GoNextSet -> "goNextSet"
    WatchAction.SkipRest -> "skipRest"
    WatchAction.AddRest15 -> "addRest15"
}
```

Create `android/wear/src/main/java/com/pumplo/wear/Formatting.kt`:
```kotlin
package com.pumplo.wear

import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt

// Czech decimal comma; "–" when there is no weight (bodyweight / first time).
fun formatWeight(value: Double?): String =
    value?.let { String.format(Locale.US, "%.1f", it).replace('.', ',') } ?: "–"

fun stepWeight(current: Double?, direction: Int, step: Double): Double {
    val base = current ?: 0.0
    val next = base + direction * step
    // Snap to the step grid so rotary noise cannot drift the value.
    val snapped = (next / step).roundToInt() * step
    return max(0.0, snapped)
}

fun stepReps(current: Int, direction: Int): Int = max(1, current + direction)

// Slot labels mirror src/i18n/locales/cs.ts ('slot.*').
fun slotLabel(raw: String?): String = when (raw) {
    "main" -> "Hlavní"
    "secondary" -> "Pomocný"
    "isolation" -> "Izolace"
    "core_or_compensatory" -> "Core"
    "conditioning" -> "Kardio"
    else -> "Cvik"
}
```

- [ ] **Step 6: Spustit testy — musí projít**

```bash
cd /Users/davidnovotny/pumplo/android && ./gradlew :wear:testDebugUnitTest
```
Expected: PASS (14 testů).

- [ ] **Step 7: Commit**

```bash
cd /Users/davidnovotny/pumplo
git add android/wear/src
git commit -m "feat(watch/wear): state parser, action encoder and formatting helpers with unit tests"
```

---

### Task 5: `WearableRepository` — příjem stavu a odesílání akcí

**Files:**
- Create: `android/wear/src/main/java/com/pumplo/wear/WearableRepository.kt`
- Modify: `android/wear/src/main/java/com/pumplo/wear/MainActivity.kt`

**Interfaces:**
- Consumes: `watchStateFromMap`, `encodeWatchAction`, `WatchAction`, `STATE_PATH`, `ACTION_PATH`, `KEY_JSON`, `KEY_UPDATED_AT` z Tasku 4.
- Produces:
  ```kotlin
  class WearableRepository(context: Context) {
      val state: StateFlow<WatchWorkoutState?>   // null = zatím nic z telefonu
      fun start()
      fun stop()
      fun send(action: WatchAction)
  }
  ```

- [ ] **Step 1: Implementovat repository**

Create `android/wear/src/main/java/com/pumplo/wear/WearableRepository.kt`:
```kotlin
package com.pumplo.wear

import android.content.Context
import android.net.Uri
import android.util.Log
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMap
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataRequest
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject

private const val TAG = "PumploWear"

// Single source of truth on the watch: the newest snapshot the phone put into
// the Data Layer. Actions travel back as MessageClient messages.
class WearableRepository(private val context: Context) : com.google.android.gms.wearable.DataClient.OnDataChangedListener {

    private val _state = MutableStateFlow<WatchWorkoutState?>(null)
    val state: StateFlow<WatchWorkoutState?> = _state.asStateFlow()

    private var lastUpdatedAt = Long.MIN_VALUE

    private val stateUri: Uri = Uri.Builder()
        .scheme(PutDataRequest.WEAR_URI_SCHEME)
        .authority("*")
        .path(STATE_PATH)
        .build()

    fun start() {
        try {
            Wearable.getDataClient(context).addListener(this)
            refresh()
        } catch (t: Throwable) {
            Log.d(TAG, "data client unavailable: $t")
        }
    }

    fun stop() {
        try {
            Wearable.getDataClient(context).removeListener(this)
        } catch (t: Throwable) {
            Log.d(TAG, "removeListener failed: $t")
        }
    }

    // Phone may have published the snapshot before this app was opened.
    private fun refresh() {
        Wearable.getDataClient(context).getDataItems(stateUri)
            .addOnSuccessListener { buffer ->
                var newest: DataMap? = null
                var newestAt = Long.MIN_VALUE
                for (item in buffer) {
                    val map = DataMapItem.fromDataItem(item).dataMap
                    val at = map.getLong(KEY_UPDATED_AT)
                    if (at >= newestAt) {
                        newestAt = at
                        newest = map
                    }
                }
                buffer.release()
                newest?.let { apply(it) }
            }
            .addOnFailureListener { Log.d(TAG, "getDataItems failed: $it") }
    }

    override fun onDataChanged(events: DataEventBuffer) {
        for (event in events) {
            if (event.dataItem.uri.path != STATE_PATH) continue
            when (event.type) {
                DataEvent.TYPE_CHANGED -> apply(DataMapItem.fromDataItem(event.dataItem).dataMap)
                DataEvent.TYPE_DELETED -> {
                    lastUpdatedAt = Long.MIN_VALUE
                    _state.value = null
                    Log.d(TAG, "state cleared by phone")
                }
            }
        }
        events.release()
    }

    private fun apply(map: DataMap) {
        val updatedAt = map.getLong(KEY_UPDATED_AT)
        if (updatedAt < lastUpdatedAt) return  // stale snapshot, newest wins
        lastUpdatedAt = updatedAt
        val json = map.getString(KEY_JSON) ?: return
        val parsed = try {
            watchStateFromMap(jsonToMap(json))
        } catch (t: Throwable) {
            Log.d(TAG, "bad snapshot: $t")
            return
        }
        Log.d(TAG, "state: phase=${parsed.phase} set=${parsed.setIndex + 1}/${parsed.totalSets}")
        _state.value = parsed
    }

    fun send(action: WatchAction) {
        val payload = encodeWatchAction(action).toByteArray(Charsets.UTF_8)
        Wearable.getNodeClient(context).connectedNodes
            .addOnSuccessListener { nodes ->
                if (nodes.isEmpty()) Log.d(TAG, "no connected phone node")
                for (node in nodes) {
                    Wearable.getMessageClient(context).sendMessage(node.id, ACTION_PATH, payload)
                        .addOnFailureListener { Log.d(TAG, "sendMessage failed: $it") }
                }
            }
            .addOnFailureListener { Log.d(TAG, "connectedNodes failed: $it") }
    }
}

// Thin adapter: org.json is only available on-device, so all tested logic
// works on a plain Map instead.
private fun jsonToMap(json: String): Map<String, Any?> {
    val obj = JSONObject(json)
    val out = HashMap<String, Any?>()
    for (key in obj.keys()) {
        val value = obj.get(key)
        out[key] = if (value == JSONObject.NULL) null else value
    }
    return out
}
```

- [ ] **Step 2: Napojit repository na `MainActivity` (zatím syrový výpis)**

Přepsat `android/wear/src/main/java/com/pumplo/wear/MainActivity.kt`:
```kotlin
package com.pumplo.wear

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.Text
import com.pumplo.wear.ui.PumploCyan
import com.pumplo.wear.ui.PumploNavy

class MainActivity : ComponentActivity() {

    private lateinit var repository: WearableRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        repository = WearableRepository(applicationContext)
        setContent {
            val state by repository.state.collectAsState()
            Box(
                modifier = Modifier.fillMaxSize().background(PumploNavy).padding(12.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = state?.let { "${it.phase} ${it.exerciseName} ${it.setIndex + 1}/${it.totalSets}" }
                        ?: "Čekám na telefon…",
                    color = PumploCyan,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }

    override fun onStart() {
        super.onStart()
        repository.start()
    }

    override fun onStop() {
        repository.stop()
        super.onStop()
    }
}
```

- [ ] **Step 3: Build**

```bash
cd /Users/davidnovotny/pumplo/android && ./gradlew :wear:testDebugUnitTest :wear:assembleDebug
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: MANUAL CHECKPOINT — stav opravdu doteče z telefonu na hodinky**

```bash
cd /Users/davidnovotny/pumplo/android
adb -s emulator-5556 install -r wear/build/outputs/apk/debug/wear-debug.apk
adb -s emulator-5554 logcat -c; adb -s emulator-5556 logcat -c
adb -s emulator-5556 logcat -s PumploWear:D &
adb -s emulator-5554 logcat -s PumploWatch:D &
```
Na telefonním emulátoru spustit trénink, na hodinkách otevřít Pumplo.
Expected:
1. Hodinky ukážou `SET <název cviku> 1/3` (ne „Čekám na telefon…").
2. Po odkliknutí série se text na hodinkách během ~1 s změní na `REST …`.
3. V logu telefonu `state sent, urgent=true` při startu pauzy.
4. Po ukončení tréninku na telefonu hodinky spadnou zpět na „Čekám na telefon…" (log `state cleared by phone`).

Když nic nedorazí: ověřit `adb -s emulator-5556 shell dumpsys package com.pumplo.app | head` (stejné jméno balíčku na obou), stejný debug podpis a znovu projít párování z Tasku 3, Step 7.

- [ ] **Step 5: Commit**

```bash
cd /Users/davidnovotny/pumplo
git add android/wear/src
git commit -m "feat(watch/wear): receive workout snapshots and send actions over the Data Layer"
```

---

### Task 6: Obrazovka aktivní série (spinnery, korunka, ‹ ✓ ›)

**Files:**
- Create: `android/wear/src/main/java/com/pumplo/wear/ui/ActiveSetScreen.kt`
- Modify: `android/wear/src/main/java/com/pumplo/wear/MainActivity.kt`

**Interfaces:**
- Consumes: `WatchWorkoutState`, `WatchAction`, `formatWeight`, `stepWeight`, `stepReps`, `slotLabel`, barvy z `com.pumplo.wear.ui`.
- Produces:
  ```kotlin
  @Composable
  fun ActiveSetScreen(state: WatchWorkoutState, onAction: (WatchAction) -> Unit)
  ```

- [ ] **Step 1: Implementovat obrazovku**

Create `android/wear/src/main/java/com/pumplo/wear/ui/ActiveSetScreen.kt`:
```kotlin
package com.pumplo.wear.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.focusable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.rotary.onRotaryScrollEvent
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.Text
import com.pumplo.wear.WatchAction
import com.pumplo.wear.WatchWorkoutState
import com.pumplo.wear.formatWeight
import com.pumplo.wear.slotLabel
import com.pumplo.wear.stepReps
import com.pumplo.wear.stepWeight

private enum class SpinnerField { WEIGHT, REPS }

private const val DRAG_PIXELS_PER_STEP = 24f

@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun ActiveSetScreen(state: WatchWorkoutState, onAction: (WatchAction) -> Unit) {
    // Prefill from the target, fall back to what was lifted last time.
    // Re-prefills whenever the phone moves us to a different set.
    val setKey = "${state.exerciseName}#${state.setIndex}"
    var weight by remember(setKey) { mutableStateOf(state.targetWeight ?: state.prevWeight) }
    var reps by remember(setKey) { mutableStateOf(if (state.targetReps > 0) state.targetReps else state.prevReps ?: 10) }
    var field by remember(setKey) { mutableStateOf(SpinnerField.WEIGHT) }

    fun bump(direction: Int) {
        when (field) {
            SpinnerField.WEIGHT -> weight = stepWeight(weight, direction, state.weightStep)
            SpinnerField.REPS -> reps = stepReps(reps, direction)
        }
    }

    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(setKey) { focusRequester.requestFocus() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PumploNavy)
            .padding(horizontal = 10.dp, vertical = 6.dp)
            .onRotaryScrollEvent { event ->
                bump(if (event.verticalScrollPixels > 0) 1 else -1)
                true
            }
            .focusRequester(focusRequester)
            .focusable(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = state.exerciseName,
            color = PumploWhite,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            maxLines = 2,
        )
        Text(
            text = "${slotLabel(state.slotCategory)} · série ${state.setIndex + 1} z ${state.totalSets}",
            color = PumploCyan,
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.height(6.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            SpinnerBox(
                label = "KG",
                value = formatWeight(weight),
                active = field == SpinnerField.WEIGHT,
                onSelect = { field = SpinnerField.WEIGHT },
                onDrag = { direction ->
                    field = SpinnerField.WEIGHT
                    weight = stepWeight(weight, direction, state.weightStep)
                },
            )
            SpinnerBox(
                label = "OPAK.",
                value = reps.toString(),
                active = field == SpinnerField.REPS,
                onSelect = { field = SpinnerField.REPS },
                onDrag = { direction ->
                    field = SpinnerField.REPS
                    reps = stepReps(reps, direction)
                },
            )
        }

        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "Cíl ${state.repMin}–${state.repMax}" + (state.rir?.let { " · RIR $it" } ?: ""),
            color = PumploCyan,
            fontSize = 11.sp,
        )
        if (state.prevWeight != null || state.prevReps != null) {
            Text(
                text = "Naposledy: ${formatWeight(state.prevWeight)} kg × ${state.prevReps ?: "–"}",
                color = PumploMuted,
                fontSize = 10.sp,
            )
        }

        Spacer(modifier = Modifier.height(6.dp))
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Button(
                onClick = { onAction(WatchAction.GoPrevSet) },
                colors = ButtonDefaults.secondaryButtonColors(backgroundColor = PumploCard),
                modifier = Modifier.size(36.dp),
            ) { Text(text = "‹", color = PumploWhite, fontSize = 16.sp) }

            Button(
                onClick = { onAction(WatchAction.LogSet(weight, reps)) },
                colors = ButtonDefaults.primaryButtonColors(backgroundColor = PumploCyan),
                modifier = Modifier.size(48.dp),
            ) { Text(text = "✓", color = PumploNavy, fontSize = 20.sp, fontWeight = FontWeight.Bold) }

            Button(
                onClick = { onAction(WatchAction.GoNextSet) },
                colors = ButtonDefaults.secondaryButtonColors(backgroundColor = PumploCard),
                modifier = Modifier.size(36.dp),
            ) { Text(text = "›", color = PumploWhite, fontSize = 16.sp) }
        }
    }
}

// Rotary drives the active field; a vertical drag does the same thing so the
// value can also be changed with a mouse on the Wear OS emulator.
@Composable
private fun SpinnerBox(
    label: String,
    value: String,
    active: Boolean,
    onSelect: () -> Unit,
    onDrag: (Int) -> Unit,
) {
    Column(
        modifier = Modifier
            .width(74.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(PumploCard)
            .border(
                width = if (active) 2.dp else 0.dp,
                color = if (active) PumploCyan else PumploCard,
                shape = RoundedCornerShape(12.dp),
            )
            .clickable { onSelect() }
            .pointerInput(label) {
                var accumulated = 0f
                detectVerticalDragGestures(
                    onDragEnd = { accumulated = 0f },
                ) { _, dragAmount ->
                    accumulated -= dragAmount
                    while (accumulated >= DRAG_PIXELS_PER_STEP) {
                        accumulated -= DRAG_PIXELS_PER_STEP
                        onDrag(1)
                    }
                    while (accumulated <= -DRAG_PIXELS_PER_STEP) {
                        accumulated += DRAG_PIXELS_PER_STEP
                        onDrag(-1)
                    }
                }
            }
            .padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = label, color = PumploMuted, fontSize = 10.sp)
        Text(text = value, color = PumploWhite, fontSize = 24.sp, fontWeight = FontWeight.Bold)
    }
}

```

- [ ] **Step 2: Zobrazit ji ve fázi `SET`**

V `MainActivity.kt` nahradit obsah `setContent { … }` (blok `Box { Text(...) }`) za:
```kotlin
            val state by repository.state.collectAsState()
            val current = state
            if (current != null && current.phase == WatchPhase.SET) {
                ActiveSetScreen(state = current, onAction = { repository.send(it) })
            } else {
                Box(
                    modifier = Modifier.fillMaxSize().background(PumploNavy).padding(12.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(text = current?.phase?.name ?: "Čekám na telefon…", color = PumploCyan, textAlign = TextAlign.Center)
                }
            }
```
a doplnit importy `com.pumplo.wear.ui.ActiveSetScreen`, `com.pumplo.wear.WatchPhase`.

- [ ] **Step 3: Build**

```bash
cd /Users/davidnovotny/pumplo/android && ./gradlew :wear:assembleDebug
```
Expected: BUILD SUCCESSFUL (bez warningů o nepoužitých importech — pokud nějaké jsou, importy odstranit).

- [ ] **Step 4: MANUAL CHECKPOINT — porovnat s mockupem a odeslat sérii**

```bash
cd /Users/davidnovotny/pumplo/android && adb -s emulator-5556 install -r wear/build/outputs/apk/debug/wear-debug.apk
```
Na telefonu spustit trénink, na hodinkách otevřít Pumplo a projít:
1. Rozvržení odpovídá levému panelu `~/Desktop/pumplo-watch-mockup.png` — název cviku, „Hlavní · série 2 z 3" (cyan), dvě pole KG / OPAK., „Cíl 8–12 · RIR 2", „Naposledy: 37,5 kg × 10", dole ‹ ✓ ›.
2. Aktivní pole má cyan rámeček; ťuknutí na druhé pole rámeček přehodí.
3. Korunka: v emulátoru **Extended controls → Wear OS → rotary input** (nebo boční kolečko emulátoru) — KG se mění po 0,5, OPAK. po 1. Fallback ověření: tažení prstem/myší nahoru–dolů po aktivním poli mění hodnotu stejně.
4. ✓ zapíše sérii — na telefonu se série odškrtne a spustí se pauza; log telefonu ukáže `watchAction -> JS: logSet|…`.
5. ‹ a › posunou sérii na telefonu (pokud Plán B ještě `goPrevSet`/`goNextSet` nezpracovává, ověř aspoň řádek `watchAction -> JS: goNextSet` v logu telefonu a poznamenej to do zprávy o dokončení tasku).

- [ ] **Step 5: Commit**

```bash
cd /Users/davidnovotny/pumplo
git add android/wear/src
git commit -m "feat(watch/wear): active set screen with rotary spinners and log/prev/next controls"
```

---

### Task 7: Obrazovka pauzy — kruhový odpočet, haptika, +15 s / Přeskočit

**Files:**
- Create: `android/wear/src/main/java/com/pumplo/wear/RestMath.kt`
- Create: `android/wear/src/main/java/com/pumplo/wear/WatchHaptics.kt`
- Create: `android/wear/src/main/java/com/pumplo/wear/ui/RestScreen.kt`
- Modify: `android/wear/src/main/java/com/pumplo/wear/MainActivity.kt`
- Test: `android/wear/src/test/java/com/pumplo/wear/RestMathTest.kt`

**Interfaces:**
- Consumes: `WatchWorkoutState`, `WatchAction`, barvy z `com.pumplo.wear.ui`.
- Produces:
  ```kotlin
  fun remainingSeconds(restEndsAt: Long?, now: Long): Int      // 0 když null nebo po konci
  fun formatClock(totalSeconds: Int): String                   // 72 -> "1:12"
  fun updatedRestTotal(prevEndsAt: Long?, newEndsAt: Long, now: Long, currentTotal: Long): Long
  class WatchHaptics(context: Context) { fun tick(); fun finish() }
  @Composable fun RestScreen(state: WatchWorkoutState, onAction: (WatchAction) -> Unit)
  ```

- [ ] **Step 1: Napsat padající testy rest matematiky**

Create `android/wear/src/test/java/com/pumplo/wear/RestMathTest.kt`:
```kotlin
package com.pumplo.wear

import org.junit.Assert.assertEquals
import org.junit.Test

class RestMathTest {

    private val now = 1_753_400_000_000L

    @Test
    fun roundsRemainingUpToWholeSeconds() {
        assertEquals(72, remainingSeconds(now + 71_400, now))
        assertEquals(1, remainingSeconds(now + 10, now))
    }

    @Test
    fun clampsFinishedAndMissingRest() {
        assertEquals(0, remainingSeconds(now - 5_000, now))
        assertEquals(0, remainingSeconds(null, now))
    }

    @Test
    fun formatsClock() {
        assertEquals("1:12", formatClock(72))
        assertEquals("0:09", formatClock(9))
        assertEquals("0:00", formatClock(0))
        assertEquals("2:00", formatClock(120))
    }

    @Test
    fun firstRestSetsTotalFromNow() {
        assertEquals(90_000L, updatedRestTotal(null, now + 90_000, now, 0L))
    }

    @Test
    fun addingFifteenSecondsGrowsTheTotal() {
        val total = updatedRestTotal(null, now + 90_000, now, 0L)
        assertEquals(105_000L, updatedRestTotal(now + 90_000, now + 105_000, now + 30_000, total))
    }

    @Test
    fun totalNeverDropsBelowOne() {
        assertEquals(1L, updatedRestTotal(now + 90_000, now + 10_000, now, 5_000L))
    }
}
```

- [ ] **Step 2: Spustit testy — musí selhat**

```bash
cd /Users/davidnovotny/pumplo/android && ./gradlew :wear:testDebugUnitTest --tests '*RestMathTest*'
```
Expected: FAIL — `unresolved reference: remainingSeconds`.

- [ ] **Step 3: Implementovat rest matematiku**

Create `android/wear/src/main/java/com/pumplo/wear/RestMath.kt`:
```kotlin
package com.pumplo.wear

import java.util.Locale
import kotlin.math.ceil
import kotlin.math.max

// The watch counts down locally from restEndsAt, so a short connection drop
// does not freeze the timer.
fun remainingSeconds(restEndsAt: Long?, now: Long): Int {
    if (restEndsAt == null) return 0
    val ms = restEndsAt - now
    if (ms <= 0L) return 0
    return ceil(ms / 1000.0).toInt()
}

fun formatClock(totalSeconds: Int): String {
    val safe = max(0, totalSeconds)
    return String.format(Locale.US, "%d:%02d", safe / 60, safe % 60)
}

// Ring length: measured on rest entry, then grown by every +15 s the phone
// confirms, so the arc keeps its meaning instead of snapping back to full.
fun updatedRestTotal(prevEndsAt: Long?, newEndsAt: Long, now: Long, currentTotal: Long): Long {
    val next = if (prevEndsAt == null) newEndsAt - now else currentTotal + (newEndsAt - prevEndsAt)
    return max(1L, next)
}
```

- [ ] **Step 4: Spustit testy — musí projít**

```bash
cd /Users/davidnovotny/pumplo/android && ./gradlew :wear:testDebugUnitTest
```
Expected: PASS (20 testů celkem).

- [ ] **Step 5: Haptika**

Create `android/wear/src/main/java/com/pumplo/wear/WatchHaptics.kt`:
```kotlin
package com.pumplo.wear

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

// Countdown feedback: a short tick at 3/2/1 and a firmer double buzz at zero.
class WatchHaptics(context: Context) {

    private val vibrator: Vibrator? = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = context.getSystemService(VibratorManager::class.java)
            manager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Vibrator::class.java)
        }
    } catch (t: Throwable) {
        null
    }

    fun tick() = play(VibrationEffect.createOneShot(30L, 90))

    fun finish() = play(VibrationEffect.createWaveform(longArrayOf(0L, 140L, 90L, 220L), -1))

    private fun play(effect: VibrationEffect) {
        try {
            vibrator?.takeIf { it.hasVibrator() }?.vibrate(effect)
        } catch (t: Throwable) {
            // No vibrator (emulator without haptics) — silently ignore.
        }
    }
}
```

- [ ] **Step 6: Implementovat obrazovku pauzy**

Create `android/wear/src/main/java/com/pumplo/wear/ui/RestScreen.kt`:
```kotlin
package com.pumplo.wear.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.Text
import com.pumplo.wear.WatchAction
import com.pumplo.wear.WatchHaptics
import com.pumplo.wear.WatchWorkoutState
import com.pumplo.wear.formatClock
import com.pumplo.wear.remainingSeconds
import com.pumplo.wear.updatedRestTotal
import kotlinx.coroutines.delay

@Composable
fun RestScreen(state: WatchWorkoutState, onAction: (WatchAction) -> Unit) {
    val context = LocalContext.current
    val haptics = remember { WatchHaptics(context) }

    var now by remember { mutableStateOf(System.currentTimeMillis()) }
    var totalMs by remember { mutableStateOf(1L) }
    var prevEndsAt by remember { mutableStateOf<Long?>(null) }

    LaunchedEffect(state.restEndsAt) {
        val endsAt = state.restEndsAt
        if (endsAt != null) {
            totalMs = updatedRestTotal(prevEndsAt, endsAt, System.currentTimeMillis(), totalMs)
            prevEndsAt = endsAt
        }
    }

    LaunchedEffect(Unit) {
        while (true) {
            now = System.currentTimeMillis()
            delay(200L)
        }
    }

    val remaining = remainingSeconds(state.restEndsAt, now)
    LaunchedEffect(remaining) {
        when {
            remaining in 1..3 -> haptics.tick()
            remaining == 0 && state.restEndsAt != null -> haptics.finish()
        }
    }

    val progress = ((state.restEndsAt ?: 0L) - now).toFloat() / totalMs.toFloat()

    Column(
        modifier = Modifier.fillMaxSize().background(PumploNavy).padding(horizontal = 10.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(contentAlignment = Alignment.Center) {
            CircularProgressIndicator(
                progress = progress.coerceIn(0f, 1f),
                modifier = Modifier.size(96.dp),
                indicatorColor = PumploCyan,
                trackColor = PumploCard,
                strokeWidth = 6.dp,
            )
            Text(
                text = formatClock(remaining),
                color = PumploWhite,
                fontSize = 30.sp,
                fontWeight = FontWeight.Bold,
            )
        }

        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = "Pauza" + (state.nextSetLabel?.let { " · pak $it" } ?: ""),
            color = PumploMuted,
            fontSize = 12.sp,
        )
        Spacer(modifier = Modifier.height(6.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = { onAction(WatchAction.AddRest15) },
                colors = ButtonDefaults.secondaryButtonColors(backgroundColor = PumploCard),
            ) { Text(text = "+15 s", color = PumploWhite, fontSize = 12.sp) }

            Button(
                onClick = { onAction(WatchAction.SkipRest) },
                colors = ButtonDefaults.secondaryButtonColors(backgroundColor = PumploCard),
            ) { Text(text = "Přeskočit", color = PumploWhite, fontSize = 12.sp) }
        }
    }
}
```

- [ ] **Step 7: Zobrazit ve fázi `REST`**

V `MainActivity.kt` rozšířit větvení:
```kotlin
            when {
                current == null -> WaitingBox()
                current.phase == WatchPhase.REST -> RestScreen(state = current, onAction = { repository.send(it) })
                current.phase == WatchPhase.SET -> ActiveSetScreen(state = current, onAction = { repository.send(it) })
                else -> WaitingBox()
            }
```
a přidat dočasnou privátní composable `WaitingBox()` v `MainActivity.kt` (v Tasku 8 ji nahradí `PumploWatchApp`):
```kotlin
@Composable
private fun WaitingBox() {
    Box(
        modifier = Modifier.fillMaxSize().background(PumploNavy).padding(12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = "Čekám na telefon…", color = PumploCyan, textAlign = TextAlign.Center)
    }
}
```

- [ ] **Step 8: Build + testy**

```bash
cd /Users/davidnovotny/pumplo/android && ./gradlew :wear:testDebugUnitTest :wear:assembleDebug
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 9: MANUAL CHECKPOINT — pauza na hodinkách**

```bash
cd /Users/davidnovotny/pumplo/android && adb -s emulator-5556 install -r wear/build/outputs/apk/debug/wear-debug.apk
```
Na telefonu odklikat sérii, aby naběhla pauza.
1. Hodinky ukáží kruhový odpočet, čas ve tvaru `1:12`, popisek „Pauza · pak 3. série" (nebo jen „Pauza", když web `nextSetLabel` neposílá).
2. Odpočet běží plynule i po `adb -s emulator-5556 shell svc wifi disable`? (emulátor Data Layer nepoužívá wifi — místo toho zavři telefonní appku na 5 s: odpočet na hodinkách nesmí zamrznout).
3. „+15 s" → čas na hodinkách i na telefonu vyskočí o 15 s, kruh se nepřetočí zpět na plno.
4. „Přeskočit" → pauza na telefonu skončí, hodinky se vrátí na obrazovku série.
5. Haptika: Wear OS emulátor vibrace nesimuluje — ověř v logu `adb -s emulator-5556 logcat -s VibratorManagerService:D` výskyt vibrací v posledních 3 sekundách a na konci odpočtu.

- [ ] **Step 10: Commit**

```bash
cd /Users/davidnovotny/pumplo
git add android/wear/src
git commit -m "feat(watch/wear): rest screen with local countdown, haptics and +15s/skip"
```

---

### Task 8: Okrajové stavy (čekání, souhrn) + routing podle fáze

**Files:**
- Create: `android/wear/src/main/java/com/pumplo/wear/ui/EdgeScreens.kt`
- Create: `android/wear/src/main/java/com/pumplo/wear/ui/PumploWatchApp.kt`
- Modify: `android/wear/src/main/java/com/pumplo/wear/MainActivity.kt`

**Interfaces:**
- Consumes: `ActiveSetScreen`, `RestScreen`, `WatchWorkoutState`, `WatchPhase`, `WatchAction`.
- Produces:
  ```kotlin
  @Composable fun IdleScreen()
  @Composable fun SummaryScreen()
  @Composable fun PumploWatchApp(state: WatchWorkoutState?, onAction: (WatchAction) -> Unit)
  ```

- [ ] **Step 1: Okrajové obrazovky**

Create `android/wear/src/main/java/com/pumplo/wear/ui/EdgeScreens.kt`:
```kotlin
package com.pumplo.wear.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Text

@Composable
fun IdleScreen() {
    Column(
        modifier = Modifier.fillMaxSize().background(PumploNavy).padding(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(text = "Pumplo", color = PumploCyan, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text(
            text = "Čekám na telefon…",
            color = PumploWhite,
            fontSize = 13.sp,
            textAlign = TextAlign.Center,
        )
        Text(
            text = "Spusť trénink v aplikaci",
            color = PumploMuted,
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
fun SummaryScreen() {
    Column(
        modifier = Modifier.fillMaxSize().background(PumploNavy).padding(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(text = "Hotovo", color = PumploCyan, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text(
            text = "Trénink dokončen",
            color = PumploWhite,
            fontSize = 13.sp,
            textAlign = TextAlign.Center,
        )
        Text(
            text = "Souhrn najdeš v telefonu",
            color = PumploMuted,
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
        )
    }
}
```

- [ ] **Step 2: Routing**

Create `android/wear/src/main/java/com/pumplo/wear/ui/PumploWatchApp.kt`:
```kotlin
package com.pumplo.wear.ui

import androidx.compose.runtime.Composable
import com.pumplo.wear.WatchAction
import com.pumplo.wear.WatchPhase
import com.pumplo.wear.WatchWorkoutState

// state == null means the phone has published nothing yet (or endState()
// deleted the snapshot) — the watch is a passive controller in v1.
@Composable
fun PumploWatchApp(state: WatchWorkoutState?, onAction: (WatchAction) -> Unit) {
    when {
        state == null -> IdleScreen()
        state.phase == WatchPhase.SUMMARY -> SummaryScreen()
        state.phase == WatchPhase.IDLE -> IdleScreen()
        state.phase == WatchPhase.REST || state.resting -> RestScreen(state = state, onAction = onAction)
        else -> ActiveSetScreen(state = state, onAction = onAction)
    }
}
```

- [ ] **Step 3: Zjednodušit `MainActivity`**

Přepsat tělo `setContent` v `android/wear/src/main/java/com/pumplo/wear/MainActivity.kt` na:
```kotlin
        setContent {
            val state by repository.state.collectAsState()
            PumploWatchApp(state = state, onAction = { repository.send(it) })
        }
```
a odstranit dočasnou `WaitingBox()` i nepoužité importy (`Box`, `background`, `padding`, `TextAlign`, `Text`, barvy) — v souboru zůstanou jen `ComponentActivity`, `setContent`, `collectAsState`, `PumploWatchApp`, `WearableRepository`, `WindowManager`.

- [ ] **Step 4: Build**

```bash
cd /Users/davidnovotny/pumplo/android && ./gradlew :wear:testDebugUnitTest :wear:assembleDebug
```
Expected: BUILD SUCCESSFUL, žádné warningy o nepoužitých importech.

- [ ] **Step 5: MANUAL CHECKPOINT — okrajové stavy**

```bash
cd /Users/davidnovotny/pumplo/android && adb -s emulator-5556 install -r wear/build/outputs/apk/debug/wear-debug.apk
```
1. Otevřít Pumplo na hodinkách bez běžícího tréninku → „Pumplo / Čekám na telefon… / Spusť trénink v aplikaci".
2. Spustit trénink → do ~1 s naskočí obrazovka série.
3. Dokončit trénink na telefonu → hodinky ukážou „Hotovo / Trénink dokončen" a po odchodu z tréninku (plugin volá `endState`) spadnou na idle.
4. Zavřít appku na hodinkách a znovu otevřít během běžícího tréninku → stav se okamžitě načte (`refresh()` přes `getDataItems`), ne „Čekám na telefon…".

- [ ] **Step 6: Commit**

```bash
cd /Users/davidnovotny/pumplo
git add android/wear/src
git commit -m "feat(watch/wear): idle and summary screens with phase routing"
```

---

### Task 9: Runbook pro emulátory + E2E ověření celé cesty

**Files:**
- Create: `docs/superpowers/specs/2026-07-25-wear-os-testing-runbook.md`

**Interfaces:**
- Consumes: vše z Tasků 1–8.
- Produces: opakovatelný postup, kterým se Wear OS větev testuje bez fyzického zařízení.

- [ ] **Step 1: Napsat runbook**

Create `docs/superpowers/specs/2026-07-25-wear-os-testing-runbook.md`:
````markdown
# Wear OS — testovací runbook (emulátor ↔ emulátor)

**Datum:** 2026-07-25 · **Platí pro:** `android/wear` (modul `:wear`) + `WatchWorkoutPlugin` v `:app`

Fyzické Wear OS zařízení nemáme, takže vše se testuje na dvojici emulátorů.

## 0. Prostředí

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$HOME/Library/Android/sdk/platform-tools:$HOME/Library/Android/sdk/emulator:$PATH"
```

## 1. Jednorázová příprava

1. Android Studio → Device Manager → Create Device → **Wear OS Large Round**, image API 34 (x86_64), název `Wear_OS_Large_Round_API_34`.
2. Telefonní AVD musí být **google_apis_playstore** (kvůli appce Wear OS) — existující `Medium_Phone…` to splňuje.

## 2. Start a párování

```bash
emulator -list-avds
emulator -avd <telefonni_avd> & sleep 40
emulator -avd Wear_OS_Large_Round_API_34 & sleep 60
adb devices          # telefon = emulator-5554, hodinky = emulator-5556
```

Párování: Device Manager → řádek telefonu → ⋮ → **Pair Wearable**.
Fallback: `adb -s emulator-5556 forward tcp:5601 tcp:5601`, pak na telefonu appka **Wear OS** → *Pair with emulator*.

## 3. Instalace

```bash
cd ~/pumplo && npm run build && npx cap sync android
cd android
ANDROID_SERIAL=emulator-5554 ./gradlew :app:installDebug
./gradlew :wear:assembleDebug
adb -s emulator-5556 install -r wear/build/outputs/apk/debug/wear-debug.apk
```

⚠️ `:wear` má **stejný `applicationId` (`com.pumplo.app`)** jako telefonní appka — to Data Layer vyžaduje. Nikdy nespouštěj `:wear:installDebug` bez `ANDROID_SERIAL` hodinek, přepsalo by to telefonní appku.

## 4. Logy

```bash
adb -s emulator-5554 logcat -s PumploWatch:D    # telefonní plugin
adb -s emulator-5556 logcat -s PumploWear:D     # hodinky
```

## 5. E2E scénáře

| # | Krok | Očekávaný výsledek |
|---|---|---|
| 1 | Hodinky otevřené bez tréninku | „Čekám na telefon…" |
| 2 | Start tréninku na telefonu | do ~1 s obrazovka série s názvem cviku a „série 1 z N" |
| 3 | Korunka / tažení po poli KG | hodnota se mění po 0,5 |
| 4 | Ťuk na pole OPAK. | cyan rámeček se přesune, korunka mění opakování po 1 |
| 5 | ✓ | série na telefonu odškrtnutá se stejnou váhou/opakováními, log `watchAction -> JS: logSet\|…` |
| 6 | Start pauzy | do 1 s kruhový odpočet (`setUrgent`), plynulý i po zavření telefonní appky |
| 7 | +15 s | čas na obou zařízeních +15 s, kruh se nevrátí na plno |
| 8 | Přeskočit | pauza končí na telefonu, hodinky zpět na sérii |
| 9 | ‹ / › | telefon posune sérii (nebo aspoň log `goPrevSet`/`goNextSet`, dokud to Plán B nedopojí) |
| 10 | Dokončení tréninku | „Hotovo / Trénink dokončen", po odchodu idle |
| 11 | Restart appky na hodinkách během tréninku | okamžitě aktuální stav (ne idle) |
| 12 | Telefon bez spárovaných hodinek | trénink funguje beze změn, žádný pád |

## 6. Když nic nedorazí

1. `adb -s emulator-5556 shell dumpsys package com.pumplo.app | head` — balíček musí být na obou stejný a podepsaný stejným debug klíčem.
2. Znovu projít párování (bod 2) — po restartu emulátoru párování občas vypadne.
3. Zkontrolovat, že telefonní appka běží v popředí (v1 předpokládá vzhůru telefon).
````

- [ ] **Step 2: Projít celý runbook od nuly**

Zavřít oba emulátory, spustit runbook krok za krokem od bodu 2 a odškrtat scénáře 1–12 z tabulky.
Expected: všech 12 scénářů projde. Co neprojde, zapsat do zprávy o dokončení plánu (ne opravovat mimo rozsah — `goPrevSet`/`goNextSet`/`addRest15` na webové straně dodává Plán B).

- [ ] **Step 3: Commit**

```bash
cd /Users/davidnovotny/pumplo
git add docs/superpowers/specs/2026-07-25-wear-os-testing-runbook.md
git commit -m "docs(watch/wear): emulator pairing and E2E testing runbook"
```

---

## Rizika a vědomá omezení

- **Verze knihoven** (Kotlin 2.2.0, Compose UI 1.8.0, Wear Compose 1.4.1, play-services-wearable 18.2.0) jsou zvolené konzervativně; kdyby některá neexistovala v mavenu, vzít nejbližší stabilní — kód na konkrétní verzi nezávisí.
- **`goPrevSet` / `goNextSet` / `addRest15`** se z hodinek odesílají a plugin je vystrčí do JS, ale webová strana je zpracuje až v Plánu B. Do té doby se v manuálních checkpointech ověřuje jen doručení do JS (log).
- **`restEndsAt`** je v Plánu A jen orientační (`Date.now() + restSeconds*1000`); přesný čas z `RestTimer` dodá Plán B. Odpočet na hodinkách proto může být o zlomky sekundy vedle telefonu.
- **Ambientní režim** (ztlumená obrazovka na zápěstí) v1 neřešíme — držíme `FLAG_KEEP_SCREEN_ON`. Pro delší tréninky to na baterii poznamenat do v2.
- **Kruhový odpočet po pozdním připojení**: když se appka na hodinkách otevře uprostřed pauzy, prstenec začne od naměřeného zbytku (ne od původní délky). Vizuální detail, ne funkční chyba.
- **Duplicitní `applicationId`** `:app` i `:wear` je záměr (Data Layer), ale znamená, že `:wear:installDebug` bez správného `ANDROID_SERIAL` přepíše telefonní appku — v runbooku zvýrazněno.

## Self-Review

**1. Pokrytí specu.** Telefonní strana Data Layeru (`DataClient` stav + `MessageClient` akce + no-op bez hodinek + registrace) = Tasky 1–2. Nový `wear/` modul s Gradle/manifestem/párovací capability = Task 3. Obrazovka aktivní série se spinnery, rotary vstupem, cyan rámečkem, cílem/RIR, „Naposledy" a ‹ ✓ › = Task 6. Pauza s kruhovým odpočtem, lokálním tikáním, haptikou 3/2/1/0 a +15 s / Přeskočit = Task 7. Okraje (čekání, souhrn) = Task 8. Testovací strategie (Gradle unit testy, build ověření, Wear AVD spárovaný přes ADB, manuální checkpointy) = Tasky 1, 2, 4, 7 (unit) + checkpointy v 2, 3, 5, 6, 7, 8 + runbook v 9. Nepokryto **záměrně**: „start tréninku tlačítkem Začít" z hodinek (v1 je telefon zdroj pravdy a `WatchAction` union žádnou takovou akci nemá), tepovka a nezávislý režim (spec je má ve v2).

**2. Placeholdery.** Žádné „TBD"/„doplň dle potřeby": každý krok má buď hotový kód, nebo přesný příkaz s očekávaným výstupem. Jediná „až později" místa jsou explicitně odkázaná na Plán B (webové zpracování `goPrevSet`/`goNextSet`/`addRest15`) a na v2 (ambient, tepovka), obojí i v sekci Rizika.

**3. Konzistence typů.** Drátové cesty a klíče se shodují napříč moduly: `/pumplo/workout-state` (`WatchStateBridge.STATE_PATH` ↔ `STATE_PATH` v `WatchAction.kt`), `/pumplo/action` (`WatchActionCodec.ACTION_PATH` ↔ `ACTION_PATH`), `json` / `updatedAt` (`KEY_JSON`, `KEY_UPDATED_AT` na obou stranách). Řetězce akcí testují literály na obou stranách (`logSet|40.5|10`, `logSet|-|8`, `goPrevSet`, `goNextSet`, `skipRest`, `addRest15`), takže se implementace nemohou rozejít. Kotlin API: `watchStateFromMap`, `encodeWatchAction`, `formatWeight`, `stepWeight`, `stepReps`, `slotLabel`, `remainingSeconds`, `formatClock`, `updatedRestTotal`, `WearableRepository.start/stop/send`, `PumploWatchApp/ActiveSetScreen/RestScreen/IdleScreen/SummaryScreen` — každé je definované v tasku, kde vzniká, a používané pod stejným jménem ve všech pozdějších. Java API: `WatchAction(type, weight, reps)`, `WatchActionCodec.decode`, `WatchStateBridge.shouldSend` — beze změny jména od Tasku 1/2 dál. Pole snapshotu odpovídají 1:1 `src/lib/watchWorkout.ts` (ověřeno čtením souboru).
