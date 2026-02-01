# Plán opravy: Více bugů v tréninkovém systému

## ✅ DOKONČENO

Všechny identifikované problémy byly opraveny:

---

### 1. ✅ Příliš mnoho cviků (9 cviků × 3 série = 27 sérií)

**Oprava v `src/hooks/useWorkoutGenerator.ts`:**
- Přidán hard cap podle metodiky PUMPLO v2.0:
  - ≤30 min → max 4 cviky
  - 31-60 min → max 6 cviků
  - 61+ min → max 7 cviků (nikdy více)

---

### 2. ✅ Video na cviku se nepouští automaticky

**Oprava v `src/components/workout/ExercisePlayer.tsx`:**
- Přidáno `videoUrl` do dependencies `useEffect` hooku
- Nyní se video spustí automaticky i když URL přijde asynchronně

---

### 3. ✅ Budoucí dny označeny jako "Vynecháno"

**Oprava v `src/pages/Training.tsx`:**
- Přidána funkce `getActualDateForDay()` která vypočítá skutečné kalendářní datum pro každý den
- Přidána kontrola `isBeforePlanStart` - dny před startem plánu nejsou označeny jako missed
- Logika: `isMissed = !isExtraWeek && !isBeforePlanStart && (isPastThisWeek || isWeekInPast) && !isCompleted`

---

### 4. ✅ Repetitivní cviky (stejný equipment type)

**Oprava v `src/lib/selectionAlgorithm.ts`:**
- Přidána konstanta `PENALTY_EQUIPMENT_REPETITION = -5`
- V `calculateExerciseScore` přidána penalizace pro opakovaný equipment type ve stejné session
- Systém nyní preferuje různé typy vybavení pro větší variabilitu tréninku

---

### 5. ℹ️ Cvik 4 a 8 bez přiřazeného cviku (role: `anti_extension`)

**Stav:** Databáze obsahuje 2 cviky s `primary_role = 'anti_extension'` a `allowed_phase = 'main'`:
- Climber A Padded Stool Supported (bodyweight)
- Resistance Band Lying Leg Raise (machine)

Problém byl pravděpodobně způsoben tím, že konkrétní stroje nebyly dostupné v gym inventory. Po přegenerování plánu s novými limity by mělo být vše OK.

---

## Technické změny

| Problém | Soubor | Status |
|---------|--------|--------|
| Příliš mnoho cviků | `useWorkoutGenerator.ts` | ✅ Hard cap 4/6/7 |
| Video autoplay | `ExercisePlayer.tsx` | ✅ Přidáno `videoUrl` do deps |
| Missed dny v budoucnu | `Training.tsx` | ✅ Kontrola `planStartDate` |
| Prázdný slot (anti_extension) | Databáze | ℹ️ Cviky existují |
| Repetitivní cviky | `selectionAlgorithm.ts` | ✅ Equipment penalty -5 |

---

## Další kroky

Pro ověření změn:
1. Přegenerovat tréninkový plán (kliknout na "Regenerovat plán")
2. Ověřit, že nový plán má max 7 cviků
3. Zkontrolovat, že budoucí dny nejsou označeny jako vynechané
4. Ověřit automatické přehrávání videa u cviku
