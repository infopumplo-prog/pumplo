
# Plán opravy: 3 problémy s generováním plánu

## Shrnutí problémů

### Problém 1: Redundantní výběr cíle
**Co se děje**: Po přihlášení a dokončení onboardingu se na stránce `/training` znovu zobrazuje obrazovka "Vyber si cíl", i když uživatel cíl již zadal v dotazníku.

**Příčina**: V `Training.tsx` existují dvě různé cesty pro vytvoření plánu:
1. `OnboardingDrawer.handleComplete()` - správně volá `generateWorkoutPlan()` a vytváří plán s cviky
2. `handleCreatePlanSchedule()` - vytváří PRÁZDNÝ plán bez cviků, bez `training_days`, takže plán sice existuje, ale nemá žádná data

Když uživatel nemá gym vybraný při dokončení onboardingu, OnboardingDrawer vytvoří prázdný plán, ale bez `training_days` snapshot. Pak když jde na /training, vidí znovu výběr cíle.

### Problém 2: Možnosti v dotazníku neodpovídají algoritmu
**Co se děje**: V dotazníku (step 6 - Equipment) jsou možnosti:
- `machines` - Hlavně stroje
- `bodyweight` - Vlastní váha
- `no_preference` - Bez preference

Ale v `selectionAlgorithm.ts` funkce `matchesEquipmentPreference()` očekává:
- `machines` ✓
- `free_weights` (činkky) - **CHYBÍ v dotazníku!**
- `bodyweight` ✓

### Problém 3: Tlačítko "Vytvořit plán" nefunguje
**Co se děje**: Funkce `handleCreatePlanSchedule()` vytváří plán bez cviků a bez gym_id.

**Příčina**: Funkce by měla volat `generateWorkoutPlan()` (pokud je gym vybrán), ale místo toho jen insertuje prázdný záznam do `user_workout_plans`.

---

## Plán opravy

### Fáze 1: Oprava handleCreatePlanSchedule() v Training.tsx
Přepsat funkci aby:
1. Pokud uživatel MÁ vybranou posilovnu (`profile.selected_gym_id`):
   - Zavolat `generateWorkoutPlan()` s všemi parametry z profilu
2. Pokud uživatel NEMÁ posilovnu:
   - Vytvořit plán s `training_days` snapshotem z profilu
   - Zobrazit zprávu, že musí nejdřív vybrat posilovnu

### Fáze 2: Přidání možnosti free_weights do dotazníku
Aktualizovat `EQUIPMENT_OPTIONS` v `src/lib/onboardingTypes.ts`:
```
export const EQUIPMENT_OPTIONS = [
  { id: 'machines', label: 'Hlavně stroje' },
  { id: 'free_weights', label: 'Volné váhy (činkky)' },
  { id: 'bodyweight', label: 'Vlastní váha' },
  { id: 'no_preference', label: 'Bez preference' },
];
```

### Fáze 3: Oprava OnboardingDrawer.handleComplete()
Zajistit, že při vytvoření prázdného plánu (bez gym) se správně nastaví `training_days` snapshot.

---

## Technické detaily

### Soubory k úpravě:

| Soubor | Změna |
|--------|-------|
| `src/pages/Training.tsx` | Přepsat `handleCreatePlanSchedule()` aby volal `generateWorkoutPlan()` |
| `src/lib/onboardingTypes.ts` | Přidat `free_weights` do `EQUIPMENT_OPTIONS` |
| `src/lib/selectionAlgorithm.ts` | Aktualizovat `matchesEquipmentPreference()` aby podporovala `no_preference` |

### Změna v Training.tsx (handleCreatePlanSchedule):

```typescript
const handleCreatePlanSchedule = async () => {
  if (!selectedGoalId || !profile?.user_level) return;
  
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return;

  // Pokud má uživatel vybranou posilovnu, generuj plán s cviky
  if (profile.selected_gym_id) {
    const planId = await generateWorkoutPlan(
      profile.selected_gym_id,
      selectedGoalId as TrainingGoalId,
      profile.user_level as UserLevel,
      profile.injuries || [],
      profile.equipment_preference,
      profile.training_duration_minutes || 60,
      profile.training_days || []
    );
    
    if (planId) {
      refetchPlan();
      toast.success('Plán vytvořen!');
    }
  } else {
    // Bez posilovny - vytvoř prázdný plán s training_days
    await supabase
      .from('user_workout_plans')
      .update({ is_active: false })
      .eq('user_id', user.user.id);

    await supabase
      .from('user_profiles')
      .update({ current_day_index: 0 })
      .eq('user_id', user.user.id);

    await supabase
      .from('user_workout_plans')
      .insert({
        user_id: user.user.id,
        goal_id: selectedGoalId,
        is_active: true,
        gym_id: null,
        current_week: 1,
        training_days: profile.training_days || [] // DŮLEŽITÉ!
      });

    refetchPlan();
    toast.info('Plán vytvořen. Pro generování cviků vyber posilovnu.');
  }
};
```

### Změna v onboardingTypes.ts:

```typescript
export const EQUIPMENT_OPTIONS = [
  { id: 'machines', label: 'Hlavně stroje', description: 'Káblové a hydraulické stroje' },
  { id: 'free_weights', label: 'Volné váhy', description: 'Činky, kettlebelly, olympijské tyče' },
  { id: 'bodyweight', label: 'Vlastní váha', description: 'Cviky bez vybavení' },
  { id: 'no_preference', label: 'Bez preference', description: 'Kombinace všeho' },
];
```

### Změna v selectionAlgorithm.ts:

```typescript
export const matchesEquipmentPreference = (
  exercise: Exercise,
  preference: string | null
): boolean => {
  if (!preference || preference === 'no_preference') return false;
  // ... zbytek beze změny
};
```

---

## Testovací scénáře

1. **Nový uživatel bez posilovny**:
   - Dokončí onboarding → Plán se vytvoří s `training_days`
   - Jde na /training → Vidí výzvu k výběru posilovny (NE výběr cíle znovu)

2. **Nový uživatel s posilovnou**:
   - Dokončí onboarding → Plán se vytvoří s cviky
   - Jde na /training → Vidí svůj plán s cviky

3. **Existující uživatel regeneruje plán**:
   - Klikne na "Regenerovat plán" → Plán se vytvoří s novými nastaveními

4. **Preference vybavení**:
   - Uživatel vybere "Volné váhy" → Cviky s činkkami dostanou bonus ve scoringu
