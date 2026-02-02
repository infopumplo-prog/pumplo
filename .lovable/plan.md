
# Oprava prioritizace vybavení a UI po dokončení tréninku

## Identifikované problémy

### 1. Prioritizace vybavení nefunguje správně
Aktuálně algoritmus dává pouze **+5 bonus** cvikům odpovídajícím preferenci, ale **nefiltruje** ostatní cviky. Výsledek: uživatel s preferencí "stroje" dostává cviky s resistance bands.

**Problém v kódu (`selectionAlgorithm.ts`, řádky 388-404)**:
- Preference `bodyweight` je striktně filtrována (řádky 399-401)
- Preference `machines` ani `free_weights` nejsou filtrovány - jen dostávají +5 bonus

### 2. Špatná role cviku "Front Raise Resistance Bands"
Cvik má `primary_role = horizontal_push` (prsa), ale ve skutečnosti je to cvik na **ramena** (`front_shoulders`). Měl by mít `primary_role = shoulder_abduction` nebo `vertical_push`.

### 3. Obrazovka "Skvělá práce" - špatné statistiky
- Zobrazuje tuny místo **kilogramů**
- Zobrazuje počet sérií, ale má být jen **minuty a váha**

### 4. Navigace po dokončení tréninku
Po kliknutí na "Dokončit trénink" uživatel zůstává na `/training` místo přesměrování na domovskou stránku `/`.

---

## Plán oprav

### Krok 1: Striktní filtrování preference vybavení
**Soubor:** `src/lib/selectionAlgorithm.ts`

Změnit logiku ve funkci `getCandidates()` tak, aby preference vybavení fungovala jako **striktní filtr** (F0), ne jen bonus:

```typescript
// Místo:
if (context.equipmentPreference === 'bodyweight') {
  if (exType !== 'bodyweight') return false;
}

// Přidat filtry pro všechny preference:
if (context.equipmentPreference === 'bodyweight') {
  if (exType !== 'bodyweight') return false;
}
if (context.equipmentPreference === 'machines') {
  if (!['machine', 'cable', 'plate_loaded'].includes(exType)) return false;
}
if (context.equipmentPreference === 'free_weights') {
  if (!['barbell', 'dumbbell', 'kettlebell', 'resistance_band'].includes(exType)) return false;
}
```

Toto zajistí, že v F0 (normální selekce) budou vybírány **pouze** cviky odpovídající preferenci. Fallback F2 pak rozšíří výběr.

### Krok 2: Opravit primary_role cviku "Front Raise Resistance Bands"
**Akce:** SQL migrace

```sql
UPDATE exercises 
SET primary_role = 'shoulder_abduction'
WHERE id = '78876ba0-3030-4988-9ca4-845bf83cd10b';
```

### Krok 3: Upravit obrazovku "Skvělá práce"
**Soubor:** `src/components/workout/WorkoutSession.tsx`

Změny v summary sekci (řádky 192-210):
- Zobrazit váhu v **kilogramech** místo tun
- Odstranit ikonu a počet **sérií**
- Ponechat pouze minuty a kilogramy

```tsx
// Změna z:
<p className="text-2xl font-bold">{Math.round(totalWeight / 1000)}</p>
<p className="text-xs text-muted-foreground">tun</p>

// Na:
<p className="text-2xl font-bold">{Math.round(totalWeight)}</p>
<p className="text-xs text-muted-foreground">kg</p>
```

A odstranit střední sloupec (série).

### Krok 4: Přesměrování po dokončení tréninku
**Soubor:** `src/components/workout/WorkoutSession.tsx`

Po `handleFinishWorkout` přidat navigaci na domovskou stránku:

```typescript
const handleFinishWorkout = useCallback(async () => {
  await saveWorkoutSession({...});
  onComplete(results);
  navigate('/');  // Přidat přesměrování
}, [..., navigate]);
```

---

## Změny souborů

| Soubor | Změna |
|--------|-------|
| `src/lib/selectionAlgorithm.ts` | Přidat striktní filtrování pro preference `machines` a `free_weights` |
| SQL migrace | Opravit `primary_role` pro "Front Raise Resistance Bands" |
| `src/components/workout/WorkoutSession.tsx` | Změnit statistiky na kg + minuty; přidat navigaci na `/` |

---

## Očekávaný výsledek

1. **Uživatel s preferencí "stroje"** dostane pouze cviky s `machine`, `cable`, nebo `plate_loaded`
2. **Uživatel s preferencí "vlastní váha"** dostane pouze `bodyweight` cviky
3. **Uživatel s preferencí "volné váhy"** dostane pouze `barbell`, `dumbbell`, `kettlebell`, `resistance_band`
4. **Obrazovka "Skvělá práce"** zobrazí pouze minuty a kilogramy
5. **Po dokončení tréninku** je uživatel přesměrován na domovskou stránku

---

## Technická poznámka

Fallback hierarchie zůstává zachována:
- **F0**: Striktní preference + striktní vybavení gym
- **F1**: Relaxovat anti-repetition
- **F2**: Rozšířit typy vybavení (vypne striktní preference)
- **F3**: Role aliasy
- **F4**: Bodyweight fallback
- **F5**: Skip slot
