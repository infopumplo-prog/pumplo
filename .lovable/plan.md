
# Plán opravy: Problémy s počtem cviků a zobrazením dnů

## ✅ IMPLEMENTOVÁNO

### Oprava 1: Logika `isMissed` používá skutečná kalendářní data
**Soubor:** `src/pages/Training.tsx` (řádky 517-530)

Změněno z:
```typescript
const isMissed = !isExtraWeek && !isBeforePlanStart && (isPastThisWeek || isWeekInPast) && !isCompleted;
```

Na:
```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);
const isActuallyInPast = actualDate && actualDate < today;
const isMissed = !isExtraWeek && isActuallyInPast && !isBeforePlanStart && !isCompleted;
```

Nyní se den označí jako "Vynechaný" pouze pokud:
1. Není v extra týdnu (přesunuté dny)
2. Jeho skutečné kalendářní datum je v MINULOSTI
3. Není před datem zahájení plánu
4. Není již dokončený

### Oprava 2: Upozornění a tlačítko regenerace
**Soubor:** `src/pages/Training.tsx` (řádky 1583-1625)

Přidáno upozornění které se zobrazí když plán obsahuje více než 7 cviků na den:
- Žluté upozornění s ikonou AlertTriangle
- Text vysvětlující problém
- Tlačítko "Regenerovat plán" které spustí `handleRegeneratePlan()`

---

## Jak ověřit opravy

1. **Budoucí dny** - Po refreshu by dny jako Po, Út (které ještě nenastaly) měly být šedé (neutrální), ne červené
2. **Regenerace** - Pokud plán má 9 cviků, zobrazí se žlutý banner s tlačítkem regenerace
3. **Po regeneraci** - Nový plán bude mít max 7 cviků díky hard capu v `useWorkoutGenerator.ts`

---

## Poznámka

Refresh stránky **NENAČTE** nový počet cviků, protože cviky jsou uloženy v databázi. 
Uživatel musí **REGENEROVAT PLÁN** kliknutím na tlačítko, aby se uplatnily nové limity.
