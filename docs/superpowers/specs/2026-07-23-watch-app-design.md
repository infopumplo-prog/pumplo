# Pumplo Watch App — Design Spec

**Date:** 2026-07-23 · **Status:** Draft for review · **Platforms:** Apple Watch (watchOS) + Wear OS (Android)

## Goal
Ovládat běžící Pumplo trénink ze zápěstí (parita s Hevy): vidět aktuální cvik, sérii, cílová opakování + RIR, odškrtnout sérii, zadat váhu/opakování, pauza s haptikou. Motivace: členi Eurogymu chtějí Pumplem nahradit Hevy.

## Scope
**v1 (tato spec):** telefon je „vzhůru" (opřený u stroje, web žije = zdroj pravdy), hodinky = plnohodnotný druhý ovladač v reálném čase. **Obě platformy** — Apple Watch (SwiftUI) i Wear OS (Kotlin/Compose).
**v2 (později):** nezávislý režim se zhasnutým telefonem (přesun session do nativu), tepovka (HealthKit / Health Connect) do statistik, zápis tréninku do Apple Fitness / Google Fit.

## Architektura
Sdílené napříč platformami:
- **Web (React) = zdroj pravdy.** Na každou změnu tréninku sestaví `WatchWorkoutState` (snapshot) a předá ho pluginu. Akce z hodinek přijímá zpět a volá STÁVAJÍCÍ handlery (`handleCompactCompleteSet`, `handleRestComplete`/skip) — tytéž, co dnes zpracovávají události ze zamčené obrazovky. Znovupoužijeme i replay/drain frontu (`consumePendingEvents`), která už řeší uspaný webview.
- **Capacitor plugin `WatchWorkout`** — jednotné JS API, dvě nativní implementace:
  - **iOS (Swift):** `WCSession` (WatchConnectivity). `updateApplicationContext` pro nejnovější stav, `sendMessage` pro urgentní (start pauzy). Vzor už známe z `RestActivityPlugin`.
  - **Android (Kotlin):** Wearable Data Layer — `DataClient` (stav) + `MessageClient` (akce/urgentní).
- **Watch appy** — dvě nativní, sdílejí UX i datový kontrakt:
  - **watchOS:** SwiftUI target v `ios/App`. Digital Crown pro spinnery.
  - **Wear OS:** nový Android modul (`wear/`), Jetpack Compose for Wear. Rotary input (korunka/bezel) pro spinnery.

### Datový model
`WatchWorkoutState` (web → hodinky):
`exerciseName`, `slotCategory` (Hlavní/Pomocný/…), `setIndex`, `totalSets`, `targetWeight`, `targetReps`, `repMin`, `repMax`, `rir`, `prevWeight`, `prevReps`, `weightStep` (0.5), `resting` (bool), `restEndsAt` (epoch ms), `nextSetLabel`, `phase` (`set`|`rest`|`between`|`summary`|`idle`).

Akce (hodinky → web):
`logSet{weight,reps}`, `goPrevSet`, `goNextSet`, `skipRest`, `addRest15`.

### UI (viz mockup `~/Desktop/pumplo-watch-mockup.png`)
- **Aktivní série:** název cviku · „slot · série X z Y" · dvě spinner pole **KG** (krok 0,5) a **OPAK.** (krok 1), předvyplněná z cíle/minula, aktivní pole s cyan rámečkem ovládá korunka; ťuk přepíná pole · „Cíl 8–12 · RIR 2" · „Naposledy: 37,5 kg × 10" · dole ‹ ✓ ›.
- **Pauza:** kruhový odpočet + haptika (tik na 3/2/1, náraz na 0), „Pauza · pak N. série", tlačítka +15 s / Přeskočit.
- **Okraje:** start tréninku (tlačítko Začít / čekání na telefon), přechod mezi cviky (auto), souhrn (hotovo).
- Brand: navy `#0B1222`, cyan `#4CC9FF`, Nunito/system bold.

### Tok dat
1. Web workout se změní → `WatchWorkout.updateState(snapshot)` → plugin → transport → hodinky překreslí.
2. Uživatel na hodinkách zapíše sérii → akce → transport → plugin vyšle JS event → web zavolá `handleCompactCompleteSet(weight,reps)` → stav se změní → nový snapshot zpět na hodinky (potvrzení + posun na pauzu/další sérii).
3. Pauza: web při startu pauzy pošle `resting=true,restEndsAt` → hodinky odpočítávají lokálně (plynulé i při krátkém výpadku spojení), haptika lokálně. Skip/+15 z hodinek → web.

## Testování
- **Apple Watch:** fyzické hodinky Davida (párované s iPhonem) + watchOS simulátor v Xcode (spárovaný s iOS simulátorem).
- **Wear OS:** emulátor v Android Studiu (Wear OS AVD) spárovaný s Android emulátorem telefonu (fyzické Wear OS zařízení nemáme). Pozn.: párování emulátor-emulátor přes ADB.

## Rizika / poznámky
- WatchConnectivity i Data Layer umí být „líné" při uspaném telefonu — v1 to obcházíme tím, že telefon je vzhůru; přesto stav posílat idempotentně (nejnovější snapshot vždy přebije).
- Zadávání váhy/opak. na hodinkách = spinner s krokem 0,5/1, předvyplněno (nejmenší tření v posilovně).
- Capacitor plugin musí fungovat i když watch app není spuštěná (no-op), stejně jako Live Activity plugin.
- Wear OS modul = první Android nativní modul projektu → nastavit Gradle, Wearable dependency, párovací capability.

## Build / packaging
- iOS: nový watchOS App target + (volitelně) Widget/Complication; sdílený App Group pro data mezi iOS appkou a watch appkou; capability WatchConnectivity.
- Android: nový `wear` modul v Gradle; `com.google.android.gms:play-services-wearable`; shared path pro Data Layer; capability v manifestu.
- Capacitor: `WatchWorkout` plugin (iOS Swift + Android Kotlin) registrovaný přes `registerPlugin`.
