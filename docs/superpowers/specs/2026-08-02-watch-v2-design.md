# Hodinky v2 — ovládání prstem, vlastní trénink, spouštění z hodinek

**Datum:** 2. 8. 2026
**Stav:** návrh ke schválení
**Navazuje na:** `2026-07-23-watch-app-design.md`, plán `2026-07-25-watch-plan-b-ios-watchos.md` (tasky 1–9 hotové)

## Proč

Hodinková appka běží na Davidových Apple Watch (2. 8. 2026) a trénink z Pumplo plánu na nich funguje. Zkouška na zápěstí ale odhalila tři věci:

1. **Vlastní trénink hodinky nevidí.** „Vlastní trénink" jede routou `/custom-workout/:id`, tedy `src/pages/CustomWorkoutPlayer.tsx`, a ten o hodinkách neví. Most je zapojený jen ve `WorkoutSession.tsx`, což je přehrávač plánového tréninku. Hodinky proto zůstanou na „Čekám na telefon". Není to chyba přenosu — je to díra v rozsahu plánu B.
2. **Hodnoty jdou měnit jen korunkou.** David chce měnit kila a opakování i tažením prstu.
3. **Trénink nejde spustit z hodinek.** Dnes musí vždycky začít v telefonu.

## Rozsah

Tři části, každá stojí samostatně a dá se nasadit zvlášť:

- **A — ovládání prstem** v poli KG a OPAK.
- **B — vlastní trénink na hodinkách**, včetně kardio cviků.
- **C — spuštění tréninku z hodinek** (dálkové nakopnutí telefonu).

### Mimo rozsah

- **Samostatný režim hodinek** (vlastní přihlášení, vlastní stahování dat ze Supabase, cvičení se zamčeným telefonem ve skříňce). Rozhodnuto 2. 8. 2026: až jako samostatný projekt, po osahání téhle verze.
- **Wear OS** — samostatný plán C, neimplementovaný.
- **Tepovka z HealthKit, complication na ciferníku, App Group** — beze změny mimo rozsah, stejně jako v plánu B.

---

## A — ovládání prstem

**Soubory:** `ios/App/PumploWatch Watch App/SpinnerField.swift` (změna), `ActiveSetView.swift` (změna).

Do `SpinnerField` přibude svislé tažení. Prst na poli, tah nahoru přidává, tah dolů ubírá. Pole si o kroku nic nemyslí — dostane zvenku `step` a hlásí ven `onDelta(Int)`, tedy o kolik kroků se má hodnota posunout. Převod na kila a opakování zůstává v `ActiveSetView`, kde je dnes.

**Citlivost:** jeden krok na každých **8 bodů** tahu. Tažení přes celý displej (~160 bodů) je tedy asi 20 kroků, u váhy 10 kg. Gesto si drží zbytek dělení mezi událostmi, takže pomalý tah po jednom kroku funguje stejně jako rychlý přejezd.

**Haptika:** každý krok `WKInterfaceDevice.current().play(.click)`, stejně jako to dělá korunka. Bez toho by se prstem ladilo naslepo.

**Fokus:** dotek pole (ťuknutí i začátek tažení) přepne `@FocusState` na to pole. Korunka i prst tak vždycky ovládají totéž pole a nemůžou si přetahovat hodnotu.

**Meze:** stejné jako u korunky — váha 0 až 500 s krokem `snapshot.stepValue`, opakování 1 až 100 s krokem 1. Ořezává se v `ActiveSetView` při zpracování `onDelta`.

**Co se nemění:** korunka funguje beze změny, kroky zůstávají půl kila a jedno opakování, vzhled pole zůstává.

**Známé riziko:** svislé tažení uvnitř `ScrollView` si systém může vzít pro rolování. `ActiveSetView` dnes ve scroll view není, ale kardio a delší obsah by to změnily — proto `DragGesture(minimumDistance: 3)` a v případě konfliktu `.simultaneousGesture`. Ověří se na zařízení, ne v simulátoru.

---

## B — vlastní trénink na hodinkách

### B.1 Sdílený hook místo druhé kopie

Dnešní zapojení hodinek je ve `WorkoutSession.tsx` rozeseté na třech místech: efekt posílající snapshot (~ř. 963–1004), `watchActionRef` s obsluhou akcí (~ř. 915–934) a úklid při odchodu (~ř. 937). Zkopírovat to do `CustomWorkoutPlayer.tsx` by znamenalo dvě kopie stejné logiky ve dvou souborech, které mají dohromady přes 3 400 řádků.

Vznikne **`src/hooks/useWatchBridge.ts`**. Rozhraní:

```ts
useWatchBridge({
  state: WatchBridgeState | null,   // co se má hodinkám ukázat; null = neposílat nic
  onAction: (a: WatchAction) => void,  // co se má stát, když hodinky něco pošlou
})
```

Hook drží ref-indirekci na `onAction` (aby listener připojený při mountu viděl aktuální closure), přihlásí se přes `addWatchActionListener`, při každé změně `state` zavolá `updateWatchState(buildWatchWorkoutState(state))` a při odmountování zavolá `endWatchState()`. Žádná znalost tréninku v něm není — jen přenos.

`WorkoutSession.tsx` se na něj přepíše beze změny chování; hotové testy z plánu B (`src/lib/watchWorkout.test.ts`) musí zůstat zelené, protože `buildWatchWorkoutState`, `resolveWatchRestEndsAt`, `resolveLoggedWeight` ani `resolveSetStep` se nemění.

### B.2 Zapojení vlastního přehrávače

**Soubor:** `src/pages/CustomWorkoutPlayer.tsx` (změna).

Vlastní přehrávač už drží konec pauzy jako časové razítko — `restEndTimeRef` (ř. 603), plněný na ř. 610. Hodiny pauzy se tedy **nemusí přestavovat**, na rozdíl od toho, co bylo potřeba u `WorkoutSession`. `restEndsAt` do snapshotu jde přímo z `restEndTimeRef.current`, když je `playerState === 'rest'`, jinak `null`.

Mapování zbytku snapshotu:

| Pole snapshotu | Zdroj v `CustomWorkoutPlayer` |
|---|---|
| `phase` | `playerState`: `exercise` → `set` (u kardio cviku `cardio`, viz B.3), `rest` → `rest`, `completed` → `summary`, ostatní → `idle` |
| `exerciseName` | `currentExercise.exercise_name` / `_en` podle jazyka |
| `setIndex` / `totalSets` | `currentSet` / `currentExercise.sets` |
| `targetWeight` | `currentExercise.weight_per_set[currentSet-1] ?? weight_kg` |
| `repMin` / `repMax` | `reps_per_set[currentSet-1] ?? reps` (vlastní plán má jedno číslo, ne rozmezí — obě pole dostanou stejnou hodnotu) |
| `rir` | `null` — vlastní plán RIR nemá |
| `prevWeight` / `prevReps` | poslední hotová série z `completedSetsMap` pro aktuální cvik |
| `nextSetLabel` | název dalšího cviku, když pauza vede na jiný cvik |

Akce z hodinek se mapují na **stávající** handlery, žádná nová tréninková logika nevzniká: `logSet` → `handleCompleteSet` s hodnotami z hodinek, `skipRest` → stávající přeskočení pauzy, `addRest15` → posun `restEndTimeRef`, `goPrevSet` / `goNextSet` → posun série a cviku.

### B.3 Kardio

Vlastní trénink má cviky na čas (`unit_type === 'time_min'` nebo `category === 'cardio'`, viz ř. 216), které plánový trénink nezná vůbec. Snapshot pro ně dnes nemá co poslat.

**Kontrakt dostane novou fázi `cardio`** a dvě pole:

- `cardioEndsAt: number | null` — časové razítko konce, ze stávajícího `cardioEndTimeRef`
- `cardioPaused: boolean` — ze stávajícího `cardioPaused`

Když je kardio pozastavené, `cardioEndsAt` nese čas, do kterého by doběhlo, kdyby se pustilo teď — hodinky tak umí ukázat zbývající čas i ve stavu pauzy, aniž by musely znát celkovou délku zvlášť.

**Nová obrazovka `CardioView.swift`** — sourozenec `RestView`: název cviku, zbývající čas, ubývající prstenec, jedno tlačítko start/pauza (`cardioToggle`) a tlačítko hotovo (`goNextSet`). Na nule stejná haptika jako na konci pauzy.

**Nové akce z hodinek:** `cardioToggle`. Přeskočení kardia jde přes stávající `goNextSet`, novou akci nepotřebuje.

---

## C — spuštění tréninku z hodinek

### C.1 Proč to má tuhle podobu

Hodinky nedokážou vytáhnout appku v telefonu do popředí. `WCSession.sendMessage` umí appku probudit na pozadí, ale Pumplo je Capacitor — trénink počítá webová vrstva a data tahá ze Supabase. Když appka běží (i zaklapnutá v kapse), příkaz dorazí a přehrávač se otevře. Když ji iOS vyhodil z paměti, systém ji sice na pozadí nastartuje, ale pár vteřin běhu na síťový dotaz nemusí stačit.

**Rozhodnutí (David, 2. 8. 2026):** telefon nakopnout a **poctivě přiznat, když to nevyjde**. Umělé držení appky naživu (tichá audio session, location background mode) zamítnuto — žere baterku a je to riziko při schvalování v App Storu.

### C.2 Nabídka na hodinkách

Když neběží trénink, ukážou hodinky místo „Čekám na telefon" seznam, odshora dolů:

1. **Pokračovat** — rozdělaný trénink, když nějaký je (plánový i vlastní)
2. **Dnešní trénink** — dnešní den z Pumplo plánu
3. **Vlastní tréninky** — jednotlivé dny vlastních plánů, popiskem „Název plánu · Název dne"

Seznam se **omezuje na 20 položek**. Když jich je víc, poslední řádek řekne „Další v telefonu" — seznam se nikdy neuřízne potichu.

Když telefon zatím nic neposlal (čerstvě nainstalované hodinky), zůstane dnešní „Čekám na telefon".

### C.3 Jak se seznam dostane na hodinky

`WatchPayload.sanitize` schválně zahazuje vnořené objekty a pole, protože `updateApplicationContext` bere jen property-list typy. Seznam proto pojede jako **JSON v jednom textovém poli** `menuJson`, které projde beze změny pravidel. Hodinky si ho rozkódují `JSONDecoder`em a **poslední neprázdnou nabídku si drží v paměti**, takže ji nesmaže snapshot, který ji neobsahuje.

Na telefonu vznikne **`src/hooks/useWatchMenu.ts`**, zavěšený globálně (v `App.tsx`, ne v přehrávači — musí žít i mimo trénink). Skládá nabídku z:

- rozdělaného vlastního tréninku (`usePausedCustomWorkout`) a rozdělaného plánového tréninku,
- dnešního dne z Pumplo plánu,
- dnů vlastních plánů (`useCustomPlans`).

Posílá ji při startu appky, po přihlášení a při změně těchto zdrojů. Velikost je řádově stovky bajtů, limit `applicationContextu` (~262 kB) není blízko.

### C.4 Co se stane po ťuknutí

Hodinky pošlou akci `startWorkout` s `kind` (`resume` | `plan` | `custom`) a u vlastního tréninku s `planId` a `dayId`, a přepnou se na „Spouštím…".

Telefon příkaz zpracuje v **`useWatchMenu`** (globálně, ne v přehrávači — ten při spouštění ještě neběží) a jen zaroutuje na existující cestu:

| `kind` | Cíl |
|---|---|
| `resume` | `/training?resume=true` nebo `/custom-workout/:planId?resume=true` |
| `plan` | `/training?start=true` |
| `custom` | `/custom-workout/:planId?gym=<selected_gym_id>&day=<dayId>` |

`CustomWorkoutPlayer` dnes umí parametry `resume` a `gym`, ale **ne `day`** — den se vždycky vybírá ručně. Přibude tedy podpora `?day=<dayId>`, která výběr dne přeskočí. Bez ní by ťuknutí na hodinkách stejně skončilo u výběru na telefonu, čímž by celá funkce ztratila smysl.

Posilovna se bere z `profile.selected_gym_id`. Když žádná uložená není, telefon ukáže výběr posilovny a hodinky napíšou, že se to musí dokončit v telefonu.

### C.5 Když to nevyjde

Hodinky po odeslání čekají **6 vteřin** na snapshot s fází jinou než `idle`. Když nepřijde, ukážou **„Otevři Pumplo v telefonu"** a tlačítko **Zkusit znovu**. Žádné tiché selhání, žádné čekání do nekonečna.

Když jsou hodinky mimo dosah telefonu, `WatchConnector.send` dnes akci zařadí do fronty přes `transferUserInfo`. Pro `startWorkout` to ale nechceme — trénink spuštěný o dvacet minut později, až se spojení vrátí, je horší než nic. `startWorkout` se proto pošle **jen když je telefon dosažitelný**; jinak rovnou hláška „Telefon není v dosahu".

---

## Rozšíření kontraktu (souhrn)

**Telefon → hodinky** (`WatchWorkoutState`, `WatchPayload.sanitize`):

| Pole | Typ | Význam |
|---|---|---|
| `phase` | + `'cardio'` | nová fáze vedle `set`, `rest`, `summary`, `idle` |
| `cardioEndsAt` | `number \| null` | konec kardio odpočtu |
| `cardioPaused` | `boolean` | kardio je pozastavené |
| `menuJson` | `string` | nabídka tréninků jako JSON |

**Hodinky → telefon** (`WatchPayload.action`):

| Akce | Data |
|---|---|
| `cardioToggle` | — |
| `startWorkout` | `kind`, volitelně `planId`, `dayId` |

`WatchPayload.action` propouští jen známé tvary, takže starší telefonní build novější watch build nerozbije — nové akce prostě zahodí. `isUrgent` se rozšíří o změnu `cardioEndsAt` a `cardioPaused`, aby start a pauza kardia dorazily hned, ne až líným `applicationContextem`.

---

## Testování

**Automaticky (musí být zelené před zkouškou na zařízení):**

- `src/lib/watchWorkout.test.ts` — stávající testy beze změny, plus nové na kardio pole a na skládání nabídky.
- Nový test na mapování stavu `CustomWorkoutPlayer` → snapshot. Čistá funkce `buildCustomWatchState(...)` v `src/lib/watchWorkout.ts`, ne uvnitř komponenty, aby šla testovat bez renderu.
- Nativní harness `ios/App/NativeTests` — dekódování nové fáze, kardio polí a `menuJson`, propouštění nových akcí.
- `npx tsc --noEmit` bez chyb.

**Ručně na zařízení** (simulátor tohle neověří):

1. Tažení prstem v obou polích, včetně pomalého ladění po půl kilu a rychlého přejezdu.
2. Vlastní trénink celý od spuštění po „Hotovo!", včetně pauzy a šipek.
3. Kardio cvik — start, pauza, doběhnutí do nuly, haptika.
4. Spuštění tréninku z hodinek při běžící appce v telefonu (nejčastější případ).
5. Spuštění z hodinek při zavřené appce — musí přijít „Otevři Pumplo v telefonu", ne ticho.
6. Spuštění z hodinek mimo dosah telefonu — musí přijít „Telefon není v dosahu".
7. Regrese: plánový trénink se po přepsání na sdílený hook chová přesně jako dnes, včetně třinácti scénářů z tasku 10 plánu B.

---

## Rizika

- **Nakopnutí telefonu na pozadí je nespolehlivé** a vědomě to přiznáváme hláškou. Kdyby se ukázalo, že to selhává i při běžící appce, je to signál, že problém je jinde než v návrhu, a je potřeba měřit, kam až zpráva doletí.
- **Svislé tažení versus systémová gesta** — ověřit na zápěstí, ne v simulátoru.
- **Dvě cesty do jednoho hooku** (`WorkoutSession` a `CustomWorkoutPlayer` mají jinak stavěné stavy) svádí k tomu udělat z hooku další místo s tréninkovou logikou. Hook nesmí vědět nic o cvicích — jen bere hotový stav a předává akce.
- **Změny jdou do nativního buildu 1.2.3**, viz `~/Vaults/pumplo/provoz/build-1.2.3-fronta.md`. Web sám o sobě nic nedoručí.
