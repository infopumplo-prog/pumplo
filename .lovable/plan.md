

# Plán opravy: Generování tréninku a správné čtení cviků z DB

## Souhrn problémů a oprav

### PROBLÉM A: Duplicitní logika generování cviků
**Lokace:** `src/pages/Training.tsx`, řádky 686-830

**Co je špatně:** Funkce `generateExercisesForDay()` je STARÁ lokální logika, která:
- Ignoruje `machine_id` dostupnost v posilovně
- Nepoužívá nový scoring systém z `selectionAlgorithm.ts`
- Nepoužívá fallback hierarchii F0-F5
- Neukládá výsledky do DB

**Správný flow:** Cviky by měly být vygenerovány při vytvoření plánu (`generateWorkoutPlan()`) a poté čteny z `user_workout_exercises` tabulky pomocí `useWorkoutPlan.getCurrentDayExercises()`.

**Oprava:** 
1. Smazat funkci `generateExercisesForDay()` (řádky 686-830)
2. Upravit `handleGenerateDayExercises()` aby četla cviky z DB místo generování on-the-fly
3. Pokud cviky v DB neexistují, zobrazit chybovou hlášku a nabídnout regeneraci plánu

---

### PROBLÉM B: Role aliasy fungují OBRÁCENĚ
**Lokace:** `src/lib/selectionAlgorithm.ts`, funkce `fetchRoleAliases()`

**Stav databáze:**
```
role_aliases:
  id: push_general     → alias_for: horizontal_push
  id: squat_light      → alias_for: squat
  id: pulldown_variant → alias_for: vertical_pull
```

**Problém:** Když hledáme aliasy pro `horizontal_push` (protože nemáme cviky), query `.eq('alias_for', roleId)` vrátí `push_general`. Ale žádné cviky nemají `primary_role = 'push_general'`!

**Správná logika:** Aliasy slouží pro případ, kdy šablona používá alias název (např. `push_general`). Pak algoritmus najde, že `push_general` je alias pro `horizontal_push` a hledá cviky pod `horizontal_push`.

**Oprava:** Změnit `fetchRoleAliases()` aby:
1. Zkontrolovala zda `roleId` JE alias (hledá kde `id = roleId`)
2. Pokud ano, vrátí `alias_for` hodnotu (skutečná role se cviky)
3. Pokud ne, vrátí prázdné pole (není potřeba substituce)

---

### PROBLÉM E: Chybí potvrzení posilovny před tréninkem
**Lokace:** `src/pages/Training.tsx`

**Co chybí:** Uživatel musí vždy potvrdit do jaké posilovny jde, než začne cvičit.

**Oprava:** Přidat nový dialog před startem tréninku:
- "Jdeš cvičit do [název posilovny]?"
- Tlačítka: "Ano, začít" / "Vybrat jinou posilovnu"

---

## Fáze 1: Oprava handleGenerateDayExercises v Training.tsx

### Smazat funkci generateExercisesForDay (řádky 686-830)
Kompletně odstranit tuto duplicitní funkci.

### Přepsat handleGenerateDayExercises (řádky 634-663)

**PŘED:**
```typescript
const handleGenerateDayExercises = useCallback(async (gymId: string, startWorkoutAfter: boolean = false) => {
  if (!plan || !profile?.user_level) return;
  setIsGeneratingDayExercises(true);
  
  try {
    const exercises = await generateExercisesForDay(
      gymId, plan.goalId, plan.currentDayLetter, profile.user_level,
      profile.injuries || [], profile.equipment_preference || null,
      profile.training_duration_minutes || 60
    );
    
    setGeneratedExercises(exercises);
    setSelectedWorkoutGymId(gymId);
    setShowGymSelector(false);
    
    if (startWorkoutAfter) {
      setIsWorkoutActive(true);
    }
  } catch (err) {
    console.error('Error generating day exercises:', err);
  } finally {
    setIsGeneratingDayExercises(false);
  }
}, [plan, profile]);
```

**PO:**
```typescript
const handleGenerateDayExercises = useCallback(async (gymId: string, startWorkoutAfter: boolean = false) => {
  if (!plan || !profile?.user_level) return;
  setIsGeneratingDayExercises(true);
  
  try {
    // Číst cviky z databáze - byly vygenerovány při vytvoření plánu
    const exercisesFromPlan = getCurrentDayExercises();
    
    if (exercisesFromPlan.length > 0) {
      // Máme cviky v DB - použijeme je
      setGeneratedExercises(exercisesFromPlan);
      setSelectedWorkoutGymId(gymId);
      setShowGymSelector(false);
      
      if (startWorkoutAfter) {
        setShowWorkoutPreview(true);
      }
    } else {
      // Žádné cviky v DB - plán nemá vygenerované cviky
      // To znamená, že plán byl vytvořen bez posilovny nebo se něco pokazilo
      toast.error('Plán nemá vygenerované cviky. Prosím regeneruj plán v nastavení.');
    }
  } catch (err) {
    console.error('Error loading exercises:', err);
    toast.error('Nepodařilo se načíst cviky');
  } finally {
    setIsGeneratingDayExercises(false);
  }
}, [plan, profile, getCurrentDayExercises]);
```

---

## Fáze 2: Oprava fetchRoleAliases v selectionAlgorithm.ts

**Lokace:** `src/lib/selectionAlgorithm.ts`, řádky 263-278

**PŘED:**
```typescript
export const fetchRoleAliases = async (roleId: string): Promise<RoleAlias[]> => {
  const { data, error } = await supabase
    .from('role_aliases')
    .select('*')
    .eq('alias_for', roleId)
    .order('priority');

  if (error || !data) {
    return [];
  }

  return data as RoleAlias[];
};
```

**PO:**
```typescript
/**
 * Fetch role aliases for fallback substitution
 * 
 * Logika: Aliasy mapují alternativní názvy rolí na skutečné role se cviky.
 * Např. 'push_general' je alias pro 'horizontal_push'.
 * 
 * Když hledáme cviky pro alias (push_general), tato funkce vrátí
 * skutečnou roli (horizontal_push) pod kterou cviky existují.
 */
export const fetchRoleAliases = async (roleId: string): Promise<RoleAlias[]> => {
  // Zkontroluj zda roleId je alias (hledá kde id = roleId)
  const { data: aliasData, error: aliasError } = await supabase
    .from('role_aliases')
    .select('*')
    .eq('id', roleId)
    .order('priority');

  if (!aliasError && aliasData && aliasData.length > 0) {
    // roleId JE alias - vrať skutečnou roli (alias_for)
    return aliasData.map(a => ({
      id: a.alias_for, // Skutečná role se cviky
      alias_for: a.id,
      priority: a.priority || 1
    })) as RoleAlias[];
  }

  // roleId je skutečná role (ne alias) - není potřeba substituce
  return [];
};
```

---

## Fáze 3: Přidat potvrzení posilovny před tréninkem

### Nový stav v Training.tsx
```typescript
const [showGymConfirmDialog, setShowGymConfirmDialog] = useState(false);
const [confirmedGymName, setConfirmedGymName] = useState<string>('');
```

### Upravit handleStartWorkout
**PŘED (řádky 850-882):**
```typescript
const handleStartWorkout = async () => {
  // Check if gym is open...
  if (profile?.selected_gym_id) {
    // ... gym open check
  }
  
  if (currentExercises.length > 0 && plan?.gymId) {
    setGeneratedExercises(currentExercises);
    // ... start
  }
  // ...
};
```

**PO:**
```typescript
const handleStartWorkout = async () => {
  // Uživatel musí mít vybranou posilovnu
  if (!profile?.selected_gym_id) {
    toast.error('Nejdříve vyber posilovnu na mapě');
    navigate('/map');
    return;
  }
  
  // Načti název posilovny
  const { data: gymData } = await supabase
    .from('gyms')
    .select('name, opening_hours')
    .eq('id', profile.selected_gym_id)
    .single();
  
  if (!gymData) {
    toast.error('Posilovna nebyla nalezena');
    return;
  }
  
  // Zkontroluj otevírací hodiny
  if (gymData.opening_hours) {
    const isOpen = isGymCurrentlyOpen(gymData.opening_hours as OpeningHours);
    if (!isOpen) {
      setClosedGymName(gymData.name || 'Vybraná posilovna');
      setShowGymClosedWarning(true);
      return;
    }
  }
  
  // Zobraz potvrzovací dialog
  setConfirmedGymName(gymData.name || 'Vybraná posilovna');
  setShowGymConfirmDialog(true);
};

// Nová funkce pro potvrzení
const handleConfirmGymAndStart = async () => {
  setShowGymConfirmDialog(false);
  
  const currentExercises = getCurrentDayExercises();
  
  if (currentExercises.length > 0) {
    setGeneratedExercises(currentExercises);
    setSelectedWorkoutGymId(profile!.selected_gym_id!);
    setShowWorkoutPreview(true);
  } else {
    toast.error('Plán nemá vygenerované cviky. Prosím regeneruj plán.');
  }
};

// Změna posilovny
const handleChangeGym = () => {
  setShowGymConfirmDialog(false);
  navigate('/map');
};
```

### Nový dialog komponenta
```tsx
{/* Gym Confirmation Dialog */}
<AlertDialog open={showGymConfirmDialog} onOpenChange={setShowGymConfirmDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Potvrzení posilovny</AlertDialogTitle>
      <AlertDialogDescription>
        Jdeš cvičit do <strong>{confirmedGymName}</strong>?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={handleChangeGym}>
        Vybrat jinou
      </AlertDialogCancel>
      <AlertDialogAction onClick={handleConfirmGymAndStart}>
        Ano, začít trénink
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Shrnutí změn

| Soubor | Změna | Popis |
|--------|-------|-------|
| `src/pages/Training.tsx` | Smazat `generateExercisesForDay` | Odstranit duplicitní generování (řádky 686-830) |
| `src/pages/Training.tsx` | Přepsat `handleGenerateDayExercises` | Číst cviky z DB místo generování |
| `src/pages/Training.tsx` | Přidat gym confirmation dialog | Nový stav + dialog + handlery |
| `src/lib/selectionAlgorithm.ts` | Opravit `fetchRoleAliases` | Správná logika hledání aliasů |

---

## Testovací scénáře

1. **Uživatel s vygenerovaným plánem:**
   - Klikne "Začít trénink"
   - Zobrazí se dialog "Jdeš do [Gym]?"
   - Potvrdí → Zobrazí se preview s cviky z DB

2. **Uživatel bez posilovny:**
   - Klikne "Začít trénink"
   - Přesměrován na `/map` s hláškou

3. **Uživatel s plánem bez cviků:**
   - Klikne "Začít trénink"
   - Zobrazí se chyba "Plán nemá cviky, regeneruj"

4. **Alias role v šabloně:**
   - Šablona má `push_general`
   - Algoritmus najde alias → hledá cviky pod `horizontal_push`

