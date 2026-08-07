# F12 FÁZE 3 — Hevy „Log Workout": průběh vlastního tréninku (2026-07-07)

Zdroj: Davidovy screenshoty Hevy (Log Workout). Navazuje na P1+P2 (ExercisePicker, set typy, rest timer — commity 23c5747, 0764c34).

## Log Workout obrazovka (přepracovat CustomWorkoutPlayer do Hevy layoutu)
- Hlavička: šipka dolů (minimalizovat = pokračuje na pozadí, návrat přes kartu na Home), název, ikona budíku (rest timer nastavení), **Dokončit** (primární)
- Stats řádek nahoře: **Doba** (live), **Objem (kg)** = Σ váha×opak. dokončených sérií, **Série** = počet dokončených; vpravo mini postavy = klik otevře **Muscle Distribution** sheet
- Muscle Distribution bottom sheet: přehled „Sval | Dokončené série" (primární sval = 1, sekundární = 0,5) + zvýraznění svalů (máme primary/secondary_muscles; postavičky = jednoduchý barevný seznam, obrázek těla volitelně později)
- Seznam cviků pod sebou (scroll), každý: video thumb + název (klik = info drawer s naším videem), poznámka input, Rest Timer řádek, tabulka: SÉRIE | MINULE (hodnota z posledního odcvičení stejného cviku z workout_session_sets, jinak „–") | KG | OPAK. | ✓
- **✓ checkbox dokončí sérii** → řádek zezelená; po dokončení série s rest timerem se dole ukáže **sticky rest bar**: countdown + „−15 s | +15 s | Přeskočit" (jako Hevy), nepřekrývá obsah přes celou obrazovku
- + Přidat sérii, + Přidat cvik (picker z P1) — vše dostupné za běhu
- **Dokončit** → uloží workout_session + sets (existující cesta, W série označit, nepočítat do total_sets/volume), pak souhrn jak má Pumplo
- Vše v Pumplo design systému; W/F/D badge z P2 zachovat; offline fronta z F1 platí i tady

## Kvalita
tsc + build čisté, žádný cap sync, nic necommitovat, Pumplo generovaný plán nedotčen. Summary přes SendMessage na "main".
