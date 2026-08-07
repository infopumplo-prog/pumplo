# Watch App — Plán A: Webový kontrakt + WatchWorkout plugin (foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web (React) sestaví na každou změnu tréninku snapshot `WatchWorkoutState`, pošle ho přes Capacitor plugin `WatchWorkout`, a přijme zpět akce z hodinek, které zavolá stávající workout handlery — platformově nezávislý základ pro Apple Watch i Wear OS.

**Architecture:** Čistá funkce `buildWatchWorkoutState()` mapuje živý stav `WorkoutSession` na plochý snapshot. Tenký wrapper `WatchWorkout` (přes `registerPlugin`) posílá snapshot do nativu a vystavuje listener akcí; na webu/bez nativu je no-op. Wiring ve `WorkoutSession.tsx` volá `updateState` z efektu na změnách a akce mapuje na `handleCompactCompleteSet` / `handleRestComplete`. Nativní implementace (iOS/Android) jsou zatím prázdné stuby — dodá je plán B a C.

**Tech Stack:** React/TypeScript, Vite, Capacitor (`@capacitor/core` `registerPlugin`), vitest (nově, jen pro čistou logiku).

## Global Constraints

- TypeScript strict mode; před hotovo vždy `npx tsc --noEmit` = 0 chyb (CLAUDE.md).
- Plugin API musí být **no-op na webu a když nativní plugin chybí** (vzor `src/lib/restLiveActivity.ts`): `if (!Capacitor.isNativePlatform()) return;` + `try/catch` kolem volání.
- Krok váhy 0,5 kg, opakování 1 (parita s Hevy).
- Brand konstanty se zde neřeší (UI je až v B/C).
- Znovupoužít stávající handlery, nezavádět paralelní logiku: `handleCompactCompleteSet(exIdx,setIdx,weight?,reps?)`, `handleRestComplete()`.

---

## File Structure

- `src/lib/watchWorkout.ts` — **Create.** Typy `WatchWorkoutState` + `WatchAction`; `buildWatchWorkoutState(input)` (čistá); plugin wrapper `updateWatchState()`, `endWatchState()`, `addWatchActionListener()`.
- `src/lib/watchWorkout.test.ts` — **Create.** Unit testy pro `buildWatchWorkoutState`.
- `src/components/workout/WorkoutSession.tsx` — **Modify.** Efekt posílající snapshot na změnách; listener akcí → handlery.
- `vitest.config.ts` + `package.json` — **Modify.** Přidat vitest + `test` skript.

---

### Task 1: vitest + čistá funkce `buildWatchWorkoutState`

**Files:**
- Modify: `package.json` (devDependency `vitest`, skript `"test": "vitest run"`)
- Create: `vitest.config.ts`
- Create: `src/lib/watchWorkout.ts` (zatím jen typy + `buildWatchWorkoutState`)
- Test: `src/lib/watchWorkout.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface WatchWorkoutState {
    phase: 'set' | 'rest' | 'summary' | 'idle';
    exerciseName: string;
    slotCategory: string | null;
    setIndex: number;      // 0-based
    totalSets: number;
    targetWeight: number | null;
    targetReps: number;
    repMin: number;
    repMax: number;
    rir: number | null;
    prevWeight: number | null;
    prevReps: number | null;
    weightStep: number;    // 0.5
    resting: boolean;
    restEndsAt: number | null; // epoch ms
    nextSetLabel: string | null;
  }
  export interface BuildInput {
    phase: WatchWorkoutState['phase'];
    exerciseName: string; slotCategory: string | null;
    setIndex: number; totalSets: number;
    targetWeight: number | null; repMin: number; repMax: number; rir: number | null;
    prevWeight: number | null; prevReps: number | null;
    resting: boolean; restEndsAt: number | null; nextSetLabel: string | null;
  }
  export function buildWatchWorkoutState(input: BuildInput): WatchWorkoutState;
  ```
  `targetReps` = `repMax` (horní hranice rozsahu, konzistentní s appkou). `weightStep` = 0.5 vždy.

- [ ] **Step 1: Přidat vitest**

Run: `cd ~/pumplo && npm i -D vitest@^2`
Expected: nainstalováno, `package.json` má `vitest` v devDependencies.

- [ ] **Step 2: Přidat test skript + config**

`package.json` scripts: přidat `"test": "vitest run"`.
Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } });
```

- [ ] **Step 3: Napsat padající test**

Create `src/lib/watchWorkout.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildWatchWorkoutState } from './watchWorkout';

const base = {
  phase: 'set' as const, exerciseName: 'Šikmý tlak na prsa', slotCategory: 'main',
  setIndex: 1, totalSets: 3, targetWeight: 40, repMin: 8, repMax: 12, rir: 2,
  prevWeight: 37.5, prevReps: 10, resting: false, restEndsAt: null, nextSetLabel: null,
};

describe('buildWatchWorkoutState', () => {
  it('maps target reps to repMax and sets 0.5 weight step', () => {
    const s = buildWatchWorkoutState(base);
    expect(s.targetReps).toBe(12);
    expect(s.weightStep).toBe(0.5);
    expect(s.setIndex).toBe(1);
    expect(s.totalSets).toBe(3);
    expect(s.prevWeight).toBe(37.5);
  });
  it('passes rest fields through when resting', () => {
    const s = buildWatchWorkoutState({ ...base, phase: 'rest', resting: true, restEndsAt: 1000, nextSetLabel: '3. série' });
    expect(s.phase).toBe('rest');
    expect(s.resting).toBe(true);
    expect(s.restEndsAt).toBe(1000);
    expect(s.nextSetLabel).toBe('3. série');
  });
  it('handles null target weight (bodyweight/first time)', () => {
    const s = buildWatchWorkoutState({ ...base, targetWeight: null, prevWeight: null });
    expect(s.targetWeight).toBeNull();
  });
});
```

- [ ] **Step 4: Spustit test — musí selhat**

Run: `cd ~/pumplo && npm test`
Expected: FAIL — `buildWatchWorkoutState` neexistuje / import chyba.

- [ ] **Step 5: Minimální implementace**

Create `src/lib/watchWorkout.ts` (jen typy + funkce; plugin část přijde v Tasku 2):
```ts
export interface WatchWorkoutState {
  phase: 'set' | 'rest' | 'summary' | 'idle';
  exerciseName: string; slotCategory: string | null;
  setIndex: number; totalSets: number;
  targetWeight: number | null; targetReps: number; repMin: number; repMax: number; rir: number | null;
  prevWeight: number | null; prevReps: number | null; weightStep: number;
  resting: boolean; restEndsAt: number | null; nextSetLabel: string | null;
}
export interface BuildInput {
  phase: WatchWorkoutState['phase'];
  exerciseName: string; slotCategory: string | null;
  setIndex: number; totalSets: number;
  targetWeight: number | null; repMin: number; repMax: number; rir: number | null;
  prevWeight: number | null; prevReps: number | null;
  resting: boolean; restEndsAt: number | null; nextSetLabel: string | null;
}
export function buildWatchWorkoutState(i: BuildInput): WatchWorkoutState {
  return {
    phase: i.phase, exerciseName: i.exerciseName, slotCategory: i.slotCategory,
    setIndex: i.setIndex, totalSets: i.totalSets,
    targetWeight: i.targetWeight, targetReps: i.repMax, repMin: i.repMin, repMax: i.repMax, rir: i.rir,
    prevWeight: i.prevWeight, prevReps: i.prevReps, weightStep: 0.5,
    resting: i.resting, restEndsAt: i.restEndsAt, nextSetLabel: i.nextSetLabel,
  };
}
```

- [ ] **Step 6: Spustit test — musí projít**

Run: `cd ~/pumplo && npm test`
Expected: PASS (3 testy).

- [ ] **Step 7: Type-check + commit**

Run: `npx tsc --noEmit 2>&1 | head` → 0 chyb.
```bash
git add package.json vitest.config.ts src/lib/watchWorkout.ts src/lib/watchWorkout.test.ts
git commit -m "feat(watch): WatchWorkoutState builder + vitest"
```

---

### Task 2: Plugin wrapper `WatchWorkout` (JS API, no-op na webu)

**Files:**
- Modify: `src/lib/watchWorkout.ts` (přidat plugin wrapper)

**Interfaces:**
- Consumes: `WatchWorkoutState` z Tasku 1.
- Produces:
  ```ts
  export type WatchAction =
    | { type: 'logSet'; weight: number | null; reps: number }
    | { type: 'goPrevSet' } | { type: 'goNextSet' }
    | { type: 'skipRest' } | { type: 'addRest15' };
  export function updateWatchState(state: WatchWorkoutState): Promise<void>;
  export function endWatchState(): Promise<void>;
  export function addWatchActionListener(cb: (a: WatchAction) => void): () => void;
  ```

- [ ] **Step 1: Přidat wrapper (vzor restLiveActivity.ts)**

Append do `src/lib/watchWorkout.ts`:
```ts
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type WatchAction =
  | { type: 'logSet'; weight: number | null; reps: number }
  | { type: 'goPrevSet' } | { type: 'goNextSet' }
  | { type: 'skipRest' } | { type: 'addRest15' };

interface WatchWorkoutPlugin {
  updateState(state: WatchWorkoutState): Promise<void>;
  endState(): Promise<void>;
  addListener(event: 'watchAction', cb: (a: WatchAction) => void): Promise<PluginListenerHandle>;
}
const WatchWorkout = registerPlugin<WatchWorkoutPlugin>('WatchWorkout');

export async function updateWatchState(state: WatchWorkoutState): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await WatchWorkout.updateState(state); } catch { /* plugin missing → noop */ }
}
export async function endWatchState(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await WatchWorkout.endState(); } catch { /* noop */ }
}
export function addWatchActionListener(cb: (a: WatchAction) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handle = WatchWorkout.addListener('watchAction', cb);
  return () => { handle.then(h => h.remove()).catch(() => {}); };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | head` → 0 chyb.

- [ ] **Step 3: Commit**

```bash
git add src/lib/watchWorkout.ts
git commit -m "feat(watch): WatchWorkout plugin JS wrapper (no-op on web)"
```

---

### Task 3: Posílat snapshot z `WorkoutSession` na změnách

**Files:**
- Modify: `src/components/workout/WorkoutSession.tsx`

**Interfaces:**
- Consumes: `buildWatchWorkoutState`, `updateWatchState`, `endWatchState` z Tasků 1–2.
- Produces: snapshot posílaný na hodinky; žádný nový export.

- [ ] **Step 1: Import**

Do importů v `WorkoutSession.tsx` přidat:
```ts
import { buildWatchWorkoutState, updateWatchState, endWatchState, type WatchAction } from '@/lib/watchWorkout';
import { addWatchActionListener } from '@/lib/watchWorkout';
```

- [ ] **Step 2: Efekt posílající stav**

Přidat nový `useEffect` poblíž idle-card efektu (kolem řádku 790), který na relevantních závislostech sestaví a pošle snapshot. Zdroje dat už v komponentě existují: `currentExercise` (název, slotCategory, repMin/repMax, rir), `currentExerciseIndex`, `currentSetIndex`, `currentExWeight`, `showRestTimer`/`playerResting` (resting), `showSummary`. Rest end time bere z RestTimer `endsAt` — pokud není centrálně, použij `showRestTimer ? Date.now()+restBetweenSets*1000 : null` (v1 stačí orientační; přesný čas dodá plán B z RestTimeru).
```ts
useEffect(() => {
  const ex = liveExercises[currentExerciseIndex];
  if (!ex) return;
  if (showSummary) { updateWatchState(buildWatchWorkoutState({
    phase: 'summary', exerciseName: '', slotCategory: null, setIndex: 0, totalSets: 0,
    targetWeight: null, repMin: 0, repMax: 0, rir: null, prevWeight: null, prevReps: null,
    resting: false, restEndsAt: null, nextSetLabel: null })); return; }
  const resting = showRestTimer || playerResting;
  updateWatchState(buildWatchWorkoutState({
    phase: resting ? 'rest' : 'set',
    exerciseName: (isEn && ex.exerciseNameEn) ? ex.exerciseNameEn! : (ex.exerciseName || ''),
    slotCategory: ex.slotCategory ?? null,
    setIndex: currentSetIndex, totalSets: ex.sets,
    targetWeight: currentExWeight, repMin: ex.repMin, repMax: ex.repMax, rir: ex.rirMax ?? ex.rirMin ?? null,
    prevWeight: currentExWeight, prevReps: ex.repMax,
    resting, restEndsAt: resting ? Date.now() + getRestSecondsForCategory(goalId, ex.slotCategory) * 1000 : null,
    nextSetLabel: null,
  }));
}, [currentExerciseIndex, currentSetIndex, showRestTimer, playerResting, showSummary, currentExWeight, liveExercises, isEn, goalId]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Ukončit stav při odchodu**

K existujícímu unmount efektu (`useEffect(() => () => { endRestActivity(); }, [])`) přidat `endWatchState();` do cleanup.

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit 2>&1 | head` → 0 chyb; `npm run build 2>&1 | tail -2` → hotovo.

- [ ] **Step 5: Commit**

```bash
git add src/components/workout/WorkoutSession.tsx
git commit -m "feat(watch): push workout snapshot to WatchWorkout on state change"
```

---

### Task 4: Přijmout akce z hodinek a zavolat handlery

**Files:**
- Modify: `src/components/workout/WorkoutSession.tsx`

**Interfaces:**
- Consumes: `addWatchActionListener`, `WatchAction`; existující `handleCompactCompleteSet`, `handleRestComplete`, `findPendingSet`, `currentExerciseIndexRef`, `restShowingRef`, `stopRestBeeps`.
- Produces: akce z hodinek mění workout stav (a Task 3 pošle nový snapshot zpět = potvrzení).

- [ ] **Step 1: Listener akcí**

Přidat `useEffect` (mount-only, jako lock-screen listener kolem ř. 822):
```ts
useEffect(() => {
  const off = addWatchActionListener((a: WatchAction) => {
    if (a.type === 'logSet') {
      if (restShowingRef.current) return; // pauza běží → ignoruj log
      const target = findPendingSet(currentExerciseIndexRef.current);
      if (!target) return;
      const ex = liveExercises[target.exIdx]; if (!ex) return;
      handleCompactCompleteSet(target.exIdx, target.si, a.weight ?? undefined, a.reps);
    } else if (a.type === 'skipRest') {
      if (playerRestingRef.current) { playerSkipRestRef.current?.(); playerRestingRef.current = false; return; }
      if (restShowingRef.current) { stopRestBeeps(); cancelRestEndNotification(); handleRestComplete(); restShowingRef.current = false; }
    }
    // goPrevSet / goNextSet / addRest15 — dodá plán B (navigace mezi sériemi / úprava pauzy)
  });
  return off;
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```
(Pozn.: `playerRestingRef`, `playerSkipRestRef`, `restShowingRef`, `cancelRestEndNotification` už v komponentě existují z lock-screen fixů.)

- [ ] **Step 2: Type-check + build**

Run: `npx tsc --noEmit 2>&1 | head` → 0 chyb; `npm run build 2>&1 | tail -2`.

- [ ] **Step 3: Ověření v prohlížeči (no-op path)**

Spustit dev/build, otevřít trénink na webu → nesmí nastat žádná regrese (na webu je vše no-op). Ověřit v konzoli, že se nevolá nic navíc.

- [ ] **Step 4: Commit**

```bash
git add src/components/workout/WorkoutSession.tsx
git commit -m "feat(watch): apply watch actions (logSet/skipRest) to workout handlers"
```

---

### Task 5: Prázdné nativní stuby (aby JS plugin rezolvoval na zařízení)

**Files:**
- Create: `ios/App/App/WatchWorkoutPlugin.swift` (prázdný `CAPPlugin` s `updateState`/`endState`/`addListener` no-op) — registrace v plán B.
- Create: `android/app/src/main/java/.../WatchWorkoutPlugin.kt` (prázdný `@CapacitorPlugin`) — registrace v plán C.

- [ ] **Step 1: iOS stub**

```swift
import Capacitor
@objc(WatchWorkoutPlugin)
public class WatchWorkoutPlugin: CAPPlugin {
  @objc func updateState(_ call: CAPPluginCall) { call.resolve() }
  @objc func endState(_ call: CAPPluginCall) { call.resolve() }
}
```
(Plná WatchConnectivity implementace = plán B.)

- [ ] **Step 2: Android stub**

```kotlin
package com.pumplo.app
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
@CapacitorPlugin(name = "WatchWorkout")
class WatchWorkoutPlugin : Plugin() {
  @PluginMethod fun updateState(call: PluginCall) { call.resolve() }
  @PluginMethod fun endState(call: PluginCall) { call.resolve() }
}
```
(Plná Data Layer implementace = plán C.)

- [ ] **Step 3: Commit**

```bash
git add ios/App/App/WatchWorkoutPlugin.swift android/app/src/main/java/com/pumplo/app/WatchWorkoutPlugin.kt
git commit -m "feat(watch): empty native WatchWorkout plugin stubs (filled in B/C)"
```

---

## Navazující plány (dodá se, až se do nich pustíme se zařízením)

- **Plán B — iOS + watchOS:** registrace `WatchWorkoutPlugin` v `MainViewController`, plná `WCSession` implementace (updateApplicationContext + sendMessage), App Group, nový watchOS SwiftUI target s obrazovkami z mockupu, přesný `restEndsAt` z `RestTimer`. Test na Davidových Apple Watch + watchOS simulátoru.
- **Plán C — Android + Wear OS:** registrace pluginu, Wearable Data Layer (DataClient/MessageClient), nový `wear` Gradle modul (Compose for Wear), rotary input pro spinnery. Test přes Wear OS emulátor v Android Studiu.

## Self-Review

- **Spec coverage:** Plán A pokrývá „sdílený web kontrakt + plugin" ze specu (Architektura → Web + plugin JS). UI, WatchConnectivity, Data Layer, nativní appky = explicitně staženo do plánů B/C (device-bound). `restEndsAt` v v1 orientační, přesný v B — poznamenáno.
- **Placeholders:** žádné „TBD"; goPrevSet/goNextSet/addRest15 jsou vědomě odloženy do B s poznámkou (ne prázdný placeholder — v1 logSet+skipRest stačí na testovatelný základ).
- **Type consistency:** `WatchWorkoutState`, `BuildInput`, `WatchAction`, `buildWatchWorkoutState`, `updateWatchState`, `endWatchState`, `addWatchActionListener` konzistentní napříč Task 1–4.
