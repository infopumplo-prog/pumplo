
# Plán opravy: Více bugů v tréninkovém systému

## Nalezené problémy

Po analýze kódu a databáze jsem identifikoval tyto problémy:

---

### 1. Cvik 4 a 8 bez přiřazeného cviku (role: `anti_extension`)

**Příčina:** V databázi pro plán `9be41ad6-df6e-4bdf-a04f-ca18898a77a3` vidím:
- slot 4: `exercise_id = null`, `role_id = anti_extension`
- slot 8: `exercise_id = null`, `role_id = anti_extension`

Generátor nenašel žádný vhodný cvik pro roli `anti_extension` v posilovně a slot zůstal prázdný.

**Oprava:**
1. Zkontrolovat, zda existují cviky s `primary_role = 'anti_extension'` a `allowed_phase = 'main'`
2. Pokud ne - přidat je do databáze cviků NEBO vytvořit fallback
3. Upravit UI, aby prázdné sloty nezobrazovalo jako "Cvik" bez názvu

---

### 2. Příliš mnoho cviků (9 cviků × 3 série = 27 sérií)

**Příčina:** Pro Full Body template existují pouze 4 sloty (squat, horizontal_push, horizontal_pull, anti_extension), ale `calculateSlotsForDuration` s 75 min délkou rozšiřuje na 9 cviků.

Podle metodiky PUMPLO v2.0:
- **30 min**: max 4 cviky
- **45-60 min**: max 6 cviků
- **90-120 min**: max 7 cviků

Aktuální vzorec:
```
availableMinutes = 75 - 4 + 3 = 74 min
targetExerciseCount = 74 / 8 = 9 cviků  ← PŘÍLIŠ MNOHO
```

**Oprava:** Upravit `calculateSlotsForDuration` v `useWorkoutGenerator.ts`:
- Přidat hard cap podle metodiky:
  - ≤30 min → max 4
  - 31-60 min → max 6
  - 61-90 min → max 7
  - >90 min → max 7 (stejné)

---

### 3. Rozcvička na nohy při tréninku upper body

**Příčina:** Logika `generateWarmupExercises` vybírá rozcvičky podle `primary_muscles` cviků v plánu. Problém je, že pro Full Body plán jsou v prvním cviku nohy (squat → front_thighs), takže rozcvička na nohy je správná!

ALE pokud uživatel má Upper/Lower split, tak pro den B (pouze upper body) by se neměly vybírat cviky na nohy.

**Ověření:** Uživatel má `general_fitness` cíl a 5 tréninkových dnů, což podle nové logiky `getSplitFromFrequency(5, 'beginner')` = **`upper_lower`** (bezpečnostní override), NE `full_body`.

**Problém v datech:** V databázi vidím `split_type = 'full_body'` ale uživatel má 5 tréninkových dnů! To je BUG - plán byl generován se špatným splitem.

**Oprava:**
- Ověřit, že `generateWorkoutPlan` správně používá `getSplitFromFrequency`
- Zajistit, že rozcvičky jsou relevantní pro aktuální den (A = push svaly, B = pull svaly, atd.)

---

### 4. Cvik 7 možná repetitivní (Kettlebell Single Arm Row vs předchozí)

**Příčina:** Algoritmus anti-repetition kontroluje pouze cviky ze 7 dnů zpět, ale ne duplikáty UVNITŘ stejného tréninku.

Z databáze vidím:
- Slot 3: `Kettlebell Single Arm Rear Delt Fly` (horizontal_pull)
- Slot 7: `Kettlebell Single Arm Row` (horizontal_pull)

Oboje jsou `horizontal_pull` role s kettlebell - podobné pohybové vzorce.

**Oprava:**
- V `getCandidates` přidat penalizaci pro stejný equipment_type již použitý ve stejné session
- Zajistit, že druhý výskyt role preferuje jiný equipment type

---

### 5. Video na cviku 9 se nepouští automaticky

**Příčina:** V `ExercisePlayer.tsx` je video element s `autoPlay` atributem, ale prohlížeč může blokovat autoplay pro neinteraktivní spuštění.

```tsx
<video
  ref={videoRef}
  src={videoUrl}
  loop
  muted
  autoPlay  // Toto by mělo fungovat, ale...
  playsInline
/>
```

**Možný problém:** Video URL se načítá asynchronně a video element se mountuje dříve než je URL dostupné.

**Oprava:**
- Přidat `useEffect` který explicitně volá `videoRef.current.play()` po načtení URL
- Zajistit, že video je `muted` (nutné pro autoplay)

Kód v `ExercisePlayer.tsx` řádky 65-74 už toto dělá:
```typescript
useEffect(() => {
  if (videoRef.current) {
    videoRef.current.muted = true;
    if (isPlaying && !showRestTimer) {
      videoRef.current.play().catch(() => {});
    }
  }
}, [isPlaying, showRestTimer]);
```

**Ale chybí závislost na `videoUrl`!** Když se URL změní, effect se nespustí.

---

### 6. Budoucí dny označeny jako "Vynecháno"

**Příčina:** Screenshot ukazuje Týden 2 s dny Po, Út, Pá, So jako "Vynecháno" (červeně) ale Ne jako "Dnes".

Logika v `daysInViewingWeek`:
```typescript
const isMissed = !isExtraWeek && (isPastThisWeek || isWeekInPast) && !isCompleted;
```

Problém: `isPastThisWeek` je definováno jako:
```typescript
const isPastThisWeek = !isExtraWeek && viewingWeek === currentWeek && dayOrderIndex < todayDayOrder;
```

Pokud dnes je **Neděle (index 6)**, pak Po (index 1), Út (index 2), Pá (index 5), So (index 6) jsou všechny `< 6`, takže jsou označeny jako zmeškané.

**Ale:** To je správná logika! Problém je, že systém nezná DATUM vytvoření plánu. Pokud plán začal dnes (neděle), tak Po, Út atd. v tomto týdnu ještě nenastaly!

**Skutečný bug:** Systém nekontroluje `plan.started_at` správně. Dny PŘED startem plánu by měly být `skipped` (neutrální), ne `missed`.

**Oprava:** Upravit logiku:
```typescript
// Dny před startem plánu = skipped (není missed)
const isBeforePlanStart = plan?.startedAt && new Date(session_date) < new Date(plan.startedAt);
const isMissed = !isExtraWeek && !isBeforePlanStart && (isPastThisWeek || isWeekInPast) && !isCompleted;
```

---

## Technické změny

### Soubor: `src/hooks/useWorkoutGenerator.ts`

1. Opravit `calculateSlotsForDuration` s hard caps podle metodiky:
```typescript
const calculateSlotsForDuration = (
  durationMinutes: number,
  templateSlots: DayTemplateSlot[],
  userLevel: UserLevel
): DayTemplateSlot[] => {
  // Hard caps from PUMPLO methodology v1.1
  let maxExercises: number;
  if (durationMinutes <= 30) maxExercises = 4;
  else if (durationMinutes <= 60) maxExercises = 6;
  else maxExercises = 7; // 61+ min
  
  // Calculate based on time
  const WARMUP_MINUTES = 4;
  const MINUTES_PER_EXERCISE = 8;
  const availableMinutes = durationMinutes - WARMUP_MINUTES;
  let targetExerciseCount = Math.floor(availableMinutes / MINUTES_PER_EXERCISE);
  
  // Apply caps
  const MIN_EXERCISES = 3;
  targetExerciseCount = Math.max(MIN_EXERCISES, Math.min(targetExerciseCount, maxExercises));
  
  // ... rest of logic
};
```

### Soubor: `src/components/workout/ExercisePlayer.tsx`

2. Opravit video autoplay dependency:
```typescript
useEffect(() => {
  if (videoRef.current && videoUrl) {
    videoRef.current.muted = true;
    if (isPlaying && !showRestTimer) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }
}, [isPlaying, showRestTimer, videoUrl]); // Přidat videoUrl
```

### Soubor: `src/pages/Training.tsx`

3. Opravit logiku missed dnů - kontrola data plánu:
```typescript
// V useMemo pro daysInViewingWeek, sekce ~480-496:

// Get the date for this specific day in this week
const getDateForDayInWeek = (weekNumber: number, dayOfWeek: string): Date => {
  if (!planStartDate) return new Date();
  const startWeekday = planStartDate.getDay(); // 0=Sunday
  const targetDayIndex = DAY_ORDER.indexOf(dayOfWeek) + 1; // 1=Monday
  
  // Calculate weeks difference
  const weeksDiff = weekNumber - 1;
  const daysDiff = (targetDayIndex - startWeekday + 7) % 7;
  
  const result = new Date(planStartDate);
  result.setDate(result.getDate() + weeksDiff * 7 + daysDiff);
  return result;
};

// Check if this day's date is before plan start
const dayDate = getDateForDayInWeek(viewingWeek, dayOfWeek);
const isBeforePlanStart = planStartDate && dayDate < planStartDate;

// Is this day missed? (past, not completed, not before plan start)
const isMissed = !isExtraWeek && !isBeforePlanStart && (isPastThisWeek || isWeekInPast) && !isCompleted;
```

### Databáze: Přidat cviky pro `anti_extension`

4. Ověřit existenci cviků:
```sql
SELECT COUNT(*) FROM exercises 
WHERE primary_role = 'anti_extension' AND allowed_phase = 'main';
```

Pokud je 0, přidat cviky jako:
- Dead Bug
- Plank
- Ab Wheel Rollout
- Pallof Press

### Soubor: `src/lib/selectionAlgorithm.ts`

5. Přidat equipment variety penalizaci pro opakovaný equipment v session:
```typescript
// V calculateExerciseScore, přidat:
const equipmentRepetitionPenalty = context.usedEquipmentTypes.has(exercise.equipment_type || 'bodyweight') 
  ? -5 : 0;
```

---

## Shrnutí změn

| Problém | Soubor | Změna |
|---------|--------|-------|
| Příliš mnoho cviků | `useWorkoutGenerator.ts` | Hard cap 4/6/7 podle délky |
| Video autoplay | `ExercisePlayer.tsx` | Přidat `videoUrl` do dependencies |
| Missed dny v budoucnu | `Training.tsx` | Kontrola `planStartDate` vs den v týdnu |
| Prázdný slot (anti_extension) | Databáze | Přidat cviky s `primary_role = 'anti_extension'` |
| Repetitivní cviky | `selectionAlgorithm.ts` | Equipment variety penalty |
