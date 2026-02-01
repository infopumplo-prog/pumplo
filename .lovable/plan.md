
# Oprava bugu: Den C se zobrazuje přestože plán má jen A/B

## Identifikace problému

### Co vidíš
Na domovské stránce se zobrazují 4 tréninky:
- **Neděle: Den C** (dnešek)
- Pondělí: Horní tělo (A)
- Středa: Dolní tělo (B)
- **Pátek: Den C**

### Proč je to špatně
Tvůj plán má **Upper/Lower split** s pouze **2 unikátními dny** (A a B). Den C vůbec nemá žádné cviky!

### Příčina v kódu

V souboru `src/hooks/useWorkoutPlan.ts` na řádku 88:

```typescript
const dayCount = (planData.training_goals as any)?.day_count || 2;
```

Tento kód bere `day_count` z tabulky `training_goals`:

| Cíl | day_count |
|-----|-----------|
| muscle_gain | **3** (PPL) |
| fat_loss | 2 |
| strength | 2 |
| general_fitness | 2 |

Tvůj cíl je `muscle_gain` → systém myslí že máš **3 dny** (A, B, C), i když reálně máš jen 2.

### Proč se to stalo
Historicky `day_count` v `training_goals` definovalo počet dnů podle cíle. Ale po změně metodiky (split podle frekvence, ne podle cíle) toto už neplatí.

---

## Řešení

### Změna 1: Spočítat skutečný `dayCount` z cviků v plánu

Místo brát hodnotu z `training_goals`, spočítat unikátní dny přímo z cviků:

```typescript
// Starý kód (špatně):
const dayCount = (planData.training_goals as any)?.day_count || 2;

// Nový kód (správně):
// Počet unikátních dnů = počet unikátních day_letter v cvicích
const uniqueDayLetters = new Set(
  (exercisesData || []).map(e => e.day_letter)
);
const dayCount = uniqueDayLetters.size || 2;
```

### Změna 2: Přesunout výpočet za načtení cviků

Protože potřebujeme `exercisesData` pro výpočet, musíme přesunout `dayCount` výpočet za řádek 110 (po načtení cviků).

### Změna 3: Update interface

V `WorkoutPlanData` už je `dayCount` - ten teď bude reflektovat skutečný počet dnů z cviků.

---

## Technické změny

| Soubor | Změna |
|--------|-------|
| `src/hooks/useWorkoutPlan.ts` | Spočítat `dayCount` z unikátních `day_letter` v cvicích místo z `training_goals.day_count` |

---

## Proč je toto správné řešení

1. **Konzistence** - `dayCount` odpovídá skutečné struktuře plánu
2. **Bez databázových změn** - není potřeba měnit `training_goals` tabulku
3. **Retroaktivní oprava** - funguje i pro existující plány bez `split_type`
4. **Jednoduchý fix** - jedna změna v jednom souboru

Po této opravě:
- Tvůj plán s 4 tréninkovými dny bude rotovat A → B → A → B
- Den C se nebude zobrazovat
- Názvy dnů "Horní tělo" a "Dolní tělo" budou správně přiřazeny
