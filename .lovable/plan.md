
# Kategorizace vybavení - Zjednodušené řešení

## Přehled

Přidám do tabulky `machines` sloupec `equipment_category` se **3 hlavními kategoriemi** pro algoritmus výběru cviků, plus volitelný tag pro kardio.

## Kategorie vybavení

| Kategorie | Hodnota | Příklady |
|-----------|---------|----------|
| **Stroje** | `machine` | Chest press, Leg press, Cable crossover, Lat pulldown, Plate-loaded stroje |
| **Volné váhy** | `free_weight` | Barbell, Dumbbells, Kettlebell, EZ bar |
| **Příslušenství** | `accessory` | Bench, Plyo box, Ab mat, Foam roller, Exercise ball |

Plus volitelný boolean `is_cardio` pro běžecké pásy, rotopedy atd.

## Databázové změny

```sql
-- Přidat kategorizaci do tabulky machines
ALTER TABLE public.machines 
ADD COLUMN equipment_category text DEFAULT 'machine';

ALTER TABLE public.machines 
ADD COLUMN is_cardio boolean DEFAULT false;
```

## Změny v Admin panelu

### 1. MachinesManagement.tsx

**Rozšířit interface a form:**
```typescript
interface Machine {
  id: string;
  name: string;
  description: string | null;
  equipment_category: string;  // Přidáno
  is_cardio: boolean;          // Přidáno
  created_at: string;
}
```

**Přidat UI prvky do draweru:**
- Select pro kategorii (Stroj / Volná váha / Příslušenství)
- Switch pro označení jako Kardio
- Badge zobrazující kategorii v seznamu

**Přidat filtr podle kategorie** do seznamu strojů.

### 2. Propojení s cviky

Současný stav:
- Cviky mají `equipment_type` (bodyweight, barbell, dumbbell, machine, cable, kettlebell...)
- Cviky mají `machine_id` odkazující na konkrétní stroj

**Problém**: Cvik může potřebovat více vybavení (např. Incline Dumbbell Press = Dumbbells + Incline Bench)

**Řešení - Fáze 1**: Přidat `secondary_machine_id` do `exercises` pro jednoduché případy:
```sql
ALTER TABLE public.exercises 
ADD COLUMN secondary_machine_id uuid REFERENCES machines(id);
```

**Řešení - Fáze 2** (později): Plná M:N vazba přes tabulku `exercise_equipment`.

### 3. Aktualizace algoritmu

V `selectionAlgorithm.ts` aktualizovat kontrolu vybavení:
- Kontrolovat, že posilovna má primární I sekundární stroj
- Mapovat `equipment_category` strojů na preferenci uživatele

## Technické detaily

### MachinesManagement.tsx změny

```tsx
// Konstanty pro kategorie
const EQUIPMENT_CATEGORIES = [
  { value: 'machine', label: 'Stroj' },
  { value: 'free_weight', label: 'Volná váha' },
  { value: 'accessory', label: 'Příslušenství' },
];

// V draweru přidat:
<div>
  <Label>Kategorie vybavení</Label>
  <Select
    value={form.equipment_category}
    onValueChange={(value) => setForm({ ...form, equipment_category: value })}
  >
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      {EQUIPMENT_CATEGORIES.map((cat) => (
        <SelectItem key={cat.value} value={cat.value}>
          {cat.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

<div className="flex items-center justify-between">
  <Label>Kardio vybavení</Label>
  <Switch
    checked={form.is_cardio}
    onCheckedChange={(checked) => setForm({ ...form, is_cardio: checked })}
  />
</div>
```

### ExercisesManagement.tsx změny

Přidat výběr sekundárního stroje:
```tsx
<div>
  <Label>Sekundární vybavení (volitelné)</Label>
  <Select
    value={form.secondary_machine_id}
    onValueChange={(value) => setForm({ ...form, secondary_machine_id: value })}
  >
    <SelectTrigger><SelectValue placeholder="Např. lavička pro cvik s činkou" /></SelectTrigger>
    <SelectContent>
      <SelectItem value="">Žádné</SelectItem>
      {machines.map((machine) => (
        <SelectItem key={machine.id} value={machine.id}>
          {machine.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

## Soubory k úpravě

| Soubor | Změna |
|--------|-------|
| Databázová migrace | `equipment_category` + `is_cardio` do machines, `secondary_machine_id` do exercises |
| `src/pages/admin/MachinesManagement.tsx` | Select pro kategorii, Switch pro kardio, Badge, Filtr |
| `src/pages/admin/ExercisesManagement.tsx` | Select pro sekundární stroj |
| `src/lib/selectionAlgorithm.ts` | Kontrola obou machine_id při výběru cviku |

## Migrace stávajících dat

Po implementaci bude potřeba:
1. Ručně klasifikovat 136 strojů do 3 kategorií
2. U cviků vyžadujících 2 vybavení doplnit secondary_machine_id

## Výsledek

- Admin může klasifikovat každý stroj jako Stroj/Volnou váhu/Příslušenství
- Cviky mohou mít přiřazené 2 vybavení (primární + sekundární)
- Algoritmus bude respektovat preference uživatele a dostupnost vybavení v posilovně
