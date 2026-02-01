
# Přesun rozšířeného přehledu do MyPlan s barevným kalendářem

## Co uživatel chce

1. **Na Domů (Home.tsx) ZŮSTANE:**
   - Velká modrá karta "Týden X / Cíl / Celkový progress X%"
   - Sekce "Nadcházející tréninky" (1-4 tréninky)
   - Tlačítko "Vše" → přesměruje na `/profile/plan` (místo `/training`)

2. **Na MyPlan.tsx PŘIDÁME** (co je teď na Training.tsx po rozkliknutí "Vše"):
   - Header s názvem cíle, frekvencí (12 týdnů • 4× týdně)
   - Celkový progress bar (1/48 tréninků)
   - Navigace mezi týdny (< Týden 1/13 teď >)
   - Seznam tréninků aktuálního týdne
   - Kalendář 12 týdnů s **barevným rozlišením podle RIR metodiky**
   - Legenda typů týdnů

## Barevné rozlišení týdnů (podle RIR_BY_WEEK)

Podle existující metodiky v `src/lib/trainingGoals.ts`:

| Týden | Typ | Barva | RIR |
|-------|-----|-------|-----|
| 1-2 | Normální | Šedá (neutrální) | RIR 3 |
| 3-4 | Náročné | Oranžová | RIR 2 |
| 5-6 | Hardcore | Červená/růžová | RIR 1 |
| 7-8 | Deload | Zelená | Regenerace |
| 9-10 | Normální | Šedá | RIR 3 |
| 11-12 | Náročné | Oranžová | RIR 2 |

### Funkce pro typ týdne:
```typescript
import { getRIRGuidance } from '@/lib/trainingGoals';

const getWeekType = (weekNumber: number) => {
  const { rir, label } = getRIRGuidance(weekNumber);
  if (label === 'Deload') return 'deload';
  if (rir === 1) return 'hardcore';
  if (rir === 2) return 'moderate';
  return 'normal';
};
```

## Změny v souborech

### 1. Home.tsx - Změna navigace tlačítka "Vše"

**Řádek 269:** Změnit `navigate('/training')` → `navigate('/profile/plan')`

```tsx
<button
  onClick={() => navigate('/profile/plan')}  // ← ZMĚNA
  className="text-sm text-primary flex items-center gap-1 hover:underline"
>
  Vše
  <ChevronRight className="w-4 h-4" />
</button>
```

### 2. MyPlan.tsx - Kompletní přepracování

Přidáme:
1. **Header s cílem a frekvencí** (jako na Training.tsx rozbalené)
2. **Progress bar** (X/Y tréninků)
3. **Navigace mezi týdny** (< Týden X/12 >)
4. **Seznam tréninků aktuálního týdne** (Po, St, Pá...)
5. **Barevný kalendář 12 týdnů** s legendou
6. **Akční tlačítka** (Regenerovat, Změnit plán)

### Nová struktura MyPlan.tsx:

```tsx
// Imports + getRIRGuidance

const getWeekType = (weekNumber: number) => {
  const { rir, label } = getRIRGuidance(weekNumber);
  if (label === 'Deload') return 'deload';
  if (rir === 1) return 'hardcore';
  if (rir === 2) return 'moderate';
  return 'normal';
};

const weekTypeColors = {
  normal: 'bg-muted/50 border-border text-muted-foreground',
  moderate: 'bg-amber-500/20 border-amber-500/30 text-amber-600',
  hardcore: 'bg-red-500/20 border-red-500/30 text-red-600',
  deload: 'bg-green-500/20 border-green-500/30 text-green-600'
};

const weekTypeLabels = {
  normal: 'Normální',
  moderate: 'Náročný',
  hardcore: 'Hardcore',
  deload: 'Deload'
};
```

## Vizuální náhled kalendáře

```
┌─────────┬─────────┬─────────┬─────────┐
│ Týden 1 │ Týden 2 │ Týden 3 │ Týden 4 │
│  ⚪      │  ⚪      │  🟠      │  🟠      │
├─────────┼─────────┼─────────┼─────────┤
│ Týden 5 │ Týden 6 │ Týden 7 │ Týden 8 │
│  🔴      │  🔴      │  🟢      │  🟢      │
├─────────┼─────────┼─────────┼─────────┤
│ Týden 9 │ Týden 10│ Týden 11│ Týden 12│
│  ⚪      │  ⚪      │  🟠      │  🟠      │
└─────────┴─────────┴─────────┴─────────┘

Legenda:
⚪ Normální (RIR 3) | 🟠 Náročný (RIR 2) | 🔴 Hardcore (RIR 1) | 🟢 Deload
```

## Shrnutí změn

| Soubor | Změna |
|--------|-------|
| `src/pages/Home.tsx` | Tlačítko "Vše" → `/profile/plan` místo `/training` |
| `src/pages/MyPlan.tsx` | Přidat header s cílem, progress, navigaci týdnů, seznam tréninků, barevný kalendář s legendou |

## Očekávaný výsledek

1. Uživatel na **Domů** vidí:
   - Velká modrá karta s týdnem a progressem
   - Nadcházející tréninky (1-4 dny)
   - Klik na "Vše" → přejde do **Profil → Můj plán**

2. Na stránce **Můj plán** uživatel vidí:
   - Cíl + frekvence (12 týdnů • 4× týdně)
   - Celkový progress (X/48 tréninků)
   - Navigaci mezi týdny (< Týden 1/12 >)
   - Seznam tréninků vybraného týdne
   - **Barevný kalendář 12 týdnů** s legendou (Normální/Náročný/Hardcore/Deload)
   - Tlačítka pro regeneraci a změnu plánu
