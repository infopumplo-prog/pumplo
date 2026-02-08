

# Oprava chyby SelectItem a vylepšení prokliknutí na cvik

## Identifikovaný problém

Chyba `A <Select.Item /> must have a value prop that is not an empty string` je způsobena tím, že Radix UI Select komponenta **nepodporuje prázdný string jako hodnotu**.

V kódu jsou dva problematické řádky:
- **Řádek 486**: `<SelectItem value="">Žádné</SelectItem>` (primární vybavení)
- **Řádek 506**: `<SelectItem value="">Žádné</SelectItem>` (sekundární vybavení)

## Řešení

### 1. Oprava SelectItem hodnoty

Použijeme speciální hodnotu `"__none__"` místo prázdného stringu:

```typescript
// Místo:
<SelectItem value="">Žádné</SelectItem>

// Použijeme:
<SelectItem value="__none__">Žádné</SelectItem>

// A v onValueChange handleru:
onValueChange={(value) => setForm({ 
  ...form, 
  machine_id: value === '__none__' ? '' : value 
})}
```

### 2. Přidání prokliknutí na cvik z MachineExercisesList

V komponentě `MachineExercisesList.tsx` přidáme:
- Kliknutí na název cviku otevře stránku cviků s automatickým otevřením draweru pro daný cvik
- Nebo přidáme tlačítko pro přechod na detail cviku

## Soubory k úpravě

| Soubor | Změna |
|--------|-------|
| `src/pages/admin/ExercisesManagement.tsx` | Změnit `value=""` na `value="__none__"` a upravit handlery |
| `src/components/admin/MachineExercisesList.tsx` | Přidat proklik na cvik |

## Technické detaily

### ExercisesManagement.tsx

```typescript
// Primární vybavení (řádek ~476-493)
<Select
  value={form.machine_id || '__none__'}
  onValueChange={(value) => setForm({ 
    ...form, 
    machine_id: value === '__none__' ? '' : value 
  })}
>
  <SelectTrigger>
    <SelectValue placeholder="Vyber vybavení" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="__none__">Žádné</SelectItem>
    {machines.map((machine) => (
      <SelectItem key={machine.id} value={machine.id}>
        {machine.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

// Sekundární vybavení (řádek ~496-513) - stejná změna
```

### MachineExercisesList.tsx

```typescript
import { ExternalLink } from 'lucide-react';

// V renderování cviku přidat odkaz
<div className="flex items-center gap-2">
  <p className="font-medium text-sm truncate">{exercise.name}</p>
  <Button
    variant="ghost"
    size="icon"
    className="h-6 w-6"
    onClick={() => {
      // Přejít na /admin/exercises s query parametrem pro otevření cviku
      window.location.href = `/admin/exercises?edit=${exercise.id}`;
    }}
  >
    <ExternalLink className="w-3 h-3" />
  </Button>
</div>
```

### Bonus: Podpora query parametru v ExercisesManagement

```typescript
// V useEffect po načtení dat
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const editId = params.get('edit');
  if (editId && exercises.length > 0) {
    const exercise = exercises.find(e => e.id === editId);
    if (exercise) {
      openEditDrawer(exercise);
      // Vyčistit URL
      window.history.replaceState({}, '', '/admin/exercises');
    }
  }
}, [exercises]);
```

## Výsledek

1. **Stránka cviků se znovu načte** bez chyby
2. **Lze vybrat "Žádné"** pro odebrání stroje z cviku
3. **Proklik z machine draweru** přímo na editaci cviku
4. **Možnost změnit machine_id** z Adductor na Abductor machine

