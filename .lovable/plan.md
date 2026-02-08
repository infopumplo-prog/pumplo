

# Kompletní řešení správy strojů a cviků v Admin panelu

## Shrnutí strategie

### Kategorizace vybavení (machines tabulka)

| equipment_category | Příklady | Popis |
|-------------------|----------|-------|
| `machine` | Leg press, Cable machine, Lat pulldown | Fitness stroje s vedením pohybu |
| `free_weight` | Dumbbells, Barbell, Kettlebell, EZ bar | Volné váhy |
| `accessory` | Adjustable Bench, Incline bench, Ab mat | Příslušenství/podpůrné vybavení |

### Kategorizace cviků (exercises tabulka)

| equipment_type | machine_id | secondary_machine_id | Příklad |
|----------------|------------|---------------------|---------|
| `dumbbell` | → Dumbbells | → Incline bench | Incline Dumbbell Press |
| `barbell` | → Barbell | → Bench press | Bench Press |
| `machine` | → Leg press | null | Leg Press |
| `bodyweight` | null | null | Push-up |
| `cable` | → Cable machine | null | Cable Fly |

## Současný stav (problémy)

1. **Stroje špatně kategorizované**: "Dumbbells", "Barbell", "Incline bench" mají `equipment_category: machine` místo `free_weight`/`accessory`
2. **0 z 1028 cviků má `secondary_machine_id`**: Pole existuje ale není používáno
3. **Admin panel cviků**: Chybí možnost nastavit `secondary_machine_id`
4. **Admin panel strojů**: Nevidíme které cviky stroj používají

## Plán implementace

### Fáze 1: Rozšíření Admin panelu strojů

**Změny v `MachinesManagement.tsx`:**
- Při editaci stroje zobrazit seznam napojených cviků
- Zobrazit počet cviků u každého stroje v seznamu
- Při kliknutí na cvik přejít do editace cviku

```
┌─────────────────────────────────────────┐
│  Upravit stroj                          │
├─────────────────────────────────────────┤
│  Název: [Dumbbells              ]       │
│  Kategorie: [Volná váha ▼]              │
│  □ Kardio vybavení                      │
│                                         │
│  ── Napojené cviky (45) ──              │
│  ┌───────────────────────────────────┐  │
│  │ Dumbbell Bench Press              │  │
│  │ equipment_type: dumbbell          │  │
│  │ secondary: Incline bench ❌       │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ Incline Dumbbell Fly              │  │
│  │ equipment_type: dumbbell          │  │
│  │ secondary: (žádný) [+ Přidat]     │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

### Fáze 2: Rozšíření Admin panelu cviků

**Změny v `ExercisesManagement.tsx`:**
- Přidat pole pro `secondary_machine_id` (zobrazit vždy, ne jen pro typ machine)
- Zobrazovat oba stroje v seznamu cviků

```typescript
// Nový formulářový stav
const [form, setForm] = useState({
  // ... existující pole
  machine_id: '',
  secondary_machine_id: '',  // NOVÉ
});

// V draweru
<div>
  <Label>Primární vybavení (machine_id)</Label>
  <Select value={form.machine_id} onValueChange={...}>
    {machines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
  </Select>
</div>

<div>
  <Label>Sekundární vybavení (secondary_machine_id)</Label>
  <Select value={form.secondary_machine_id} onValueChange={...}>
    <SelectItem value="">Žádné</SelectItem>
    {machines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
  </Select>
</div>
```

### Fáze 3: Hromadná oprava kategorií strojů

Přidat tlačítko "Opravit kategorie" které automaticky přenastaví:

| Stroj obsahující | Nová kategorie |
|-----------------|----------------|
| "dumbbell", "jednoručky" | `free_weight` |
| "barbell", "činka" | `free_weight` |
| "kettlebell" | `free_weight` |
| "bench", "lavička" | `accessory` |
| "mat", "podložka" | `accessory` |
| "roller", "válec" | `accessory` |

### Fáze 4: Rychlé přidání secondary_machine_id

V detailu stroje u každého cviku možnost rychle nastavit sekundární stroj:

```
Dumbbell Bench Press
├─ machine_id: Dumbbells ✓
├─ secondary_machine_id: [Vybrat ▼]
│   ├─ Adjustable Bench
│   ├─ Incline bench
│   ├─ Decline bench
│   └─ Flat bench
```

## Technické změny

### Soubory k úpravě

| Soubor | Změna |
|--------|-------|
| `src/pages/admin/MachinesManagement.tsx` | Zobrazení napojených cviků, možnost rychle nastavit secondary_machine_id |
| `src/pages/admin/ExercisesManagement.tsx` | Přidat pole pro secondary_machine_id |
| Nový hook `useMachineExercises.ts` | Načtení cviků pro konkrétní stroj |

### Dotazy na databázi

```sql
-- Načtení cviků pro stroj (jako primární NEBO sekundární)
SELECT e.*, 
  m1.name as primary_machine_name,
  m2.name as secondary_machine_name
FROM exercises e
LEFT JOIN machines m1 ON e.machine_id = m1.id  
LEFT JOIN machines m2 ON e.secondary_machine_id = m2.id
WHERE e.machine_id = :machineId OR e.secondary_machine_id = :machineId

-- Oprava kategorií strojů
UPDATE machines SET equipment_category = 'free_weight' 
WHERE LOWER(name) LIKE '%dumbbell%' OR LOWER(name) LIKE '%barbell%' OR LOWER(name) LIKE '%kettlebell%';

UPDATE machines SET equipment_category = 'accessory'
WHERE LOWER(name) LIKE '%bench%' OR LOWER(name) LIKE '%mat%' OR LOWER(name) LIKE '%roller%';
```

## Výsledek

Po implementaci:
1. **Stroje správně kategorizované** - Dumbbells jako `free_weight`, Bench jako `accessory`
2. **Viditelnost vazeb** - u každého stroje vidíme které cviky ho používají
3. **Kompletní editace cviků** - možnost nastavit oba stroje (primary + secondary)
4. **Rychlá oprava dat** - hromadná změna kategorií jedním kliknutím
5. **Algoritmus výběru cviků** - bude moci správně kontrolovat dostupnost obou kusů vybavení

