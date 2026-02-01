
# Plán oprav: Nesoulad dnů A/B, Rozcvičkové cviky se strojem, UI tlačítko

## Identifikované problémy

### 1. Nesoulad dnů A/B mezi stránkami

**Screenshot z Home:** Neděle = **B** (Dolní tělo)
**Screenshot z Training týden 1:** Neděle = **A** (Horní tělo)
**Screenshot z Training týden 2:** Pondělí = **B** (Dolní tělo)

**Příčina:**
- V `Home.tsx` (řádek 60-62) se používá **adjustedDisplayIndex** který odečítá 1 od `currentDayIndex` pokud uživatel dnes dokončil trénink
- V `Training.tsx` se používá **jiná logika** pro výpočet týdnů a dnů
- Obě stránky volají `getTrainingSchedule()`, ale s **různými indexy**

**Řešení:**
- Sjednotit logiku rotace - obě stránky musí používat `plan.currentDayIndex` přímo z hooku `useWorkoutPlan`
- Odstranit ruční úpravy indexu v Home.tsx

---

### 2. Rozcvičkové cviky používají stroje

**Screenshot:** "Ski Ergometer Cross Country Ski Kneeling Reverse Fly Pull" v rozcvičce

**Data z databáze:**
- V tabulce `exercises` s `allowed_phase = 'warmup'` je **50 cviků se strojem** (`machine_id IS NOT NULL`)
- Celkem 216 warmup cviků, z toho 166 je bez stroje

**Příčina:**
V `generateWarmupExercises` (Training.tsx, řádky 821-824):
```typescript
const { data: warmupExercisesData } = await supabase
  .from('exercises')
  .select('id, name, primary_muscles, video_path')
  .eq('allowed_phase', 'warmup');
  // ← CHYBÍ filtrování na machine_id IS NULL!
```

**Řešení:**
```typescript
const { data: warmupExercisesData } = await supabase
  .from('exercises')
  .select('id, name, primary_muscles, video_path')
  .eq('allowed_phase', 'warmup')
  .is('machine_id', null); // Pouze cviky bez vybavení/stroje
```

---

### 3. Tlačítko "Další cvik" je zbytečné na posledním cviku rozcvičky

**Screenshot:** Poslední cvik (5/5) má tlačítka "Pauza" + "Další cvik" + "Spustit trénink" (3 tlačítka!)

**Problém v `WarmupPlayer.tsx` (řádky 255-275):**
```tsx
// Vždy se zobrazuje "Další cvik"
<Button onClick={handleSkipExercise}>
  <SkipForward /> Další cvik
</Button>

// Na posledním cviku se přidá DALŠÍ tlačítko "Spustit trénink"
{currentIndex === exercises.length - 1 && (
  <Button onClick={onComplete}>
    <ChevronRight /> Spustit trénink
  </Button>
)}
```

**Řešení:**
Místo přidávání třetího tlačítka **nahradit** "Další cvik" za "Spustit trénink" na posledním cviku:
```tsx
{currentIndex < exercises.length - 1 ? (
  <Button onClick={handleSkipExercise}>
    <SkipForward /> Další cvik
  </Button>
) : (
  <Button onClick={onComplete}>
    <ChevronRight /> Spustit trénink
  </Button>
)}
```

---

## Technické změny

| Soubor | Změna |
|--------|-------|
| `src/pages/Home.tsx` | Odstranit `adjustedDisplayIndex` a použít přímo `plan.currentDayIndex` pro konzistenci s Training.tsx |
| `src/pages/Training.tsx` | Přidat `.is('machine_id', null)` do query pro warmup cviky |
| `src/components/workout/WarmupPlayer.tsx` | Nahradit "Další cvik" za "Spustit trénink" na posledním cviku místo přidávání třetího tlačítka |

---

## Očekávaný výsledek

1. **Konzistentní dny A/B** - Home i Training stránka zobrazí stejné přiřazení dnů
2. **Rozcvička bez strojů** - pouze bodyweight cviky pro warmup
3. **Čisté UI** - 2 tlačítka: Pauza + (Další cvik NEBO Spustit trénink)
