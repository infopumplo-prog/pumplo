
# Oprava chybějících prvků v Admin panelu

## Nalezené problémy

### 1. Chybí Feedback tlačítko v Admin panelu
- `FeedbackButton` je pouze v `AppLayout.tsx` (řádek 13)
- Admin stránky používají vlastní `AdminLayout.tsx`, který FeedbackButton neobsahuje

### 2. Tlačítko odhlášení
- Tlačítko odhlášení v AdminLayout **existuje** (řádek 46-51) - malá ikona LogOut v pravém horním rohu
- Pokud nefunguje, je to bug v logout funkci

### 3. Proč se zobrazuje "Dokonči svůj profil"
- Screenshot ukazuje preview na `/` (Home page), ne na `/admin/exercises`
- Po deploy změn se preview pravděpodobně refreshlo na domovskou stránku
- Řešení: ručně navigovat zpět na `/admin/exercises`

### 4. Chybí pole pro `required_bench_config` ve formuláři cviků
- Sloupec `exercises.required_bench_config` v databázi existuje (text)
- Ve formuláři v `ExercisesManagement.tsx` chybí UI pro jeho editaci

## Plán oprav

### Krok 1: Přidat FeedbackButton do AdminLayout

```tsx
// src/pages/admin/AdminLayout.tsx
import { FeedbackButton } from '@/components/feedback/FeedbackButton';

// V return JSX přidat před </div> na konci:
<FeedbackButton />
```

### Krok 2: Přidat pole required_bench_config do formuláře cviků

Přidat nové pole do formuláře v `ExercisesManagement.tsx`:

| Pozice | Změna |
|--------|-------|
| Interface Exercise | Přidat `required_bench_config: string \| null` |
| form state | Přidat `required_bench_config: ''` |
| openEditDrawer | Přidat `required_bench_config: exercise.required_bench_config \|\| ''` |
| handleSave | Přidat `required_bench_config: form.required_bench_config \|\| null` |
| JSX formuláře | Přidat Select s hodnotami `flat`, `incline`, `decline` |

### Krok 3: Konstanty pro bench config

```typescript
const BENCH_CONFIGS = [
  { value: 'flat', label: 'Flat (rovná)' },
  { value: 'incline', label: 'Incline (šikmá nahoru)' },
  { value: 'decline', label: 'Decline (šikmá dolů)' },
];
```

## Změny v souborech

| Soubor | Změna |
|--------|-------|
| `src/pages/admin/AdminLayout.tsx` | Přidat import a FeedbackButton |
| `src/pages/admin/ExercisesManagement.tsx` | Přidat `required_bench_config` do interface, form state, save handler a UI |

## Výsledek

1. Feedback tlačítko bude viditelné i v admin panelu
2. Admin může nastavit `required_bench_config` pro jednotlivé cviky (flat/incline/decline)
3. Algoritmus výběru pak bude správně filtrovat cviky podle dostupné konfigurace bench press v posilovně
