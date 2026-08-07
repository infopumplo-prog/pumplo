# Watch App — Plán B: iOS (WatchConnectivity) + watchOS appka Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pumplo trénink jde plnohodnotně ovládat z Apple Watch — hodinky ukazují aktuální sérii, umí zapsat váhu/opakování korunkou, odpočítávají pauzu s haptikou a posílají akce zpět do webu, který zůstává zdrojem pravdy.

**Architecture:** Web (React) posílá po každé změně plochý snapshot `WatchWorkoutState` do Capacitor pluginu `WatchWorkout`. Nativní iOS plugin ho přepošle přes `WCSession` (`updateApplicationContext` = nejnovější vždy přebije, `sendMessage` pro urgentní přechody typu start pauzy) do nové watchOS SwiftUI appky. Ta stav vykreslí, pauzu odpočítává lokálně z `restEndsAt` (plynulé i při krátkém výpadku spojení) a akce (`logSet`, `goPrevSet`, `goNextSet`, `skipRest`, `addRest15`) posílá zpět zprávou, kterou plugin vystřelí do JS jako event `watchAction`. Web je zpracuje STÁVAJÍCÍMI handlery — žádná paralelní logika tréninku.

**Tech Stack:** React/TypeScript + vitest (web), Capacitor 8 (`CAPPlugin` + `CAPBridgedPlugin`), Swift 5 / WatchConnectivity (iOS 15+), SwiftUI pro watchOS 10+, Xcode 26.3, ruby gem `xcodeproj` (úprava `project.pbxproj`), `swiftc` harness pro unit testy čisté Swift logiky.

## Global Constraints

- **Jazyk:** komentáře a dokumentace česky, kód (identifikátory, klíče, commit messages) anglicky. UI stringy na hodinkách jsou české (mockup je český) — v1 se nelokalizuje.
- **TypeScript strict mode**; před dokončením každého webového tasku `npx tsc --noEmit 2>&1 | head -20` = 0 chyb (CLAUDE.md).
- **Datový kontrakt se NEMĚNÍ.** `WatchWorkoutState` a `WatchAction` z `src/lib/watchWorkout.ts` (plán A) jsou zafixované: `phase: 'set'|'rest'|'summary'|'idle'`, `exerciseName`, `slotCategory`, `setIndex` (0-based), `totalSets`, `targetWeight`, `targetReps`, `repMin`, `repMax`, `rir`, `prevWeight`, `prevReps`, `weightStep` (vždy 0.5), `resting`, `restEndsAt` (epoch ms | null), `nextSetLabel`. Akce: `logSet{weight,reps}` | `goPrevSet` | `goNextSet` | `skipRest` | `addRest15`.
- **No-op bezpečnost:** plugin i watch appka musí být tiché, když hodinky nejsou spárované / watch app není nainstalovaná / WCSession není podporovaná — stejně jako `RestActivityPlugin`. Žádný `call.reject()`, žádný toast, žádný crash.
- **Krok váhy 0,5 kg, krok opakování 1** (parita s Hevy).
- **Brand:** navy `#0B1222` (pozadí), cyan `#4CC9FF` (akcenty, aktivní pole, primární tlačítka), tučný systémový font (Nunito na watchOS neinstalujeme).
- **Idempotence stavu:** každý snapshot nese rostoucí `seq`; hodinky zahodí zprávu se starším `seq`. `updateApplicationContext` sám o sobě drží jen poslední hodnotu.
- **iOS deployment target App targetu je 15.0**, widgety 16.2, nový watchOS target **10.0**. Bundle ID: app `com.pumplo.app`, watch app `com.pumplo.app.watchkitapp`, team `DF748BR59G`.
- **App target NEMÁ synchronizované složky** (jen `PumploWidgets` je `PBXFileSystemSynchronizedRootGroup`). Nový `.swift` soubor v `ios/App/App/` se NEZAČNE překládat sám — musí se přidat do `project.pbxproj` (task 5 to dělá skriptem). Nový watchOS target vytvořený Xcode 26 synchronizovanou složku má, takže tam stačí soubory zapsat.
- **Pozor:** `ios/App/App/WatchWorkoutPlugin.swift` z plánu A v projektu chybí (ověřeno — App target překládá jen 7 souborů a tenhle mezi nimi není). Bez tasku 5 by plugin nikdy neběžel.
- `npx cap sync ios` kopíruje jen web assety a SPM balíčky — nativní targety ani soubory nepřidává a nemaže.

---

## File Structure

**Web (existující, modifikace):**
- `src/lib/watchWorkout.ts` — **Modify.** Přibudou tři čisté funkce: `resolveWatchRestEndsAt`, `resolveLoggedWeight`, `resolveSetStep` (+ jejich typy). Plugin wrapper a `buildWatchWorkoutState` zůstávají beze změny.
- `src/lib/watchWorkout.test.ts` — **Modify.** Nové `describe` bloky pro tři funkce výše.
- `src/components/workout/WorkoutSession.tsx` — **Modify.** Jednotné hodiny pauzy pro snapshot, `nextSetLabel`, parita `logSet` s lock-screen ✓, obsluha `goPrevSet`/`goNextSet`/`addRest15`.
- `src/components/workout/ExercisePlayer.tsx` — **Modify.** Vlastní pauza dostane sdílitelný `endsAt` (hlásí ho rodiči) a expozici „přidej 15 s" přes ref.

**iOS (App target):**
- `ios/App/App/WatchPayload.swift` — **Create.** Čisté helpery transportu (sanitizace slovníku pro WCSession, detekce urgentní změny, validace příchozí akce). Bez Capacitoru a WatchConnectivity → testovatelné `swiftc`.
- `ios/App/App/WatchWorkoutPlugin.swift` — **Modify (přepsat).** `CAPPlugin` + `CAPBridgedPlugin` + `WCSessionDelegate`.
- `ios/App/App/MainViewController.swift` — **Modify.** Registrace instance pluginu.
- `ios/App/scripts/add_watch_plugin_files.rb` — **Create.** Přidá dva soubory výše do App targetu v `project.pbxproj`.

**watchOS (nový target `PumploWatch`, složka `ios/App/PumploWatch Watch App/`):**
- `WatchWorkoutSnapshot.swift` — **Create.** Model + dekodér slovníku + odvozené popisky + `WatchFormat` (formátování váhy a času). Foundation-only → testovatelné.
- `WatchConnector.swift` — **Create.** `ObservableObject` nad `WCSession`: příjem stavu (seq guard), odesílání akcí.
- `Theme.swift` — **Create.** Brand barvy.
- `SpinnerField.swift` — **Create.** Jedno číselné pole (KG / OPAK.) s cyan rámečkem v aktivním stavu.
- `ActiveSetView.swift` — **Create.** Obrazovka aktivní série (korunka, ‹ ✓ ›).
- `RestView.swift` — **Create.** Kruhový odpočet + haptika + „+15 s" / „Přeskočit".
- `EdgeViews.swift` — **Create.** `WaitingView` (čekání na telefon) + `DoneView` (souhrn).
- `RootView.swift` — **Create.** Přepínač podle `phase`.
- `PumploWatchApp.swift` — **Modify** (generuje Xcode) — jen výměna `ContentView()` za `RootView()`.

**Nativní testy (nejsou součástí žádného targetu, běží přes `swiftc` na macOS):**
- `ios/App/NativeTests/main.swift` — **Create.** Assertion harness pro `WatchPayload` a `WatchWorkoutSnapshot`.

---

### Task 1: Web — jednotné hodiny pauzy a přesný snapshot

Dnešní snapshot počítá `restEndsAt` jako `Date.now() + getRestSecondsForCategory(...)` při KAŽDÉM běhu efektu (`WorkoutSession.tsx:809`), takže odpočet na hodinkách při každém rerenderu skočí zpátky na plnou hodnotu. Zdrojem času musí být centrální stav `restEndsAt` (deklarovaný na `WorkoutSession.tsx:128`). Pauza uvnitř `ExercisePlayer` (video režim) má vlastní hodiny — ty do rodiče zatím netečou vůbec, proto je player začne hlásit.

**Files:**
- Modify: `src/lib/watchWorkout.ts`
- Test: `src/lib/watchWorkout.test.ts`
- Modify: `src/components/workout/WorkoutSession.tsx` (řádky ~103–128, ~793–812, ~1165–1201, ~1238–1420)
- Modify: `src/components/workout/ExercisePlayer.tsx` (řádky ~66–72, ~136, ~300–324, ~354–368)

**Interfaces:**
- Consumes: `buildWatchWorkoutState`, `updateWatchState` (plán A).
- Produces:
  ```ts
  export interface RestClockInput {
    sessionResting: boolean;
    sessionRestEndsAt: number;  // 0 = nenastaveno
    playerResting: boolean;
    playerRestEndsAt: number;   // 0 = nenastaveno
  }
  export function resolveWatchRestEndsAt(i: RestClockInput): number | null;
  ```
  A nová signatura propu `onRestActiveChange?: (active: boolean, endsAt?: number) => void` na `ExercisePlayer` i na wrapperu `ExercisePlayerWithVideo`.

- [ ] **Step 1: Napsat padající test**

Přidej na konec `src/lib/watchWorkout.test.ts`:
```ts
import { resolveWatchRestEndsAt } from './watchWorkout';

describe('resolveWatchRestEndsAt', () => {
  const idle = { sessionResting: false, sessionRestEndsAt: 0, playerResting: false, playerRestEndsAt: 0 };

  it('returns null when nothing is resting', () => {
    expect(resolveWatchRestEndsAt(idle)).toBeNull();
  });

  it('uses the session clock in list view', () => {
    expect(resolveWatchRestEndsAt({ ...idle, sessionResting: true, sessionRestEndsAt: 1_700_000_000_000 }))
      .toBe(1_700_000_000_000);
  });

  it('uses the player clock during a video-view rest', () => {
    expect(resolveWatchRestEndsAt({ ...idle, playerResting: true, playerRestEndsAt: 1_700_000_030_000 }))
      .toBe(1_700_000_030_000);
  });

  it('prefers the session clock when both are set', () => {
    expect(resolveWatchRestEndsAt({
      sessionResting: true, sessionRestEndsAt: 111, playerResting: true, playerRestEndsAt: 222,
    })).toBe(111);
  });

  it('treats a zero clock as no rest (never sends epoch 0 to the watch)', () => {
    expect(resolveWatchRestEndsAt({ ...idle, sessionResting: true, sessionRestEndsAt: 0 })).toBeNull();
  });

  it('is stable across calls — the watch countdown must not restart on rerender', () => {
    const input = { ...idle, sessionResting: true, sessionRestEndsAt: 1_700_000_000_000 };
    expect(resolveWatchRestEndsAt(input)).toBe(resolveWatchRestEndsAt(input));
  });
});
```

- [ ] **Step 2: Spustit test — musí selhat**

Run: `cd ~/pumplo && npm test`
Expected: FAIL — `resolveWatchRestEndsAt is not a function` / import error.

- [ ] **Step 3: Minimální implementace**

Přidej na konec `src/lib/watchWorkout.ts`:
```ts
// Jedny hodiny pauzy pro snapshot na hodinky. Countdown na hodinkách běží z
// restEndsAt lokálně — kdyby web posílal pokaždé nově dopočítaný čas, odpočet
// by při každém rerenderu skočil zpět na plnou hodnotu.
export interface RestClockInput {
  sessionResting: boolean;
  sessionRestEndsAt: number;
  playerResting: boolean;
  playerRestEndsAt: number;
}

export function resolveWatchRestEndsAt(i: RestClockInput): number | null {
  if (i.sessionResting && i.sessionRestEndsAt > 0) return i.sessionRestEndsAt;
  if (i.playerResting && i.playerRestEndsAt > 0) return i.playerRestEndsAt;
  return null;
}
```

- [ ] **Step 4: Spustit test — musí projít**

Run: `cd ~/pumplo && npm test`
Expected: PASS (původní 3 testy plánu A + 6 nových).

- [ ] **Step 5: ExercisePlayer hlásí a sdílí své hodiny pauzy**

V `src/components/workout/ExercisePlayer.tsx`:

(a) v `interface ExercisePlayerProps` nahraď řádek `onRestActiveChange?: (active: boolean) => void;` za:
```ts
  // Fired when the internal between-set rest starts/stops so the parent can
  // avoid overwriting the rest countdown on the lock-screen Live Activity.
  // endsAt (epoch ms) is passed on start and on every ±15 s adjust, so the
  // parent (and through it the watch) shares ONE rest clock with this player.
  onRestActiveChange?: (active: boolean, endsAt?: number) => void;
```

(b) k ostatním `useState` (poblíž `const [showRestTimer, setShowRestTimer] = useState(false);`) přidej:
```ts
  // Shared clock for the between-set rest (epoch ms). The ref mirror lets
  // adjustRest compute the next value without a stale closure.
  const [restEndsAt, setRestEndsAt] = useState(0);
  const restEndsAtRef = useRef(0);
```

(c) v `handleCompleteSet` nahraď dvojici řádků `onRestActiveChange?.(true);` + `setShowRestTimer(true);` za:
```ts
      const restEnds = Date.now() + restBetweenSets * 1000;
      restEndsAtRef.current = restEnds;
      setRestEndsAt(restEnds);
      onRestActiveChange?.(true, restEnds);
      setShowRestTimer(true);
```

(d) nad `handleRestComplete` přidej:
```ts
  // ±15 s musí posunout JEDNY hodiny: lokální stav, RestTimer i rodiče
  // (a přes něj hodinky), jinak by každá plocha odpočítávala něco jiného.
  const adjustRest = useCallback((delta: number) => {
    const next = Math.max(Date.now(), restEndsAtRef.current + delta * 1000);
    restEndsAtRef.current = next;
    setRestEndsAt(next);
    onRestActiveChange?.(true, next);
  }, [onRestActiveChange]);
```

(e) v `handleRestComplete` na první řádek za `setShowRestTimer(false);` přidej:
```ts
    restEndsAtRef.current = 0;
    setRestEndsAt(0);
```

(f) v renderu pauzy (`if (showRestTimer) { return (<RestTimer ... />) }`) doplň dva propy hned za `duration={restBetweenSets}`:
```tsx
        endsAt={restEndsAt || undefined}
        onAdjust={adjustRest}
```

- [ ] **Step 6: WorkoutSession drží hodiny player pauzy**

V `src/components/workout/WorkoutSession.tsx`:

(a) hned pod `const playerRestingRef = useRef(false);` přidej:
```ts
  // Konec pauzy, kterou si řídí ExercisePlayer (video režim). WorkoutSession
  // ji sám nespouští, ale hodinky potřebují stejný čas jako telefon.
  const [playerRestEndsAt, setPlayerRestEndsAt] = useState(0);
```

(b) nahraď `handlePlayerRestActiveChange` za:
```ts
  const handlePlayerRestActiveChange = useCallback((active: boolean, endsAt?: number) => {
    playerRestingRef.current = active;
    setPlayerResting(active);
    // Rest start i ±15 s posílají endsAt; průběžné „pořád běží" volání ho
    // nemá a nesmí přepsat už známé hodiny.
    if (active) { if (endsAt) setPlayerRestEndsAt(endsAt); }
    else setPlayerRestEndsAt(0);
  }, []);
```

(c) v typu propů wrapperu `ExercisePlayerWithVideo` (kolem řádku 1288) nahraď `onRestActiveChange?: (active: boolean) => void;` za:
```ts
  onRestActiveChange?: (active: boolean, endsAt?: number) => void;
```
(Vlastní předání propu do `<ExercisePlayer ... onRestActiveChange={onRestActiveChange} />` už existuje a nemění se.)

- [ ] **Step 7: Snapshot bere jedny hodiny, doplní `nextSetLabel` a idle při cooldownu**

Ve `WorkoutSession.tsx` SMAŽ celý stávající efekt „Push a snapshot of the current workout state to the paired watch app." (řádky ~793–812) a vlož ho znovu HNED ZA definici `upcomingSetPayload` (končí na řádku ~933), tzn. před efekt „List-mode rest engine". Důvod: `nextSetLabel` se bere z `upcomingSetPayload()`, a efekt musí stát nad všemi early returny (`if (showCooldown)`, `if (showSummary)`), aby se pořadí hooků neměnilo.

```ts
  // Snapshot aktuálního tréninku pro spárované hodinky. Hodiny pauzy jsou
  // JEDNY (viz resolveWatchRestEndsAt) — hodinky si z restEndsAt odpočítávají
  // lokálně, takže přepočet při každém renderu by countdown resetoval.
  useEffect(() => {
    const ex = liveExercises[currentExerciseIndex];
    if (!ex) return;
    if (showSummary) {
      updateWatchState(buildWatchWorkoutState({
        phase: 'summary', exerciseName: '', slotCategory: null, setIndex: 0, totalSets: 0,
        targetWeight: null, repMin: 0, repMax: 0, rir: null, prevWeight: null, prevReps: null,
        resting: false, restEndsAt: null, nextSetLabel: null,
      }));
      return;
    }
    if (showCooldown) {
      updateWatchState(buildWatchWorkoutState({
        phase: 'idle', exerciseName: '', slotCategory: null, setIndex: 0, totalSets: 0,
        targetWeight: null, repMin: 0, repMax: 0, rir: null, prevWeight: null, prevReps: null,
        resting: false, restEndsAt: null, nextSetLabel: null,
      }));
      return;
    }
    const restEnds = resolveWatchRestEndsAt({
      sessionResting: showRestTimer,
      sessionRestEndsAt: restEndsAt,
      playerResting,
      playerRestEndsAt,
    });
    // Bez známého konce pauzy nemá smysl posílat fázi rest — hodinky by
    // ukazovaly odpočet bez času. Radši zůstane obrazovka série.
    const resting = restEnds !== null;
    updateWatchState(buildWatchWorkoutState({
      phase: resting ? 'rest' : 'set',
      exerciseName: (isEn && ex.exerciseNameEn) ? ex.exerciseNameEn! : (ex.exerciseName || ''),
      slotCategory: ex.slotCategory ?? null,
      setIndex: currentSetIndex, totalSets: ex.sets,
      targetWeight: currentExWeight, repMin: ex.repMin, repMax: ex.repMax,
      rir: ex.rirMax ?? ex.rirMin ?? null,
      prevWeight: currentExWeight, prevReps: ex.repMax,
      resting, restEndsAt: restEnds,
      nextSetLabel: resting ? (upcomingSetPayload()?.setText ?? null) : null,
    }));
  }, [currentExerciseIndex, currentSetIndex, showRestTimer, playerResting, showSummary, showCooldown,
      restEndsAt, playerRestEndsAt, currentExWeight, liveExercises, isEn, goalId, restAdvance,
      setsDataByExercise, resultsByIndex, t]); // eslint-disable-line react-hooks/exhaustive-deps
```

Do importu z `@/lib/watchWorkout` (řádek 29) přidej `resolveWatchRestEndsAt`:
```ts
import { buildWatchWorkoutState, updateWatchState, endWatchState, addWatchActionListener, resolveWatchRestEndsAt, type WatchAction } from '@/lib/watchWorkout';
```

- [ ] **Step 8: Type-check + build + testy**

Run: `cd ~/pumplo && npx tsc --noEmit 2>&1 | head -20` → 0 chyb.
Run: `npm test` → PASS.
Run: `npm run build 2>&1 | tail -3` → build OK.

- [ ] **Step 9: Commit**

```bash
git add src/lib/watchWorkout.ts src/lib/watchWorkout.test.ts src/components/workout/WorkoutSession.tsx src/components/workout/ExercisePlayer.tsx
git commit -m "fix(watch): single rest clock for the watch snapshot + nextSetLabel"
```

---

### Task 2: Web — parita `logSet` z hodinek s lock-screen ✓

Handler hodinek dnes na rozdíl od lock-screen ✓ nenaviguje na cvik, ke kterému logovaná série patří, a neumí doplnit váhu z aplikace, když ji hodinky nepošlou (`WorkoutSession.tsx:893–905` vs `815–833`). Sjednotíme to do jedné funkce, kterou volají obě cesty.

**Files:**
- Modify: `src/lib/watchWorkout.ts`
- Test: `src/lib/watchWorkout.test.ts`
- Modify: `src/components/workout/WorkoutSession.tsx` (řádky ~814–833 a ~892–905)

**Interfaces:**
- Consumes: `handleCompactCompleteSet(exerciseIndex, setIndex, weight?, reps?)`, `findPendingSet(preferIdx)`, `goToExerciseRef`, `currentExerciseIndexRef`, `restShowingRef`, `playerRestingRef` — vše existuje.
- Produces:
  ```ts
  export interface LoggedWeightInput {
    actionWeight: number | null;   // co poslaly hodinky
    sameExercise: boolean;         // logujeme sérii cviku, který je zobrazený?
    currentExWeight: number | null; // předvyplněná váha v appce
  }
  export function resolveLoggedWeight(i: LoggedWeightInput): number | undefined;
  ```
  A uvnitř komponenty `completePendingSetRef.current(weight?: number, reps?: number): void` — jediná cesta „zaloguj další čekající sérii", kterou používá lock-screen ✓ i hodinky.

- [ ] **Step 1: Napsat padající test**

Přidej do `src/lib/watchWorkout.test.ts`:
```ts
import { resolveLoggedWeight } from './watchWorkout';

describe('resolveLoggedWeight', () => {
  it('uses the weight the watch sent', () => {
    expect(resolveLoggedWeight({ actionWeight: 42.5, sameExercise: true, currentExWeight: 40 })).toBe(42.5);
  });

  it('keeps an explicit zero (bodyweight) instead of falling back', () => {
    expect(resolveLoggedWeight({ actionWeight: 0, sameExercise: true, currentExWeight: 40 })).toBe(0);
  });

  it('falls back to the prefilled weight on the viewed exercise', () => {
    expect(resolveLoggedWeight({ actionWeight: null, sameExercise: true, currentExWeight: 40 })).toBe(40);
  });

  it('never guesses a weight for a different exercise', () => {
    expect(resolveLoggedWeight({ actionWeight: null, sameExercise: false, currentExWeight: 40 })).toBeUndefined();
  });

  it('returns undefined when nothing is known', () => {
    expect(resolveLoggedWeight({ actionWeight: null, sameExercise: true, currentExWeight: null })).toBeUndefined();
  });
});
```

- [ ] **Step 2: Spustit test — musí selhat**

Run: `cd ~/pumplo && npm test`
Expected: FAIL — `resolveLoggedWeight is not a function`.

- [ ] **Step 3: Minimální implementace**

Přidej do `src/lib/watchWorkout.ts`:
```ts
// Váha zapsaná sérií: co poslaly hodinky > předvyplněná váha zobrazeného
// cviku > nic (u cizího cviku nikdy nehádáme).
export interface LoggedWeightInput {
  actionWeight: number | null;
  sameExercise: boolean;
  currentExWeight: number | null;
}

export function resolveLoggedWeight(i: LoggedWeightInput): number | undefined {
  if (i.actionWeight != null) return i.actionWeight;
  if (i.sameExercise && i.currentExWeight != null) return i.currentExWeight;
  return undefined;
}
```

- [ ] **Step 4: Spustit test — musí projít**

Run: `cd ~/pumplo && npm test`
Expected: PASS.

- [ ] **Step 5: Jedna sdílená cesta pro ✓**

Ve `WorkoutSession.tsx` nahraď celý blok `lockCompleteRef` (řádky ~815–833) tímto:
```ts
  // Zaloguj další ČEKAJÍCÍ sérii. Jediná cesta pro lock-screen ✓ i pro ✓ na
  // hodinkách — obě musí stejně navigovat na cvik, kterému série patří, a
  // stejně doplnit váhu, jinak se list a video mirror rozejdou.
  const completePendingSetRef = useRef<(weight?: number, reps?: number) => void>(() => {});
  completePendingSetRef.current = (weight?: number, reps?: number) => {
    if (restShowingRef.current || playerRestingRef.current || showSummary || showCooldown) return;
    const target = findPendingSet(currentExerciseIndexRef.current);
    if (!target) return;
    const ex = liveExercises[target.exIdx];
    if (!ex) return;
    const sameExercise = target.exIdx === currentExerciseIndexRef.current;
    if (!sameExercise) {
      // ✓ na sérii jiného cviku = uživatel se posunul dál; následuj ho.
      goToExerciseRef.current(target.exIdx);
      setHighestIndexReached(p => Math.max(p, target.exIdx));
    }
    // handleCompactCompleteSet přeseje i mirror video playeru.
    handleCompactCompleteSet(
      target.exIdx,
      target.si,
      resolveLoggedWeight({ actionWeight: weight ?? null, sameExercise, currentExWeight }),
      reps ?? ex.repMax,
    );
  };
  const lockCompleteRef = useRef<() => void>(() => {});
  lockCompleteRef.current = () => completePendingSetRef.current();
```

- [ ] **Step 6: Hodinky volají tutéž cestu**

Ve `WorkoutSession.tsx` v `watchActionRef.current` nahraď větev `if (a.type === 'logSet') { ... }` za:
```ts
    if (a.type === 'logSet') {
      completePendingSetRef.current(a.weight ?? undefined, a.reps);
    } else if (a.type === 'skipRest') {
```
(zbytek větve `skipRest` zůstává beze změny).

Do importu z `@/lib/watchWorkout` doplň `resolveLoggedWeight`:
```ts
import { buildWatchWorkoutState, updateWatchState, endWatchState, addWatchActionListener, resolveWatchRestEndsAt, resolveLoggedWeight, type WatchAction } from '@/lib/watchWorkout';
```

- [ ] **Step 7: Type-check + testy + build**

Run: `cd ~/pumplo && npx tsc --noEmit 2>&1 | head -20` → 0 chyb.
Run: `npm test` → PASS.
Run: `npm run build 2>&1 | tail -3` → OK.

- [ ] **Step 8: Commit**

```bash
git add src/lib/watchWorkout.ts src/lib/watchWorkout.test.ts src/components/workout/WorkoutSession.tsx
git commit -m "fix(watch): watch logSet follows the same path as the lock-screen check"
```

---

### Task 3: Web — zbylé akce `goPrevSet` / `goNextSet` / `addRest15`

Plán A je vědomě odložil. Mockup je má na hodinkách jako ‹ › a „+15 s", takže bez nich nemá watch UI co volat.

**Files:**
- Modify: `src/lib/watchWorkout.ts`
- Test: `src/lib/watchWorkout.test.ts`
- Modify: `src/components/workout/WorkoutSession.tsx` (~555–560, ~885–909, ~982–984, ~1165–1201, ~1238–1420)
- Modify: `src/components/workout/ExercisePlayer.tsx` (~66–72, ~341–344)

**Interfaces:**
- Consumes: `resolveLoggedWeight` (task 2), `goToExerciseRef`, `setCurrentSetIndex`, `setPlayerSync`, `adjustListRest`.
- Produces:
  ```ts
  export interface SetStepInput {
    exerciseIndex: number;
    setIndex: number;
    totalSets: number;
    exerciseCount: number;
  }
  export interface SetStepResult { exerciseIndex: number; setIndex: number; }
  export function resolveSetStep(i: SetStepInput, direction: 'prev' | 'next'): SetStepResult | null;
  ```
  A nový prop `adjustRestRef?: React.MutableRefObject<((delta: number) => void) | null>` na `ExercisePlayer` i wrapperu.

- [ ] **Step 1: Napsat padající test**

Přidej do `src/lib/watchWorkout.test.ts`:
```ts
import { resolveSetStep } from './watchWorkout';

describe('resolveSetStep', () => {
  const mid = { exerciseIndex: 1, setIndex: 1, totalSets: 3, exerciseCount: 4 };

  it('moves to the next set inside the exercise', () => {
    expect(resolveSetStep(mid, 'next')).toEqual({ exerciseIndex: 1, setIndex: 2 });
  });

  it('moves to the previous set inside the exercise', () => {
    expect(resolveSetStep(mid, 'prev')).toEqual({ exerciseIndex: 1, setIndex: 0 });
  });

  it('rolls over to the next exercise after the last set', () => {
    expect(resolveSetStep({ ...mid, setIndex: 2 }, 'next')).toEqual({ exerciseIndex: 2, setIndex: 0 });
  });

  it('rolls back to the previous exercise before the first set', () => {
    expect(resolveSetStep({ ...mid, setIndex: 0 }, 'prev')).toEqual({ exerciseIndex: 0, setIndex: 0 });
  });

  it('stops at the end of the workout', () => {
    expect(resolveSetStep({ exerciseIndex: 3, setIndex: 2, totalSets: 3, exerciseCount: 4 }, 'next')).toBeNull();
  });

  it('stops at the very beginning', () => {
    expect(resolveSetStep({ exerciseIndex: 0, setIndex: 0, totalSets: 3, exerciseCount: 4 }, 'prev')).toBeNull();
  });
});
```

- [ ] **Step 2: Spustit test — musí selhat**

Run: `cd ~/pumplo && npm test`
Expected: FAIL — `resolveSetStep is not a function`.

- [ ] **Step 3: Minimální implementace**

Přidej do `src/lib/watchWorkout.ts`:
```ts
// Krok ‹ / › z hodinek: nejdřív po sériích uvnitř cviku, na kraji přeskoč na
// sousední cvik. Vrací null, když už není kam jít.
export interface SetStepInput {
  exerciseIndex: number;
  setIndex: number;
  totalSets: number;
  exerciseCount: number;
}
export interface SetStepResult { exerciseIndex: number; setIndex: number; }

export function resolveSetStep(i: SetStepInput, direction: 'prev' | 'next'): SetStepResult | null {
  if (direction === 'next') {
    if (i.setIndex + 1 < i.totalSets) return { exerciseIndex: i.exerciseIndex, setIndex: i.setIndex + 1 };
    if (i.exerciseIndex + 1 < i.exerciseCount) return { exerciseIndex: i.exerciseIndex + 1, setIndex: 0 };
    return null;
  }
  if (i.setIndex > 0) return { exerciseIndex: i.exerciseIndex, setIndex: i.setIndex - 1 };
  if (i.exerciseIndex > 0) return { exerciseIndex: i.exerciseIndex - 1, setIndex: 0 };
  return null;
}
```

- [ ] **Step 4: Spustit test — musí projít**

Run: `cd ~/pumplo && npm test`
Expected: PASS.

- [ ] **Step 5: ExercisePlayer vystaví „přidej 15 s"**

V `src/components/workout/ExercisePlayer.tsx`:

(a) do `interface ExercisePlayerProps` za `skipRestRef` přidej:
```ts
  // Stejný princip jako skipRestRef: „+15 s" z hodinek přijde do rodiče, ale
  // video-view pauzu vlastní tenhle player. Null, když žádná pauza neběží.
  adjustRestRef?: React.MutableRefObject<((delta: number) => void) | null>;
```

(b) do destrukturovaných propů komponenty přidej `adjustRestRef` (hned za `skipRestRef`).

(c) pod řádek `if (skipRestRef) skipRestRef.current = showRestTimer ? handleRestComplete : null;` přidej:
```ts
  if (adjustRestRef) adjustRestRef.current = showRestTimer ? adjustRest : null;
  useEffect(() => () => { if (adjustRestRef) adjustRestRef.current = null; }, [adjustRestRef]);
```

- [ ] **Step 6: WorkoutSession — mirror indexu série, přesun `adjustListRest`, obsluha akcí**

Ve `WorkoutSession.tsx`:

(a) pod `const currentExerciseIndexRef = useRef(currentExerciseIndex); currentExerciseIndexRef.current = currentExerciseIndex;` (~555) přidej:
```ts
  const currentSetIndexRef = useRef(currentSetIndex);
  currentSetIndexRef.current = currentSetIndex;
```

(b) pod `const playerSkipRestRef = useRef<(() => void) | null>(null);` (~119) přidej:
```ts
  // ExercisePlayer sem zaregistruje úpravu své pauzy (+15 s z hodinek).
  const playerAdjustRestRef = useRef<((delta: number) => void) | null>(null);
```

(c) SMAŽ `const adjustListRest = (delta: number) => { ... };` z místa kolem řádku 982 a vlož ho BEZ ZMĚNY nad blok `watchActionRef` (tj. před komentář „Watch (companion app) actions…"), aby na něj obsluha akcí odkazovala až po deklaraci:
```ts
  const adjustListRest = (delta: number) => {
    setRestEndsAt(prev => Math.max(Date.now(), prev + delta * 1000));
  };
```

(d) nad `watchActionRef` přidej krokování sérií:
```ts
  // ‹ / › z hodinek: posun po sériích v rámci cviku, na kraji na sousední cvik.
  const stepSetRef = useRef<(direction: 'prev' | 'next') => void>(() => {});
  stepSetRef.current = (direction) => {
    const exIdx = currentExerciseIndexRef.current;
    const ex = liveExercises[exIdx];
    if (!ex) return;
    const step = resolveSetStep({
      exerciseIndex: exIdx,
      setIndex: currentSetIndexRef.current,
      totalSets: ex.sets,
      exerciseCount: liveExercises.length,
    }, direction);
    if (!step) return;
    if (step.exerciseIndex !== exIdx) {
      // goToExerciseRef si index série naseeduje sám z odlogovaných sérií.
      goToExerciseRef.current(step.exerciseIndex);
      setHighestIndexReached(p => Math.max(p, step.exerciseIndex));
      return;
    }
    setCurrentSetIndex(step.setIndex);
    currentSetIndexRef.current = step.setIndex;
    setPlayerSync(n => n + 1);
  };
```

(e) v `watchActionRef.current` nahraď koncový komentář „goPrevSet / goNextSet / addRest15 — dodá plán B…" plnou obsluhou, takže celé tělo vypadá takto:
```ts
  watchActionRef.current = (a: WatchAction) => {
    if (a.type === 'logSet') {
      completePendingSetRef.current(a.weight ?? undefined, a.reps);
    } else if (a.type === 'skipRest') {
      if (playerRestingRef.current) { playerSkipRestRef.current?.(); playerRestingRef.current = false; return; }
      if (restShowingRef.current) { stopRestBeeps(); cancelRestEndNotification(); handleRestComplete(); restShowingRef.current = false; }
    } else if (a.type === 'addRest15') {
      if (playerRestingRef.current) { playerAdjustRestRef.current?.(15); return; }
      if (restShowingRef.current) adjustListRest(15);
    } else if (a.type === 'goPrevSet') {
      stepSetRef.current('prev');
    } else if (a.type === 'goNextSet') {
      stepSetRef.current('next');
    }
  };
```

(f) v renderu `<ExercisePlayerWithVideo ... />` přidej za `skipRestRef={playerSkipRestRef}`:
```tsx
        adjustRestRef={playerAdjustRestRef}
```

(g) ve wrapperu `ExercisePlayerWithVideo` přidej `adjustRestRef` do destrukturovaných propů (za `skipRestRef`), do typu propů:
```ts
  adjustRestRef?: React.MutableRefObject<((delta: number) => void) | null>;
```
a do předání dolů `<ExercisePlayer ... skipRestRef={skipRestRef} adjustRestRef={adjustRestRef} />`.

(h) do importu z `@/lib/watchWorkout` doplň `resolveSetStep`:
```ts
import { buildWatchWorkoutState, updateWatchState, endWatchState, addWatchActionListener, resolveWatchRestEndsAt, resolveLoggedWeight, resolveSetStep, type WatchAction } from '@/lib/watchWorkout';
```

- [ ] **Step 7: Type-check + testy + build**

Run: `cd ~/pumplo && npx tsc --noEmit 2>&1 | head -20` → 0 chyb.
Run: `npm test` → PASS (všech 20 testů).
Run: `npm run build 2>&1 | tail -3` → OK.

- [ ] **Step 8: Ověření regrese v prohlížeči**

Run: `npm run dev`, otevři trénink v prohlížeči, projdi: dokončení série → pauza → +15 s → skip → další cvik. Na webu jsou watch cesty no-op, takže se nesmí změnit nic; v konzoli žádná nová chyba.

- [ ] **Step 9: Commit**

```bash
git add src/lib/watchWorkout.ts src/lib/watchWorkout.test.ts src/components/workout/WorkoutSession.tsx src/components/workout/ExercisePlayer.tsx
git commit -m "feat(watch): handle goPrevSet/goNextSet/addRest15 from the watch"
```

---

### Task 4: iOS — čisté helpery `WatchPayload` + nativní test harness

WCSession přenáší jen property-list typy. Z JS přicházejí `null`y jako `NSNull`, které by `updateApplicationContext` shodily výjimkou. Tahle logika je čistá, takže ji odladíme `swiftc`em ještě dřív, než se pustíme do WatchConnectivity.

**Files:**
- Create: `ios/App/App/WatchPayload.swift`
- Test: `ios/App/NativeTests/main.swift`

**Interfaces:**
- Produces:
  ```swift
  enum WatchPayload {
    static func sanitize(_ raw: [String: Any]) -> [String: Any]
    static func isUrgent(previous: [String: Any]?, next: [String: Any]) -> Bool
    static func action(from message: [String: Any]) -> [String: Any]?
  }
  ```

- [ ] **Step 1: Napsat padající test**

Create `ios/App/NativeTests/main.swift`:
```swift
import Foundation

// Assertion harness pro čistou Swift logiku, která se dá přeložit i na macOS.
// Spouští se swiftc (viz níže), ne XCTestem — watchOS/iOS test target by kvůli
// pár čistým funkcím znamenal další target v projektu.
var failures = 0
func expect(_ condition: Bool, _ name: String) {
    if condition { print("ok   \(name)") } else { print("FAIL \(name)"); failures += 1 }
}

// MARK: - WatchPayload.sanitize

let sanitized = WatchPayload.sanitize([
    "phase": "set",
    "setIndex": 1,
    "targetWeight": NSNull(),
    "resting": false,
    "weightStep": 0.5,
])
expect(sanitized["targetWeight"] == nil, "sanitize drops NSNull")
expect(sanitized["phase"] as? String == "set", "sanitize keeps strings")
expect((sanitized["setIndex"] as? NSNumber)?.intValue == 1, "sanitize keeps numbers")
expect((sanitized["resting"] as? NSNumber)?.boolValue == false, "sanitize keeps false")
expect((sanitized["weightStep"] as? NSNumber)?.doubleValue == 0.5, "sanitize keeps doubles")
expect(JSONSerialization.isValidJSONObject(sanitized), "sanitize output is plist/JSON safe")

// MARK: - WatchPayload.isUrgent

expect(WatchPayload.isUrgent(previous: nil, next: ["phase": "set"]),
       "isUrgent true for the very first snapshot")
expect(WatchPayload.isUrgent(previous: ["phase": "set"], next: ["phase": "rest", "restEndsAt": 1.0]),
       "isUrgent true when the phase changes")
expect(WatchPayload.isUrgent(previous: ["phase": "rest", "restEndsAt": 1.0],
                             next: ["phase": "rest", "restEndsAt": 16.0]),
       "isUrgent true when the rest clock moves (+15 s)")
expect(!WatchPayload.isUrgent(previous: ["phase": "set", "setIndex": 1],
                              next: ["phase": "set", "setIndex": 2]),
       "isUrgent false for an ordinary set update")

// MARK: - WatchPayload.action

let logSet = WatchPayload.action(from: ["type": "logSet", "weight": 42.5, "reps": 10])
expect(logSet?["type"] as? String == "logSet", "action keeps the logSet type")
expect((logSet?["weight"] as? Double) == 42.5, "action keeps the weight")
expect((logSet?["reps"] as? Int) == 10, "action keeps the reps")

let bodyweight = WatchPayload.action(from: ["type": "logSet", "reps": 12])
expect(bodyweight?["weight"] == nil, "action omits a missing weight (JS reads it as undefined)")
expect((bodyweight?["reps"] as? Int) == 12, "action keeps reps without a weight")

expect(WatchPayload.action(from: ["type": "skipRest"])?["type"] as? String == "skipRest",
       "action passes simple actions through")
expect(WatchPayload.action(from: ["type": "addRest15"])?["type"] as? String == "addRest15",
       "action passes addRest15 through")
expect(WatchPayload.action(from: ["type": "selfDestruct"]) == nil, "action rejects unknown types")
expect(WatchPayload.action(from: ["reps": 5]) == nil, "action rejects a message without a type")

if failures > 0 { print("\(failures) failing"); exit(1) }
print("all native tests passed")
```

- [ ] **Step 2: Spustit harness — musí selhat**

Run:
```bash
cd ~/pumplo && swiftc -o /tmp/pumplo-native-tests ios/App/App/WatchPayload.swift ios/App/NativeTests/main.swift && /tmp/pumplo-native-tests
```
Expected: FAIL — `error: no such file or directory: 'ios/App/App/WatchPayload.swift'`.

- [ ] **Step 3: Minimální implementace**

Create `ios/App/App/WatchPayload.swift`:
```swift
import Foundation

// Čisté helpery pro přenos telefon <-> hodinky. Schválně bez importu
// Capacitoru a WatchConnectivity, aby se soubor dal přeložit i na macOS a
// otestovat harnessem v ios/App/NativeTests.
enum WatchPayload {
    // WCSession bere jen property-list typy. JSON null z JS doletí jako NSNull
    // a updateApplicationContext by na něm vyhodil výjimku — chybějící klíč
    // znamená na hodinkách přesně totéž co null.
    static func sanitize(_ raw: [String: Any]) -> [String: Any] {
        var out: [String: Any] = [:]
        for (key, value) in raw {
            if value is NSNull { continue }
            if let number = value as? NSNumber { out[key] = number; continue }
            if let text = value as? String { out[key] = text; continue }
            // Vnořené objekty ani pole nejsou součástí kontraktu — zahazujeme.
        }
        return out
    }

    // applicationContext doručuje systém líně. Start pauzy, změna fáze nebo
    // posun konce pauzy musí na hodinky dorazit hned, proto je plugin navíc
    // pošle jako přímou zprávu.
    static func isUrgent(previous: [String: Any]?, next: [String: Any]) -> Bool {
        guard let previous else { return true }
        if (previous["phase"] as? String) != (next["phase"] as? String) { return true }
        let previousEnd = (previous["restEndsAt"] as? NSNumber)?.doubleValue
        let nextEnd = (next["restEndsAt"] as? NSNumber)?.doubleValue
        return previousEnd != nextEnd
    }

    // Hodinky -> telefon. Propouští jen známé tvary, aby novější watch build
    // nemohl rozbít starší telefonní build.
    static func action(from message: [String: Any]) -> [String: Any]? {
        guard let type = message["type"] as? String else { return nil }
        switch type {
        case "logSet":
            var payload: [String: Any] = ["type": type]
            if let weight = (message["weight"] as? NSNumber)?.doubleValue { payload["weight"] = weight }
            payload["reps"] = (message["reps"] as? NSNumber)?.intValue ?? 0
            return payload
        case "goPrevSet", "goNextSet", "skipRest", "addRest15":
            return ["type": type]
        default:
            return nil
        }
    }
}
```

- [ ] **Step 4: Spustit harness — musí projít**

Run:
```bash
cd ~/pumplo && swiftc -o /tmp/pumplo-native-tests ios/App/App/WatchPayload.swift ios/App/NativeTests/main.swift && /tmp/pumplo-native-tests
```
Expected: samé `ok` řádky a `all native tests passed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add ios/App/App/WatchPayload.swift ios/App/NativeTests/main.swift
git commit -m "feat(watch): pure WatchConnectivity payload helpers + swiftc test harness"
```

---

### Task 5: iOS — plná `WCSession` implementace pluginu, registrace a zařazení do App targetu

**Files:**
- Modify: `ios/App/App/WatchWorkoutPlugin.swift` (přepsat celý)
- Modify: `ios/App/App/MainViewController.swift`
- Create: `ios/App/scripts/add_watch_plugin_files.rb`

**Interfaces:**
- Consumes: `WatchPayload.sanitize/isUrgent/action` (task 4); JS volání `WatchWorkout.updateState(state)`, `WatchWorkout.endState()`, `WatchWorkout.addListener('watchAction', cb)` z `src/lib/watchWorkout.ts`.
- Produces: JS event `watchAction` s payloadem `{ type, weight?, reps? }`; na hodinky odchází slovník snapshotu obohacený o `seq: Double`.

- [ ] **Step 1: Ověřit, že plugin v projektu opravdu chybí**

Run:
```bash
cd ~/pumplo && ruby -e 'require "xcodeproj"; p Xcodeproj::Project.open("ios/App/App.xcodeproj").targets.find { |t| t.name == "App" }.source_build_phase.files.map { |f| f.file_ref&.path }'
```
Expected: seznam 7 souborů BEZ `WatchWorkoutPlugin.swift` a `WatchPayload.swift`.
(Pokud `ruby` hlásí `cannot load such file -- xcodeproj`, doinstaluj: `gem install --user-install xcodeproj` — ověřeno, že na systémovém ruby 2.6 projde a nainstaluje 1.28.1.)

- [ ] **Step 2: Napsat skript, který soubory do targetu přidá**

Create `ios/App/scripts/add_watch_plugin_files.rb`:
```ruby
#!/usr/bin/env ruby
# App target používá klasické skupiny (synchronizovanou složku má jen
# PumploWidgets), takže .swift soubor v ios/App/App se sám nepřeloží — musí
# být zapsaný v project.pbxproj. Skript je idempotentní, dá se pustit vícekrát.
require 'xcodeproj'

FILES = %w[WatchWorkoutPlugin.swift WatchPayload.swift].freeze

project_path = File.expand_path('../App.xcodeproj', __dir__)
project = Xcodeproj::Project.open(project_path)

target = project.targets.find { |t| t.name == 'App' } or abort 'App target not found'
group = project.main_group.find_subpath('App', false) or abort 'App group not found'

FILES.each do |name|
  if target.source_build_phase.files.any? { |f| f.file_ref&.path == name }
    puts "skip  #{name} (already in target)"
    next
  end
  reference = group.files.find { |f| f.path == name } || group.new_reference(name)
  target.add_file_references([reference])
  puts "added #{name}"
end

project.save
puts 'saved App.xcodeproj'
```

- [ ] **Step 3: Spustit skript a ověřit výsledek**

Run:
```bash
cd ~/pumplo && ruby ios/App/scripts/add_watch_plugin_files.rb
```
Expected: `added WatchWorkoutPlugin.swift`, `added WatchPayload.swift`, `saved App.xcodeproj`.

Run (kontrola):
```bash
cd ~/pumplo && ruby -e 'require "xcodeproj"; p Xcodeproj::Project.open("ios/App/App.xcodeproj").targets.find { |t| t.name == "App" }.source_build_phase.files.map { |f| f.file_ref&.path }'
```
Expected: 9 souborů, mezi nimi `WatchWorkoutPlugin.swift` i `WatchPayload.swift`.

- [ ] **Step 4: Přepsat plugin plnou implementací**

Přepiš `ios/App/App/WatchWorkoutPlugin.swift` na:
```swift
import Foundation
import Capacitor
import WatchConnectivity

// Most na companion watch appku. Web posílá po každé změně tréninku nejnovější
// snapshot, hodinky posílají zpět akce. Všechno je best-effort: nespárované
// hodinky ani chybějící watch app nesmí v JS vyvolat chybu (stejný kontrakt
// jako RestActivityPlugin).
//
// updateApplicationContext drží jen POSLEDNÍ hodnotu (přesně to chceme —
// nejnovější snapshot přebije starší), sendMessage doručí urgentní přechod
// (start pauzy, ±15 s, konec tréninku) hned, když jsou hodinky dosažitelné.
@objc(WatchWorkoutPlugin)
public class WatchWorkoutPlugin: CAPPlugin, CAPBridgedPlugin {
    // Bez konformity k CAPBridgedPlugin by bridge registraci instance odmítl
    // ("must conform to CAPBridgedPlugin") a plugin by v JS neexistoval.
    public let identifier = "WatchWorkoutPlugin"
    public let jsName = "WatchWorkout"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endState", returnType: CAPPluginReturnPromise)
    ]

    // Pořadové číslo snapshotu. Startuje na wall-clocku, takže po restartu
    // aplikace nikdy neklesne pod hodnotu, kterou hodinky už viděly.
    private var seq: Double = Date().timeIntervalSince1970 * 1000
    private var lastSnapshot: [String: Any]?

    public override func load() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    @objc func updateState(_ call: CAPPluginCall) {
        let raw = (call.options as? [String: Any]) ?? [:]
        push(snapshot: WatchPayload.sanitize(raw))
        call.resolve()
    }

    @objc func endState(_ call: CAPPluginCall) {
        push(snapshot: ["phase": "idle", "resting": false])
        lastSnapshot = nil
        call.resolve()
    }

    private func push(snapshot: [String: Any]) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }

        seq += 1
        var payload = snapshot
        payload["seq"] = seq
        let urgent = WatchPayload.isUrgent(previous: lastSnapshot, next: payload)
        lastSnapshot = payload

        do {
            try session.updateApplicationContext(payload)
        } catch {
            // Nespárované hodinky / watch app není nainstalovaná → noop.
        }
        if urgent && session.isReachable {
            session.sendMessage(payload, replyHandler: nil, errorHandler: { _ in
                // Hodinky mezitím usnuly — applicationContext stejně dorazí.
            })
        }
    }
}

extension WatchWorkoutPlugin: WCSessionDelegate {
    public func session(_ session: WCSession,
                        activationDidCompleteWith activationState: WCSessionActivationState,
                        error: Error?) {}

    public func sessionDidBecomeInactive(_ session: WCSession) {}

    // Uživatel přepnul na jiné hodinky — session se musí aktivovat znovu.
    public func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    public func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let action = WatchPayload.action(from: message) else { return }
        DispatchQueue.main.async { [weak self] in
            self?.notifyListeners("watchAction", data: action)
        }
    }

    // Když je telefon nedosažitelný, hodinky akci zařadí do fronty
    // (transferUserInfo) — doručí se sem, jakmile spojení naskočí.
    public func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        guard let action = WatchPayload.action(from: userInfo) else { return }
        DispatchQueue.main.async { [weak self] in
            self?.notifyListeners("watchAction", data: action)
        }
    }
}
```

- [ ] **Step 5: Zaregistrovat plugin**

V `ios/App/App/MainViewController.swift` přidej do `capacitorDidLoad()` čtvrtý řádek:
```swift
        bridge?.registerPluginInstance(WatchWorkoutPlugin())
```
Celé tělo pak je:
```swift
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(RestAudioPlugin())
        bridge?.registerPluginInstance(RestActivityPlugin())
        bridge?.registerPluginInstance(InstagramSharePlugin())
        bridge?.registerPluginInstance(WatchWorkoutPlugin())
    }
```

- [ ] **Step 6: Přeložit App target**

Run:
```bash
cd ~/pumplo && xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build 2>&1 | tail -5
```
Expected: `** BUILD SUCCEEDED **`. (První běh stahuje/překládá SPM závislosti — počítej s ~5–10 minutami.)

- [ ] **Step 7: Ověřit, že se testy helperů pořád překládají**

Run:
```bash
cd ~/pumplo && swiftc -o /tmp/pumplo-native-tests ios/App/App/WatchPayload.swift ios/App/NativeTests/main.swift && /tmp/pumplo-native-tests
```
Expected: `all native tests passed`.

- [ ] **Step 8: Commit**

```bash
git add ios/App/App/WatchWorkoutPlugin.swift ios/App/App/MainViewController.swift ios/App/scripts/add_watch_plugin_files.rb ios/App/App.xcodeproj/project.pbxproj
git commit -m "feat(watch): WCSession implementation of the WatchWorkout plugin + registration"
```

---

### Task 6: watchOS — nový target `PumploWatch` (MANUAL CHECKPOINT) + kostra appky

**Rozhodnutí:** target zakládá David ručně průvodcem v Xcode, ne skriptem. Ruby gem `xcodeproj` sice umí vytvořit target, ale watchOS app potřebuje navíc správný `SDKROOT`, `WKCompanionAppBundleIdentifier`, build phase „Embed Watch Content" v App targetu, vlastní scheme a podpis — průvodce to udělá konzistentně, skript by to musel poskládat naslepo. Přidávání ZDROJŮ už skriptovat nemusíme: cíle vytvořené Xcodem 26 mají synchronizovanou složku (`PBXFileSystemSynchronizedRootGroup`, stejně jako `PumploWidgets`), takže `.swift` soubory zapsané do složky targetu se překládají automaticky.

**Files:**
- Create (Xcode): watchOS target `PumploWatch`, složka `ios/App/PumploWatch Watch App/`
- Create: `ios/App/PumploWatch Watch App/Theme.swift`
- Create: `ios/App/PumploWatch Watch App/EdgeViews.swift`
- Create: `ios/App/PumploWatch Watch App/RootView.swift`
- Modify: `ios/App/PumploWatch Watch App/PumploWatchApp.swift` (generuje Xcode)
- Delete: `ios/App/PumploWatch Watch App/ContentView.swift` (generuje Xcode)

**Interfaces:**
- Produces: `PumploTheme.navy`, `PumploTheme.cyan`, `PumploTheme.dim`; `WaitingView`, `DoneView`, `RootView` — používají je tasky 7–9.

- [ ] **Step 1: MANUAL CHECKPOINT (David) — založit target v Xcode**

1. `open ~/pumplo/ios/App/App.xcodeproj`
2. Menu **File ▸ New ▸ Target…**
3. Nahoře vyber záložku **watchOS**, dlaždici **App**, **Next**.
4. Vyplň:
   - **Product Name:** `PumploWatch`
   - **Team:** účet s ID `DF748BR59G`
   - **Bundle Identifier:** musí být `com.pumplo.app.watchkitapp` (pokud Xcode předvyplní něco jiného, přepiš)
   - **Interface:** SwiftUI, **Language:** Swift
   - **Include Notification Scene:** odškrtnout, **Include Tests:** odškrtnout
   - je-li v dialogu volba **Embed in Application / Companion App**, vyber `App`
5. **Finish**. Na dotaz „Activate scheme?" klikni **Activate**.
6. Vlevo vyber projekt → target **PumploWatch Watch App** → záložka **General** → **Minimum Deployments: watchOS 10.0**.
7. Záložka **Signing & Capabilities**: zaškrtnuté „Automatically manage signing", Team `DF748BR59G`.
8. Xcode zavři (další kroky sahají na soubory z terminálu).

- [ ] **Step 2: Ověřit, že target vznikl správně**

Run:
```bash
cd ~/pumplo && xcodebuild -list -project ios/App/App.xcodeproj 2>/dev/null | sed -n '/Targets/,/Build Configurations/p'
ls "ios/App/PumploWatch Watch App"
grep -c "PBXFileSystemSynchronizedRootGroup" ios/App/App.xcodeproj/project.pbxproj
grep -n "WKCompanionAppBundleIdentifier\|SDKROOT = watchos\|Embed Watch Content" ios/App/App.xcodeproj/project.pbxproj | head
```
Expected:
- v seznamu targetů přibyl `PumploWatch Watch App`,
- složka obsahuje `PumploWatchApp.swift`, `ContentView.swift`, `Assets.xcassets`,
- počet synchronizovaných skupin je ≥ 2 (widgety + watch),
- `WKCompanionAppBundleIdentifier` má hodnotu `com.pumplo.app`, `SDKROOT = watchos`, a v App targetu existuje fáze `Embed Watch Content`.

Kdyby `WKCompanionAppBundleIdentifier` chyběl nebo měl jinou hodnotu: v Xcode vyber watch target → **Build Settings** → hledej `Companion` → nastav na `com.pumplo.app`. Kdyby chyběla fáze **Embed Watch Content**: App target → **Build Phases** → **+ ▸ New Copy Files Phase**, Destination `Products Directory`, Subpath `$(CONTENTS_FOLDER_PATH)/Watch`, přidej `PumploWatch Watch App.app`.
Kdyby složka měla jiný název než `PumploWatch Watch App` (Xcode ho odvozuje z Product Name), použij ve všech dalších krocích ten skutečný — cesty se liší jen tímto jménem.

- [ ] **Step 3: Brand téma**

Create `ios/App/PumploWatch Watch App/Theme.swift`:
```swift
import SwiftUI

// Brand Pumplo: navy pozadí, cyan akcenty (stejné hodnoty jako web).
enum PumploTheme {
    static let navy = Color(red: 0x0B / 255, green: 0x12 / 255, blue: 0x22 / 255)
    static let cyan = Color(red: 0x4C / 255, green: 0xC9 / 255, blue: 0xFF / 255)
    static let dim = Color.white.opacity(0.6)
}
```

- [ ] **Step 4: Okrajové obrazovky**

Create `ios/App/PumploWatch Watch App/EdgeViews.swift`:
```swift
import SwiftUI

// Trénink neběží nebo ještě nepřišel první snapshot z telefonu.
struct WaitingView: View {
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "iphone.gen3")
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(PumploTheme.cyan)
            Text("Čekám na telefon")
                .font(.system(size: 14, weight: .black))
                .foregroundStyle(.white)
            Text("Spusť trénink v Pumplu")
                .font(.system(size: 11))
                .foregroundStyle(PumploTheme.dim)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 8)
    }
}

// Trénink dokončen (phase == summary).
struct DoneView: View {
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(PumploTheme.cyan)
            Text("Hotovo!")
                .font(.system(size: 18, weight: .black))
                .foregroundStyle(.white)
            Text("Trénink máš za sebou")
                .font(.system(size: 11))
                .foregroundStyle(PumploTheme.dim)
        }
    }
}
```

- [ ] **Step 5: Kořenová obrazovka**

Create `ios/App/PumploWatch Watch App/RootView.swift`:
```swift
import SwiftUI

// Navy pozadí přes celý displej + obsah. Ve fázi 7 sem přibude připojení na
// telefon, zatím appka jen čeká.
struct RootView: View {
    var body: some View {
        ZStack {
            PumploTheme.navy.ignoresSafeArea()
            WaitingView()
        }
    }
}
```

- [ ] **Step 6: Napojit `RootView` a smazat vygenerovaný `ContentView`**

V `ios/App/PumploWatch Watch App/PumploWatchApp.swift` nech název `@main` struktury tak, jak ho Xcode vygeneroval, a jen vyměň obsah scény za `RootView()`:
```swift
        WindowGroup {
            RootView()
        }
```
Pak smaž vygenerovaný soubor:
```bash
cd ~/pumplo && rm "ios/App/PumploWatch Watch App/ContentView.swift"
```

- [ ] **Step 7: Přeložit watch target**

Run:
```bash
cd ~/pumplo && xcodebuild -project ios/App/App.xcodeproj -scheme "PumploWatch Watch App" -sdk watchsimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build 2>&1 | tail -5
```
Expected: `** BUILD SUCCEEDED **`. (Pokud `xcodebuild -list` ukázal jiný název scheme, použij ten.)

- [ ] **Step 8: Commit**

```bash
git add ios/App/App.xcodeproj/project.pbxproj "ios/App/PumploWatch Watch App"
git commit -m "feat(watch): watchOS app target skeleton with Pumplo theme"
```

---

### Task 7: watchOS — dekodér snapshotu (TDD) + `WatchConnector`

**Files:**
- Create: `ios/App/PumploWatch Watch App/WatchWorkoutSnapshot.swift`
- Create: `ios/App/PumploWatch Watch App/WatchConnector.swift`
- Modify: `ios/App/PumploWatch Watch App/RootView.swift`
- Test: `ios/App/NativeTests/main.swift`

**Interfaces:**
- Consumes: slovník, který posílá `WatchWorkoutPlugin` (task 5) — klíče kontraktu + `seq`.
- Produces:
  ```swift
  struct WatchWorkoutSnapshot: Equatable {
    enum Phase: String { case set, rest, summary, idle }
    var seq: Double; var phase: Phase; var exerciseName: String; var slotCategory: String?
    var setIndex: Int; var totalSets: Int; var targetWeight: Double?; var targetReps: Int
    var repMin: Int; var repMax: Int; var rir: Int?; var prevWeight: Double?; var prevReps: Int?
    var weightStep: Double; var resting: Bool; var restEndsAt: Double?; var nextSetLabel: String?
    static let idle: WatchWorkoutSnapshot
    static func decode(_ dict: [String: Any]) -> WatchWorkoutSnapshot?
    var stepValue: Double; var prefillWeight: Double; var prefillReps: Int
    var slotLabel: String; var setProgressLabel: String; var headerLabel: String
    var targetLine: String; var previousLine: String?
    func remainingSeconds(now: Date) -> Int
  }
  enum WatchFormat { static func weight(_ value: Double) -> String; static func clock(_ seconds: Int) -> String }
  final class WatchConnector: NSObject, ObservableObject {
    @Published private(set) var snapshot: WatchWorkoutSnapshot
    @Published private(set) var hasSnapshot: Bool
    func activate()
    func send(action: String, weight: Double?, reps: Int?)
  }
  ```

- [ ] **Step 1: Napsat padající testy**

Do `ios/App/NativeTests/main.swift` vlož PŘED závěrečný blok `if failures > 0 { ... }`:
```swift
// MARK: - WatchWorkoutSnapshot

let restSnapshot = WatchWorkoutSnapshot.decode([
    "seq": 1_700_000_000_001,
    "phase": "rest",
    "exerciseName": "Šikmý tlak na prsa",
    "slotCategory": "main",
    "setIndex": 1, "totalSets": 4,
    "targetWeight": 40.0, "targetReps": 12, "repMin": 8, "repMax": 12, "rir": 2,
    "prevWeight": 37.5, "prevReps": 10,
    "weightStep": 0.5, "resting": true,
    "restEndsAt": 1_700_000_090_000,
    "nextSetLabel": "Série 3 z 4",
])
expect(restSnapshot?.phase == .rest, "decode reads the phase")
expect(restSnapshot?.exerciseName == "Šikmý tlak na prsa", "decode reads the exercise name")
expect(restSnapshot?.headerLabel == "Hlavní · série 2 z 4", "headerLabel is Czech and 1-based")
expect(restSnapshot?.targetLine == "Cíl 8–12 · RIR 2", "targetLine shows range and RIR")
expect(restSnapshot?.previousLine == "Naposledy: 37,5 kg × 10", "previousLine shows the last set")
expect(restSnapshot?.nextSetLabel == "Série 3 z 4", "decode reads nextSetLabel")
expect(restSnapshot?.remainingSeconds(now: Date(timeIntervalSince1970: 1_700_000_060)) == 30,
       "remainingSeconds counts down from restEndsAt")
expect(restSnapshot?.remainingSeconds(now: Date(timeIntervalSince1970: 1_700_000_200)) == 0,
       "remainingSeconds never goes negative")

// Chybějící klíč == null na straně telefonu (plugin NSNull zahazuje).
let sparse = WatchWorkoutSnapshot.decode([
    "seq": 2, "phase": "set", "exerciseName": "Dřep", "setIndex": 0, "totalSets": 3,
    "targetReps": 10, "repMin": 8, "repMax": 10, "weightStep": 0.5, "resting": false,
])
expect(sparse?.targetWeight == nil, "missing targetWeight decodes as nil")
expect(sparse?.rir == nil, "missing rir decodes as nil")
expect(sparse?.previousLine == nil, "previousLine is nil without a previous set")
expect(sparse?.targetLine == "Cíl 8–10", "targetLine omits RIR when unknown")
expect(sparse?.slotLabel == "", "slotLabel is empty without a category")
expect(sparse?.headerLabel == "série 1 z 3", "headerLabel drops the separator without a category")
expect(sparse?.prefillWeight == 0, "prefillWeight is 0 for a first-time exercise")
expect(sparse?.prefillReps == 10, "prefillReps uses the target reps")
expect(sparse?.stepValue == 0.5, "stepValue keeps the 0.5 kg contract")
expect(WatchWorkoutSnapshot.decode(["phase": "nonsense"]) == nil, "decode rejects an unknown phase")
expect(WatchWorkoutSnapshot.decode(["exerciseName": "x"]) == nil, "decode rejects a payload without a phase")

// MARK: - WatchFormat

expect(WatchFormat.weight(40) == "40", "whole weights have no decimals")
expect(WatchFormat.weight(37.5) == "37,5", "half steps use a Czech decimal comma")
expect(WatchFormat.weight(0) == "0", "zero weight renders as 0")
expect(WatchFormat.clock(75) == "1:15", "clock formats minutes and seconds")
expect(WatchFormat.clock(5) == "0:05", "clock pads seconds")
```

- [ ] **Step 2: Spustit harness — musí selhat**

Run:
```bash
cd ~/pumplo && swiftc -o /tmp/pumplo-native-tests ios/App/App/WatchPayload.swift "ios/App/PumploWatch Watch App/WatchWorkoutSnapshot.swift" ios/App/NativeTests/main.swift && /tmp/pumplo-native-tests
```
Expected: FAIL — `no such file or directory: 'ios/App/PumploWatch Watch App/WatchWorkoutSnapshot.swift'`.

- [ ] **Step 3: Minimální implementace modelu**

Create `ios/App/PumploWatch Watch App/WatchWorkoutSnapshot.swift`:
```swift
import Foundation

// Zrcadlo WatchWorkoutState z src/lib/watchWorkout.ts. Jen Foundation (žádné
// SwiftUI ani WatchConnectivity), aby se dekodér dal testovat harnessem.
struct WatchWorkoutSnapshot: Equatable {
    enum Phase: String { case set, rest, summary, idle }

    var seq: Double
    var phase: Phase
    var exerciseName: String
    var slotCategory: String?
    var setIndex: Int
    var totalSets: Int
    var targetWeight: Double?
    var targetReps: Int
    var repMin: Int
    var repMax: Int
    var rir: Int?
    var prevWeight: Double?
    var prevReps: Int?
    var weightStep: Double
    var resting: Bool
    var restEndsAt: Double?
    var nextSetLabel: String?

    static let idle = WatchWorkoutSnapshot(
        seq: 0, phase: .idle, exerciseName: "", slotCategory: nil,
        setIndex: 0, totalSets: 0, targetWeight: nil, targetReps: 0,
        repMin: 0, repMax: 0, rir: nil, prevWeight: nil, prevReps: nil,
        weightStep: 0.5, resting: false, restEndsAt: nil, nextSetLabel: nil)

    // Chybějící klíč znamená null — plugin NSNull cestou zahazuje.
    static func decode(_ dict: [String: Any]) -> WatchWorkoutSnapshot? {
        guard let phase = Phase(rawValue: dict["phase"] as? String ?? "") else { return nil }
        func number(_ key: String) -> NSNumber? { dict[key] as? NSNumber }
        return WatchWorkoutSnapshot(
            seq: number("seq")?.doubleValue ?? 0,
            phase: phase,
            exerciseName: dict["exerciseName"] as? String ?? "",
            slotCategory: dict["slotCategory"] as? String,
            setIndex: number("setIndex")?.intValue ?? 0,
            totalSets: number("totalSets")?.intValue ?? 0,
            targetWeight: number("targetWeight")?.doubleValue,
            targetReps: number("targetReps")?.intValue ?? 0,
            repMin: number("repMin")?.intValue ?? 0,
            repMax: number("repMax")?.intValue ?? 0,
            rir: number("rir")?.intValue,
            prevWeight: number("prevWeight")?.doubleValue,
            prevReps: number("prevReps")?.intValue,
            weightStep: number("weightStep")?.doubleValue ?? 0.5,
            resting: number("resting")?.boolValue ?? false,
            restEndsAt: number("restEndsAt")?.doubleValue,
            nextSetLabel: dict["nextSetLabel"] as? String)
    }

    // Krok korunky. Nula by rozbila zaokrouhlování, proto pojistka.
    var stepValue: Double { weightStep > 0 ? weightStep : 0.5 }

    // Předvyplnění spinnerů: cíl > naposledy > 0 (vlastní váha).
    var prefillWeight: Double {
        let base = targetWeight ?? prevWeight ?? 0
        return (base / stepValue).rounded() * stepValue
    }
    var prefillReps: Int { targetReps > 0 ? targetReps : max(repMax, 1) }

    var slotLabel: String {
        switch slotCategory {
        case "main": return "Hlavní"
        case "secondary": return "Pomocný"
        case "isolation": return "Izolace"
        case "core": return "Core"
        case "conditioning": return "Kardio"
        default: return slotCategory ?? ""
        }
    }

    var setProgressLabel: String {
        "série \(min(setIndex + 1, max(totalSets, 1))) z \(max(totalSets, 1))"
    }

    var headerLabel: String {
        slotLabel.isEmpty ? setProgressLabel : "\(slotLabel) · \(setProgressLabel)"
    }

    var targetLine: String {
        let range = "Cíl \(repMin)–\(repMax)"
        guard let rir else { return range }
        return "\(range) · RIR \(rir)"
    }

    var previousLine: String? {
        guard let prevWeight, let prevReps else { return nil }
        return "Naposledy: \(WatchFormat.weight(prevWeight)) kg × \(prevReps)"
    }

    func remainingSeconds(now: Date = Date()) -> Int {
        guard let restEndsAt else { return 0 }
        return max(0, Int(ceil(restEndsAt / 1000 - now.timeIntervalSince1970)))
    }
}

enum WatchFormat {
    // 40 → "40", 37.5 → "37,5" (desetinná čárka jako na mockupu).
    static func weight(_ value: Double) -> String {
        let rounded = (value * 10).rounded() / 10
        if abs(rounded - rounded.rounded()) < 0.05 { return String(Int(rounded.rounded())) }
        return String(format: "%.1f", rounded).replacingOccurrences(of: ".", with: ",")
    }

    static func clock(_ seconds: Int) -> String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}
```

- [ ] **Step 4: Spustit harness — musí projít**

Run:
```bash
cd ~/pumplo && swiftc -o /tmp/pumplo-native-tests ios/App/App/WatchPayload.swift "ios/App/PumploWatch Watch App/WatchWorkoutSnapshot.swift" ios/App/NativeTests/main.swift && /tmp/pumplo-native-tests
```
Expected: `all native tests passed`, exit 0.

- [ ] **Step 5: Spojení s telefonem**

Create `ios/App/PumploWatch Watch App/WatchConnector.swift`:
```swift
import Foundation
import WatchConnectivity

// Příjem stavu z telefonu a odesílání akcí zpět. Stav chodí dvěma cestami
// (applicationContext + přímá zpráva u urgentních přechodů), takže se může
// zopakovat nebo dorazit na přeskáčku — rozhoduje seq, starší se zahodí.
final class WatchConnector: NSObject, ObservableObject {
    @Published private(set) var snapshot: WatchWorkoutSnapshot = .idle
    @Published private(set) var hasSnapshot = false

    private var lastSeq: Double = -1

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func send(action: String, weight: Double? = nil, reps: Int? = nil) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }

        var message: [String: Any] = ["type": action]
        if let weight { message["weight"] = weight }
        if let reps { message["reps"] = reps }

        if session.isReachable {
            session.sendMessage(message, replyHandler: nil, errorHandler: { _ in })
        } else {
            // Telefon zrovna nedosažitelný → fronta, doručí se v pořadí.
            session.transferUserInfo(message)
        }
    }

    private func apply(_ dict: [String: Any]) {
        guard let next = WatchWorkoutSnapshot.decode(dict) else { return }
        guard next.seq >= lastSeq else { return }
        lastSeq = next.seq
        DispatchQueue.main.async {
            self.snapshot = next
            self.hasSnapshot = next.phase != .idle
        }
    }
}

extension WatchConnector: WCSessionDelegate {
    func session(_ session: WCSession,
                 activationDidCompleteWith activationState: WCSessionActivationState,
                 error: Error?) {
        // Appka otevřená uprostřed tréninku: poslední kontext už tu je.
        let context = session.receivedApplicationContext
        if !context.isEmpty { apply(context) }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        apply(applicationContext)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        apply(message)
    }
}
```

- [ ] **Step 6: `RootView` přepíná podle fáze**

Přepiš `ios/App/PumploWatch Watch App/RootView.swift` na:
```swift
import SwiftUI

// Fáze určuje obrazovku. Aktivní série a pauza přijdou v dalších krocích,
// zatím se vypíše, co dorazilo — ověření, že transport funguje.
struct RootView: View {
    @StateObject private var connector = WatchConnector()

    var body: some View {
        ZStack {
            PumploTheme.navy.ignoresSafeArea()
            content
        }
        .onAppear { connector.activate() }
    }

    @ViewBuilder private var content: some View {
        if !connector.hasSnapshot {
            WaitingView()
        } else {
            switch connector.snapshot.phase {
            case .set:
                VStack(spacing: 4) {
                    Text(connector.snapshot.exerciseName)
                        .font(.system(size: 15, weight: .black))
                        .foregroundStyle(.white)
                    Text(connector.snapshot.headerLabel)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(PumploTheme.cyan)
                }
            case .rest:
                Text(WatchFormat.clock(connector.snapshot.remainingSeconds()))
                    .font(.system(size: 26, weight: .black))
                    .foregroundStyle(.white)
            case .summary:
                DoneView()
            case .idle:
                WaitingView()
            }
        }
    }
}
```

- [ ] **Step 7: Přeložit watch target**

Run:
```bash
cd ~/pumplo && xcodebuild -project ios/App/App.xcodeproj -scheme "PumploWatch Watch App" -sdk watchsimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build 2>&1 | tail -5
```
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 8: Commit**

```bash
git add "ios/App/PumploWatch Watch App" ios/App/NativeTests/main.swift
git commit -m "feat(watch): snapshot decoder + WatchConnectivity link on the watch"
```

---

### Task 8: watchOS — obrazovka aktivní série (Digital Crown spinnery)

Podle mockupu `~/Desktop/pumplo-watch-mockup.png`: název cviku · „Hlavní · série 2 z 4" · dvě pole **KG** (krok 0,5) a **OPAK.** (krok 1) předvyplněná z cíle/minula, aktivní pole má cyan rámeček a ovládá ho korunka, ťuk pole přepíná · „Cíl 8–12 · RIR 2" · „Naposledy: 37,5 kg × 10" · dole ‹ ✓ ›.

**Files:**
- Create: `ios/App/PumploWatch Watch App/SpinnerField.swift`
- Create: `ios/App/PumploWatch Watch App/ActiveSetView.swift`
- Modify: `ios/App/PumploWatch Watch App/RootView.swift`

**Interfaces:**
- Consumes: `WatchWorkoutSnapshot` (`prefillWeight`, `prefillReps`, `stepValue`, `headerLabel`, `targetLine`, `previousLine`), `WatchFormat.weight`, `PumploTheme`, `WatchConnector.send`.
- Produces: `SpinnerField(title:text:isActive:onTap:)`, `ActiveSetView(snapshot:onLog:onPrev:onNext:)` s `onLog: (Double, Int) -> Void`.

- [ ] **Step 1: Jedno spinner pole**

Create `ios/App/PumploWatch Watch App/SpinnerField.swift`:
```swift
import SwiftUI

// Jedno číselné pole. Aktivní (= to, co poslouchá korunku) má cyan rámeček,
// ťuknutím se přepne fokus na druhé.
struct SpinnerField: View {
    let title: String
    let text: String
    let isActive: Bool
    let onTap: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Text(title)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(PumploTheme.dim)
            Text(text)
                .font(.system(size: 22, weight: .black))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.08)))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(isActive ? PumploTheme.cyan : Color.clear, lineWidth: 2)
        )
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
    }
}
```

- [ ] **Step 2: Obrazovka série**

Create `ios/App/PumploWatch Watch App/ActiveSetView.swift`:
```swift
import SwiftUI

// Aktivní série. Korunku dostane pole, které má fokus — proto má každé pole
// vlastní .digitalCrownRotation; přepnutí je jen změna @FocusState.
struct ActiveSetView: View {
    let snapshot: WatchWorkoutSnapshot
    let onLog: (Double, Int) -> Void
    let onPrev: () -> Void
    let onNext: () -> Void

    private enum Field: Hashable { case weight, reps }

    @State private var weight: Double = 0
    @State private var reps: Double = 0
    @FocusState private var focused: Field?

    var body: some View {
        VStack(spacing: 5) {
            Text(snapshot.exerciseName)
                .font(.system(size: 15, weight: .black))
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
                .multilineTextAlignment(.center)

            Text(snapshot.headerLabel)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(PumploTheme.cyan)
                .lineLimit(1)

            HStack(spacing: 6) {
                SpinnerField(title: "KG",
                             text: WatchFormat.weight(weight),
                             isActive: focused == .weight) { focused = .weight }
                    .focusable()
                    .focused($focused, equals: .weight)
                    .digitalCrownRotation($weight, from: 0, through: 500, by: snapshot.stepValue,
                                          sensitivity: .medium, isContinuous: false,
                                          isHapticFeedbackEnabled: true)

                SpinnerField(title: "OPAK.",
                             text: "\(Int(reps))",
                             isActive: focused == .reps) { focused = .reps }
                    .focusable()
                    .focused($focused, equals: .reps)
                    .digitalCrownRotation($reps, from: 1, through: 100, by: 1,
                                          sensitivity: .medium, isContinuous: false,
                                          isHapticFeedbackEnabled: true)
            }

            Text(snapshot.targetLine)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(PumploTheme.dim)
                .lineLimit(1)

            if let previousLine = snapshot.previousLine {
                Text(previousLine)
                    .font(.system(size: 10))
                    .foregroundStyle(PumploTheme.dim)
                    .lineLimit(1)
            }

            HStack(spacing: 6) {
                Button(action: onPrev) {
                    Image(systemName: "chevron.left").font(.system(size: 14, weight: .bold))
                }
                .buttonStyle(.bordered)
                .tint(.white.opacity(0.2))

                Button { onLog(weight, Int(reps)) } label: {
                    Image(systemName: "checkmark").font(.system(size: 18, weight: .black))
                }
                .buttonStyle(.borderedProminent)
                .tint(PumploTheme.cyan)

                Button(action: onNext) {
                    Image(systemName: "chevron.right").font(.system(size: 14, weight: .bold))
                }
                .buttonStyle(.bordered)
                .tint(.white.opacity(0.2))
            }
            .padding(.top, 2)
        }
        .padding(.horizontal, 4)
        .onAppear { seed() }
        // Předvyplnění se obnoví jen při změně cviku/série — rozepsanou hodnotu
        // uprostřed série by přepsání zahodilo.
        .onChange(of: seedKey) { _, _ in seed() }
    }

    private var seedKey: String { "\(snapshot.exerciseName)#\(snapshot.setIndex)" }

    private func seed() {
        weight = snapshot.prefillWeight
        reps = Double(snapshot.prefillReps)
        focused = .weight
    }
}
```

- [ ] **Step 3: Zapojit do `RootView`**

V `ios/App/PumploWatch Watch App/RootView.swift` nahraď větev `case .set:` za:
```swift
            case .set:
                ActiveSetView(
                    snapshot: connector.snapshot,
                    onLog: { weight, reps in connector.send(action: "logSet", weight: weight, reps: reps) },
                    onPrev: { connector.send(action: "goPrevSet") },
                    onNext: { connector.send(action: "goNextSet") })
```

- [ ] **Step 4: Přeložit watch target**

Run:
```bash
cd ~/pumplo && xcodebuild -project ios/App/App.xcodeproj -scheme "PumploWatch Watch App" -sdk watchsimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build 2>&1 | tail -5
```
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 5: Commit**

```bash
git add "ios/App/PumploWatch Watch App"
git commit -m "feat(watch): active set screen with Digital Crown spinners"
```

---

### Task 9: watchOS — pauza s odpočtem a haptikou

Kruhový odpočet běží LOKÁLNĚ z `restEndsAt`, takže krátký výpadek spojení ho nezastaví. Haptika: tik na 3/2/1, silný náraz na 0. Tlačítka „+15 s" (`addRest15`) a „Přeskočit" (`skipRest`).

**Files:**
- Create: `ios/App/PumploWatch Watch App/RestView.swift`
- Modify: `ios/App/PumploWatch Watch App/RootView.swift`

**Interfaces:**
- Consumes: `WatchWorkoutSnapshot.remainingSeconds(now:)`, `nextSetLabel`, `restEndsAt`, `WatchFormat.clock`, `PumploTheme`, `WatchConnector.send`.
- Produces: `RestView(snapshot:onAdd15:onSkip:)`.

- [ ] **Step 1: Obrazovka pauzy**

Create `ios/App/PumploWatch Watch App/RestView.swift`:
```swift
import SwiftUI
import WatchKit

// Pauza. Zbývající čas se počítá z restEndsAt lokálně (telefon posílá jen
// koncový čas), takže výpadek spojení odpočet nezastaví ani neresetuje.
struct RestView: View {
    let snapshot: WatchWorkoutSnapshot
    let onAdd15: () -> Void
    let onSkip: () -> Void

    @State private var remaining = 0
    @State private var total = 0
    @State private var lastTick = -1

    private let ticker = Timer.publish(every: 0.25, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                Circle().stroke(Color.white.opacity(0.15), lineWidth: 6)
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(PumploTheme.cyan, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text(WatchFormat.clock(remaining))
                    .font(.system(size: 24, weight: .black))
                    .monospacedDigit()
                    .foregroundStyle(.white)
            }
            .frame(width: 82, height: 82)

            Text(caption)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(PumploTheme.cyan)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            HStack(spacing: 6) {
                Button("+15 s", action: onAdd15)
                    .buttonStyle(.bordered)
                    .tint(.white.opacity(0.2))
                Button("Přeskočit", action: onSkip)
                    .buttonStyle(.borderedProminent)
                    .tint(PumploTheme.cyan)
            }
            .font(.system(size: 12, weight: .bold))
        }
        .padding(.horizontal, 4)
        .onAppear { tick() }
        .onReceive(ticker) { _ in tick() }
        // Nová pauza i +15 s mění koncový čas → prstenec začne znovu plný.
        .onChange(of: snapshot.restEndsAt) { _, _ in
            total = 0
            lastTick = -1
            tick()
        }
    }

    private var caption: String {
        guard let label = snapshot.nextSetLabel, !label.isEmpty else { return "Pauza" }
        return "Pauza · pak \(label)"
    }

    private var progress: CGFloat {
        guard total > 0 else { return 0 }
        return CGFloat(remaining) / CGFloat(total)
    }

    private func tick() {
        let value = snapshot.remainingSeconds()
        remaining = value
        total = max(total, value)

        guard value != lastTick else { return }
        let firstTick = lastTick < 0
        lastTick = value
        // Při prvním vykreslení se nehraje nic — jinak by appka otevřená
        // po skončení pauzy hned zavibrovala.
        guard !firstTick else { return }
        if value > 0 && value <= 3 { WKInterfaceDevice.current().play(.click) }
        if value == 0 { WKInterfaceDevice.current().play(.notification) }
    }
}
```

- [ ] **Step 2: Zapojit do `RootView`**

V `ios/App/PumploWatch Watch App/RootView.swift` nahraď větev `case .rest:` za:
```swift
            case .rest:
                RestView(
                    snapshot: connector.snapshot,
                    onAdd15: { connector.send(action: "addRest15") },
                    onSkip: { connector.send(action: "skipRest") })
```

- [ ] **Step 3: Přeložit watch target**

Run:
```bash
cd ~/pumplo && xcodebuild -project ios/App/App.xcodeproj -scheme "PumploWatch Watch App" -sdk watchsimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build 2>&1 | tail -5
```
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 4: Commit**

```bash
git add "ios/App/PumploWatch Watch App"
git commit -m "feat(watch): rest screen with local countdown and haptics"
```

---

### Task 10: End-to-end na zařízení (MANUAL CHECKPOINT) + regresní kontrola

**Files:** žádné nové; případné opravy padají do souborů z tasků 1–9.

**Interfaces:**
- Consumes: všechno z tasků 1–9.
- Produces: ověřený tok telefon ↔ hodinky.

- [ ] **Step 1: Regresní sada na webu a v nativu**

Run:
```bash
cd ~/pumplo && npx tsc --noEmit 2>&1 | head -20 && npm test && npm run build 2>&1 | tail -3
swiftc -o /tmp/pumplo-native-tests ios/App/App/WatchPayload.swift "ios/App/PumploWatch Watch App/WatchWorkoutSnapshot.swift" ios/App/NativeTests/main.swift && /tmp/pumplo-native-tests
```
Expected: 0 TS chyb, všechny vitest testy PASS, build OK, `all native tests passed`.

- [ ] **Step 2: Nahrát aktuální web build do nativní appky**

Run:
```bash
cd ~/pumplo && npx cap sync ios 2>&1 | tail -5
```
Expected: `sync finished`. (Targety ani soubory se tím nemění — kopírují se jen web assety a SPM balíčky.)

- [ ] **Step 3: MANUAL CHECKPOINT (David) — spustit obojí na zařízení**

1. `open ~/pumplo/ios/App/App.xcodeproj`
2. Scheme **App**, destination **iPhone Davida** → **Run**. Nech appku běžet.
3. Scheme **PumploWatch Watch App**, destination **Apple Watch Davida** → **Run**. (Při prvním spuštění na hodinkách potvrď v Nastavení ▸ Obecné ▸ VPN a správa zařízení důvěru vývojáři.)
4. Na hodinkách zůstane „Čekám na telefon", dokud v telefonu nespustíš trénink.

- [ ] **Step 4: MANUAL CHECKPOINT (David) — projít scénáře**

| # | Co udělat | Co musí nastat |
|---|---|---|
| 1 | Spustit trénink v telefonu | Hodinky do ~2 s ukážou název cviku, „Hlavní · série 1 z X", předvyplněné KG a OPAK. |
| 2 | Otočit korunkou (aktivní KG) | Váha jde po 0,5 kg; pole má cyan rámeček |
| 3 | Ťuknout na OPAK. a otočit | Fokus i rámeček se přesunou; opakování jdou po 1 |
| 4 | Zmáčknout ✓ | Telefon zapíše sérii s hodnotami z hodinek a přejde na pauzu; hodinky přepnou na odpočet do ~1 s |
| 5 | Sledovat odpočet | Prstenec ubývá plynule; na 3/2/1 tik, na 0 silný náraz; telefon skončí pauzu ve stejnou chvíli |
| 6 | „+15 s" na hodinkách | Odpočet na hodinkách i v telefonu povyskočí o 15 s |
| 7 | „Přeskočit" na hodinkách | Pauza skončí v telefonu i na hodinkách, hodinky ukážou další sérii |
| 8 | ‹ a › na hodinkách | Telefon přeskočí na předchozí/další sérii (na kraji cviku na sousední cvik) |
| 9 | Během pauzy odejít od telefonu ~10 m a vrátit se | Odpočet na hodinkách běží dál bez skoku, po návratu sedí s telefonem |
| 10 | Zavřít a znovu otevřít appku na hodinkách uprostřed tréninku | Obnoví se aktuální stav (z posledního applicationContextu), ne „Čekám na telefon" |
| 11 | Dokončit trénink | Hodinky ukážou „Hotovo!" |
| 12 | Opustit trénink v telefonu (Ukončit) | Hodinky se vrátí na „Čekám na telefon" |
| 13 | Vypnout Bluetooth na telefonu a projít sérii v appce | Telefon funguje normálně, nic nepadá, žádná chybová hláška |

Cokoliv neprojde, oprav v odpovídajícím souboru z tasků 1–9 a scénář zopakuj.

- [ ] **Step 5 (volitelné): watchOS simulátor**

Runtime pro watchOS na tomhle Macu zatím není (`xcrun simctl list runtimes` ukazuje jen iOS). Když ho budeš chtít (např. pro rychlé UI iterace bez hodinek):
```bash
xcodebuild -downloadPlatform watchOS
```
Pak v Simulatoru spárovat watch simulátor s iPhone simulátorem (Simulator ▸ File ▸ Add Watch Companion…) a pustit obě schemes proti nim. Pro finální ověření platí fyzické hodinky — WatchConnectivity se v simulátoru chová optimističtěji než na zápěstí.

- [ ] **Step 6: Commit případných oprav**

```bash
git add -A
git commit -m "fix(watch): device-test fixes for the watchOS companion"
```

---

## Co plán vědomě NEŘEŠÍ

- **Wear OS** — samostatný plán C (nový Gradle modul, Data Layer, Compose for Wear).
- **Nezávislý režim se zhasnutým telefonem**, tepovka z HealthKit, zápis do Apple Fitness — v2 podle specu.
- **App Group mezi iOS a watch appkou** — v1 stačí `WCSession`, sdílený kontejner by teď neměl uživatele.
- **Complication / widget na ciferníku** — mimo mockup.

## Self-Review

**1. Pokrytí specu**
- „Web = zdroj pravdy, akce jdou do stávajících handlerů" → tasky 1–3 (`completePendingSetRef`, `handleRestComplete`, `adjustListRest`, `goToExerciseRef`; žádná nová logika tréninku).
- „iOS: `WCSession`, `updateApplicationContext` pro stav, `sendMessage` pro urgentní" → task 5 (`push`, `WatchPayload.isUrgent`).
- „Plugin musí fungovat, i když watch app neběží (no-op)" → task 5 (`WCSession.isSupported`, `activationState`, `try?`/`errorHandler` bez rejectu) + globální omezení.
- „watchOS: SwiftUI target v `ios/App`, korunka pro spinnery" → tasky 6 a 8.
- UI aktivní série (název, slot · série X z Y, KG/OPAK., cyan rámeček, Cíl a RIR, Naposledy, ‹ ✓ ›) → task 8.
- UI pauzy (kruhový odpočet, haptika 3/2/1 a 0, „Pauza · pak N. série", +15 s / Přeskočit) → task 9.
- Okrajové obrazovky (čekání na telefon, souhrn) → task 6 (`WaitingView`, `DoneView`) + `phase: 'idle'` při cooldownu z tasku 1.
- „stav posílat idempotentně, nejnovější přebije" → `seq` (task 5) + seq guard (task 7).
- „Testování: fyzické hodinky + watchOS simulátor" → task 10.
- „Build/packaging: nový watchOS App target, capability WatchConnectivity" → task 6 (WatchConnectivity nepotřebuje entitlement, stačí import — proto se v plánu žádná capability nezapíná).
- Zadání navíc oproti specu: dvě opravy z revize plánu A (jednotné hodiny `restEndsAt`, parita `logSet`) → tasky 1 a 2.

**2. Placeholdery**
Žádné „TBD"/„doplň podle potřeby". Každý krok má konkrétní kód nebo konkrétní příkaz. Dvě místa jsou vědomě podmíněná, ale s přesným návodem: název složky/scheme, když ho Xcode odvodí jinak (task 6, step 2), a doinstalace gemu `xcodeproj`, kdyby chyběl (task 5, step 1). Manuální kroky jsou označené jako MANUAL CHECKPOINT (David) a mají po sobě ověřovací příkaz.

**3. Konzistence typů**
- Web: `resolveWatchRestEndsAt(RestClockInput)`, `resolveLoggedWeight(LoggedWeightInput)`, `resolveSetStep(SetStepInput, 'prev'|'next')` — stejná jména v testu, implementaci i volání ve `WorkoutSession.tsx`.
- `onRestActiveChange?: (active: boolean, endsAt?: number) => void` a `adjustRestRef` mají shodnou signaturu v `ExercisePlayer`, ve wrapperu `ExercisePlayerWithVideo` i v místě předání.
- Nativ: `WatchPayload.sanitize/isUrgent/action` používá task 5 přesně tak, jak je task 4 definoval; klíč akce je všude `type` (shoda s `WatchAction` v JS), snapshot na hodinkách čte `WatchWorkoutSnapshot.decode` tytéž klíče, které plugin posílá (kontrakt + `seq`).
- `WatchFormat.weight/clock` a odvozené popisky (`headerLabel`, `targetLine`, `previousLine`, `stepValue`, `prefillWeight`, `prefillReps`) jsou definované v tasku 7 a používané v taskách 8 a 9 pod stejnými jmény.
