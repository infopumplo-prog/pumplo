# Wear OS — testovací runbook (emulátor ↔ emulátor)

**Datum:** 2026-07-25 · **Platí pro:** `android/wear` (modul `:wear`) + `WatchWorkoutPlugin` v `:app`

Fyzické Wear OS zařízení nemáme, takže vše se testuje na dvojici emulátorů.

> **Stav ověření (2026-07-25):** V tomto prostředí není žádný Wear OS AVD a chybí `sdkmanager` na jeho vytvoření, takže krok 1 (jednorázová příprava) a plná E2E sada (sekce 5) jsou zatím **David's manual prerequisite** — viz značky 👤 níže. Vše ostatní (prostředí, telefonní instalace, gradle tasky, cesty k APK, log tagy, drátové konstanty) bylo ověřeno přímo v tomto repu na existujícím telefonním emulátoru — viz sekce "Co bylo ověřeno" na konci dokumentu.

## 0. Prostředí

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$HOME/Library/Android/sdk/platform-tools:$HOME/Library/Android/sdk/emulator:$PATH"
```

## 1. Jednorázová příprava 👤 (David, manuálně v Android Studiu)

1. Android Studio → Device Manager → Create Device → **Wear OS Large Round**, image API 34 (x86_64), název `Wear_OS_Large_Round_API_34`.
2. Telefonní AVD musí být **google_apis_playstore** (kvůli appce Wear OS) — existující `Medium_Phone…` to splňuje.
3. Přihlásit testovací účet na obou emulátorech (Google login) — bez toho párování Wear OS appky selže. Přihlašovací údaje dodá David.

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

## 5. E2E scénáře 👤 (vyžaduje spárovaný Wear AVD z kroku 1 + testovací účet — spustit po přípravě)

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

---

## Co bylo ověřeno (2026-07-25, bez Wear AVD)

Toto prostředí nemá Wear OS AVD ani `sdkmanager` na jeho vytvoření — sekce 1 a 5 čekají na Davida (👤 výše). Vše, co šlo ověřit bez hodinek, bylo skutečně spuštěno v tomto repu (branch `feat/watch-plan-c`), ne jen odvozeno z kódu:

- **Prostředí (sekce 0):** export `JAVA_HOME`/`PATH` funguje, `java -version` hlásí OpenJDK 21, `adb`/`emulator` jsou na PATH. Existující telefonní AVD `Medium_Phone_API_36.1` byl již spuštěný jako `emulator-5554`.
- **Gradle tasky (sekce 3):** `./gradlew :app:tasks :wear:tasks --all` potvrzuje, že `installDebug` existuje pro `:app` i `:wear` a `assembleDebug` pro `:wear`.
- **Instalace na telefon:** `ANDROID_SERIAL=emulator-5554 ./gradlew :app:installDebug` proběhlo se `BUILD SUCCESSFUL`, appka reálně nainstalována na `Medium_Phone_API_36.1(AVD)`.
- **Build hodinkové appky:** `./gradlew :wear:assembleDebug` proběhlo se `BUILD SUCCESSFUL`; APK skutečně existuje na cestě `wear/build/outputs/apk/debug/wear-debug.apk` — přesně jak uvádí runbook v sekci 3.
- **`applicationId`:** `app/build.gradle` i `wear/build.gradle` mají shodně `applicationId "com.pumplo.app"` — potvrzuje varování v sekci 3 o riziku přepsání appky.
- **Log tagy (sekce 4):** `PumploWatch` je skutečný `TAG` v `WatchWorkoutPlugin.java` (telefon), `PumploWear` je skutečný `TAG` v `WearableRepository.kt` (hodinky) — filtry v logcat příkazech odpovídají kódu.
- **Drátové konstanty:** `STATE_PATH` (`/pumplo/workout-state`), `ACTION_PATH` (`/pumplo/action`), `KEY_JSON`, `KEY_UPDATED_AT` se shodují mezi `app/src/main/java/com/pumplo/app/{WatchStateBridge,WatchActionCodec}.java` a `wear/src/main/java/com/pumplo/wear/WatchAction.kt` — Data Layer cesty použité v troubleshootingu (sekce 6) jsou reálné.
- **Build příkazy appky (sekce 3):** `npm run build` (`vite build` dle `package.json`) a `npx cap sync android` jsou existující, spustitelné příkazy v tomto repu.

**Zůstává manuální (David):**
- Vytvoření `Wear_OS_Large_Round_API_34` AVD v Android Studiu (sekce 1, bod 1) — v tomto prostředí chybí `sdkmanager`/Device Manager GUI přístup pro automatizované vytvoření.
- Přihlášení testovacího Google účtu na obou emulátorech (sekce 1, bod 3) — čeká na přihlašovací údaje.
- Párování telefon ↔ hodinky (sekce 2) a celý průchod scénářů 1–12 (sekce 5) — vyžaduje výše uvedené dva kroky a reálně běžící Wear AVD, což v tomto prostředí není k dispozici.

Po vytvoření AVD a přihlášení účtu stačí projít tento dokument od sekce 2 dál a odškrtat scénáře v sekci 5 — žádné další nastavení není potřeba.
