
# Oprava: Regenerace plánu s Upper/Lower splitem

## Příčina problému

Při regeneraci plánu se v `handleRegeneratePlan` (Training.tsx, řádky 368-375) volá:

```typescript
const planId = await generateWorkoutPlan(
  selectedGymId,
  mappedGoalId,
  profile.user_level as any,
  profile.injuries || [],
  profile.equipment_preference,
  durationMinutes
  // ← CHYBÍ 7. parametr: profile.training_days!
);
```

Funkce `generateWorkoutPlan` má na řádku 253:
```typescript
trainingDays: string[] = []  // Default prázdné pole
```

A pak na řádku 289:
```typescript
trainingDays.length > 0 ? trainingDays.length : 3  // Fallback na 3 dny
```

**Tvůj profil má 4+ tréninkové dny**, ale systém používá fallback 3 dny → `full_body` místo `upper_lower`.

---

## Řešení

Předat `profile.training_days` do `generateWorkoutPlan()` při regeneraci.

### Změna v Training.tsx (řádek 368-375)

**Před:**
```typescript
const planId = await generateWorkoutPlan(
  selectedGymId,
  mappedGoalId,
  profile.user_level as any,
  profile.injuries || [],
  profile.equipment_preference,
  durationMinutes
);
```

**Po:**
```typescript
const planId = await generateWorkoutPlan(
  selectedGymId,
  mappedGoalId,
  profile.user_level as any,
  profile.injuries || [],
  profile.equipment_preference,
  durationMinutes,
  profile.training_days || []  // ← PŘIDÁNO!
);
```

---

## Soubory ke změně

| Soubor | Změna |
|--------|-------|
| `src/pages/Training.tsx` | Přidat 7. parametr `profile.training_days \|\| []` do volání `generateWorkoutPlan` na řádku 375 |

---

## Očekávaný výsledek

Po regeneraci:
1. Systém zjistí, že máš **4+ tréninkové dny** v profilu
2. Použije split `upper_lower` (ne `full_body`)
3. Den A = **Horní tělo** (push/pull/biceps/triceps)
4. Den B = **Dolní tělo** (squat/hinge/lunge)
5. Clap Curtsy Squat bude správně v dni B (Dolní tělo), ne v dni A

---

## Bonus: Přidat UI pro manuální regeneraci

Uživatel by měl mít možnost regenerovat plán sám. Toto je již částečně implementováno (tlačítko "Regenerovat plán" existuje pro completed/error stavy), ale přidáme i obecný přístup v nastavení nebo na stránce tréninku.

