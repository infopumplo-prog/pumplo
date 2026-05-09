# Pumplo — Pre-launch Testing Checklist

## Co jde měnit bez app update (okamžitě přes Supabase)
| Obsah | Kde |
|---|---|
| Videa cviků | Supabase Storage → `exercise-videos` bucket |
| Názvy a popisy cviků | Supabase DB → tabulka `exercises` |
| Názvy strojů | Supabase DB → tabulka `machines` |
| Tréninkové plány a dny | Supabase DB |
| QR kódy (po launch) | Supabase DB |
| Fotky posiloven | Supabase Storage → `gym-assets` bucket |

## Co vyžaduje nový build + store submission
- Texty v UI (i18n překlady, hardcoded labels)
- Opravy bugů v kódu
- UI/layout změny

---

## Android (Motorola) → Google Play

### Registrace & onboarding
- [ ] Otevřít appku poprvé — zobrazí se onboarding
- [ ] Projít onboarding celý (level, dny, čas, zranění, equipment)
- [ ] Registrace e-mailem + heslem
- [ ] Google login
- [ ] Po registraci — přesměrování na Home, ne zpět na onboarding

### QR kód flow
- [ ] Naskenovat QR kód stanice (Eurogym)
- [ ] Zobrazí se CTA / přihlašovací stránka
- [ ] Registrace přes QR — gym se předvyplní automaticky
- [ ] Po registraci — žádný krok výběru gymu v onboardingu
- [ ] Back button během onboardingu po QR — přeskočí gym krok

### Home screen
- [ ] Workout karty mají anglické názvy dnů (Full body A, Push, Pull, Legs, Rest)
- [ ] Žádný český text viditelný pokud je jazyk EN
- [ ] Zobrazí se správný dnešní den
- [ ] Tlačítko "Start workout" → GymSelector se otevře a zakryje celou obrazovku (bez BottomNav)

### MyPlan
- [ ] Zobrazí se tréninkový plán
- [ ] Názvy dnů v angličtině (Full body, Push/Pull/Legs, Upper/Lower)
- [ ] Kliknutí na den → přechod na Station

### Station / Video přehrávač
- [ ] Video se přehraje automaticky a loopuje
- [ ] Název stroje v angličtině
- [ ] Info overlay se otevře tapnutím na `i`
- [ ] Info overlay scrolluje (header zůstane nahoře, obsah scrolluje)
- [ ] Muscle names v angličtině (Back, Glutes, Quadriceps…)
- [ ] Cvičení jsou anglicky pojmenovaná
- [ ] Přepínání mezi cviky funguje

### Workout session
- [ ] Spustit trénink — timer běží
- [ ] Logování sérií (váha + reps)
- [ ] Dokončení tréninku — zobrazí se summary
- [ ] Home screen po dokončení — zelená karta "dnes dokončeno"
- [ ] Beep zvuky při odpočtu fungují
- [ ] Pokud hraje hudba (Spotify) — app ji NEPŘERUŠÍ při startu tréninku

### Obecné
- [ ] Přepnutí jazyka CZ ↔ EN — vše se přepne
- [ ] Žádné crashes při normálním použití
- [ ] Profil se správně zobrazuje

---

## iOS (iPhone) → App Store

Stejný checklist výše + navíc:

- [ ] Google login na iOS
- [ ] Hudba z Spotify/Apple Music se NEPŘERUŠÍ při otevření appky ani při startu tréninku
- [ ] GymSelector zakryje celou obrazovku vč. BottomNav
- [ ] StatusBar (tmavá) — nevyčnívá přes UI
- [ ] Safe area (notch/Dynamic Island) — nic není oříznuté nahoře ani dole
- [ ] Back gestura (swipe zprava) funguje správně v celé appce
- [ ] Video přehrávač funguje (autoplay, loop, bez zvuku)

---

## Známé limitace při launchi (opravit v další verzi)
- Pomalé načítání videí — způsobeno velikostí souborů, ne kódem; řešení: ffmpeg komprese (`-crf 28`)
- Pomalé načítání fotek posiloven — Supabase Storage latency při prvním načtení
