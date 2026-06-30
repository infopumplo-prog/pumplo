# Workout Player — 3 úpravy (design)

**Datum:** 2026-06-30
**Kontext:** Feedback z cvičení (David + Head of Training Benda) k in-session tréninkovému playeru. Tři nezávislé změny chování. Velký Benda feedback k vlastnímu tréninku je samostatná pozdější iterace.

## Cíle

1. Zobrazit další cvik už během poslední série aktuálního cviku.
2. Upozornění na konec pauzy musí být postřehnutelné i při zamčené obrazovce / telefonu na tichu.
3. Aplikace se nikdy neotáčí na šířku — zámek na portrait.

---

## 1. Další cvik u poslední série

**Chování:** Na obrazovce cviku (`ExercisePlayer`), když je aktuální série poslední (`currentSet + 1 === totalSets`), se zobrazí decentní prvek:
- text **„Další: [název cviku]"**
- **mini smyčka videa** dalšího cviku (muted, loop, playsInline) v rohu

**Edge case:** Pokud je aktuální cvik poslední v tréninku (žádný další neexistuje), prvek se nezobrazí. (Volitelně místo toho „Poslední cvik 💪" — finální podoba se doladí při implementaci, default je nezobrazit nic.)

**Datový tok:**
- `WorkoutSession` už dnes zná další cvik a počítá `nextVideoUrl` (řádky ~129–149). Stejnou logiku (název + signed video URL dalšího cviku) předá jako nové props do `ExercisePlayer`.
- `ExercisePlayer` zobrazí prvek pouze na poslední sérii.

**Dotčené soubory:** `src/components/workout/WorkoutSession.tsx`, `src/components/workout/ExercisePlayer.tsx`.

**Mimo rozsah:** Prvek se nepřidává do mezisériové pauzy ani do mezicvikové pauzy (ta už další cvik ukazuje). Týká se jen obrazovky aktivní poslední série.

## 2. Zvuk/upozornění pauzy při zamčené obrazovce

**Současný stav:** `RestTimer` přehrává odpočet 3-2-1 + alarm přes web audio, když je app v popředí (funguje). Při zamčené obrazovce app běží na pozadí → web audio je pozastavené → spoléhá se na lokální notifikaci (`restNotification.ts`) se zvukem `rest_beep.wav`.

**Problém:** Soubor `rest_beep.wav` je validní a v bundlu obou platforem (iOS 0,88 s / 44,1 kHz PCM, Android `res/raw/`). Při zamčené obrazovce ale notifikace často přijde **bez zvuku**, protože iOS potlačuje zvuk notifikací při zapnutém tichém režimu (boční vypínač) — typický stav telefonu v posilovně. Přebít to umí jen Critical Alert (vyžaduje schválení Apple) — mimo rozsah.

**Řešení:** K rest-end notifikaci přidat:
- **vibraci** — je cítit i při ztlumeném zvonku (default „Vibrate on Silent"),
- **Time-Sensitive interruption level** — prorazí Focus/DND/Scheduled Summary (bez speciálního schválení Apple).

Beep (`rest_beep.wav`) zůstává a zazní, když telefon na tichu není.

**Dotčené soubory:** `src/lib/restNotification.ts` (přidat vibraci + interruption level do `LocalNotifications.schedule`). Ověřit/nastavit Android notifikační kanál na HIGH importance s vibrací.

**Mimo rozsah:** Critical Alerts entitlement (samostatná pozdější žádost u Apple, pokud bude potřeba garantovaný zvuk přes ticho).

## 3. Zámek orientace na portrait

**Současný stav:** iOS `Info.plist` povoluje Portrait + LandscapeLeft/Right (iPad i Portrait Upside Down). Android `MainActivity` nemá `android:screenOrientation`, takže se otáčí.

**Řešení:**
- iOS `ios/App/App/Info.plist`: `UISupportedInterfaceOrientations` i `UISupportedInterfaceOrientations~ipad` nechat **jen** `UIInterfaceOrientationPortrait`.
- Android `android/app/src/main/AndroidManifest.xml`: na `MainActivity` přidat `android:screenOrientation="portrait"`.

**Rozhodnutí:** Portrait-only platí i pro iPad (záměrně, dle „nikdy").

**Dotčené soubory:** `ios/App/App/Info.plist`, `android/app/src/main/AndroidManifest.xml`.

---

## Testování

- **Bod 1:** Projít cvik s více sériemi → na poslední sérii se objeví název + mini video dalšího cviku; na neposlední sériích ne; u posledního cviku tréninku se prvek neukáže.
- **Bod 2:** Zamknout obrazovku během pauzy → při ztlumeném telefonu to zavibruje; při zvonku zazní beep; v režimu Focus notifikace prorazí. iOS + Android.
- **Bod 3:** Otáčet telefonem na všech klíčových obrazovkách (home, trénink, player, pauza) → zůstane na výšku. iPhone + iPad, iOS + Android.

## Release

Po implementaci: `npm run build` → `npx cap sync ios android` → bump verze → nativní buildy. Tyto změny jdou do dalšího store updatu (ne do dnešního 1.2.1, pokud se 1.2.1 odešle dřív).
