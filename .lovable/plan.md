

# Oprava zobrazení starých tréninků a zjednodušení flow "Začít trénink"

## Identifikované problémy

### Problém 1: Zobrazují se tréninky ze starého plánu
Stránka `/training` načítá dokončené tréninky podle `goal_id`, ale **nefiltruje podle `plan_id`**. Pokud máš nový plán se stejným cílem, zobrazí se i staré tréninky z předchozího plánu.

**Aktuální kód (řádek 256):**
```javascript
.eq('goal_id', plan.goalId)  // ❌ Filtruje jen podle cíle
```

**Řešení:**
```javascript
.eq('plan_id', plan.id)  // ✅ Filtruje podle konkrétního plánu
```

### Problém 2: Tlačítko "Začít trénink" naviguje na celou stránku Training
Když klikneš na "Začít trénink" z domovské stránky, chceš:
1. Zobrazit dialog s potvrzením posilovny
2. Přejít rovnou na preview tréninku a warmup

**Aktuální flow:**
Home → `/training` page (celý kalendář) → Tlačítko "Začít" → Gym dialog → Preview

**Požadovaný flow:**
Home → Gym dialog (přímo v Home) → Preview → Warmup → Trénink

---

## Navrhované změny

| Soubor | Změna |
|--------|-------|
| `src/pages/Training.tsx` | Opravit filtrování workout sessions podle `plan_id` místo `goal_id` |
| `src/pages/Home.tsx` | Přidat gym confirmation dialog a workout flow přímo do Home stránky |

---

## Technické detaily

### 1. Oprava filtrování tréninků v Training.tsx

Změnit dotaz na workout_sessions:

```javascript
// Řádek 253-257
const { data } = await supabase
  .from('workout_sessions')
  .select('id, started_at, day_letter, is_bonus')
  .eq('plan_id', plan.id)  // ← Změna: filtrovat podle plan_id
  .not('completed_at', 'is', null)
  .order('started_at', { ascending: true });
```

### 2. Přidání gym confirmation flow do Home.tsx

Přidat na domovskou stránku:
- State pro gym confirmation dialog
- Funkce `handleStartWorkout` (podobná jako v Training.tsx)
- AlertDialog pro potvrzení posilovny
- AlertDialog pro varování o zavřené posilovně
- Po potvrzení: navigate na `/training` s query parametrem `?start=true`

### 3. Upravit Training.tsx pro automatický start

Přidat logiku, která při URL parametru `?start=true`:
- Přeskočí kalendářovou obrazovku
- Automaticky otevře workout preview
- Rovnou spustí warmup flow

---

## UI Flow po změně

```text
┌─────────────────────────────────────────┐
│  HOME PAGE                              │
│                                         │
│  [▶ Začít trénink]                     │
│       ↓                                 │
│  ┌─────────────────────────────────┐   │
│  │  Jdeš cvičit do FitGym?        │   │
│  │  [Vybrat jinou] [Ano, začít]   │   │
│  └─────────────────────────────────┘   │
│       ↓                                 │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  TRAINING PAGE (s ?start=true)          │
│                                         │
│  → Automaticky otevře workout preview   │
│  → Spustí rozcvičku                    │
│  → Přejde do tréninku                   │
│                                         │
└─────────────────────────────────────────┘
```

---

## Očekávaný výsledek

1. **Opravený kalendář** - V kalendáři plánu se zobrazí pouze tréninky z aktuálního plánu (nedělní trénink ze starého plánu zmizí)

2. **Rychlejší start tréninku** - Kliknutí na "Začít trénink" z Home zobrazí pouze dialog s potvrzením posilovny a pak rovnou přejde na trénink

