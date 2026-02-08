
# Přidání seznamu posiloven ke stroji v Admin panelu

## Problém

V admin panelu `/admin/machines` při úpravě stroje není vidět, které posilovny tento stroj používají. To ztěžuje identifikaci strojů bez videí - admin neví, do které posilovny stroj patří.

## Řešení

Přidám novou sekci "Posilovny používající tento stroj" do editačního draweru podobně jako již existuje sekce "Napojené cviky".

## Implementace

### 1. Vytvořit nový hook `useMachineGyms`

```typescript
// src/hooks/useMachineGyms.ts
export interface MachineGymEntry {
  gym_id: string;
  gym_name: string;
  quantity: number;
  max_weight_kg: number | null;
  bench_configs: string[] | null;
}

export const useMachineGyms = (machineId: string | null) => {
  // Fetch all gyms that have this machine
  // Returns: { gyms, isLoading }
}
```

### 2. Vytvořit komponentu `MachineGymsList`

```typescript
// src/components/admin/MachineGymsList.tsx

// Zobrazí seznam posiloven s:
// - Název posilovny (kliknutelný link na /admin/gyms/:id)
// - Počet kusů
// - Max váha (pokud je nastavena)
// - Bench konfigurace (pokud má stroj requires_bench_config)
```

### 3. Přidat do editačního draweru v MachinesManagement.tsx

Sekce se zobrazí pod "Napojené cviky" a bude obsahovat:

```
┌─────────────────────────────────────────┐
│ 🏢 Posilovny s tímto strojem (2)        │
├─────────────────────────────────────────┤
│ Fitness Boby Centrum                  → │
│ 2x • max 120 kg                         │
├─────────────────────────────────────────┤
│ Motivace                              → │
│ 1x • max 100 kg • Flat, Incline         │
└─────────────────────────────────────────┘
```

## Změny v souborech

| Soubor | Změna |
|--------|-------|
| `src/hooks/useMachineGyms.ts` | **NOVÝ** - hook pro načtení posiloven používajících stroj |
| `src/components/admin/MachineGymsList.tsx` | **NOVÝ** - komponenta pro zobrazení seznamu posiloven |
| `src/pages/admin/MachinesManagement.tsx` | Přidat import a zobrazit `MachineGymsList` v draweru |

## Technické detaily

### SQL dotaz v hooku

```sql
SELECT 
  gm.gym_id,
  g.name as gym_name,
  gm.quantity,
  gm.max_weight_kg,
  gm.bench_configs
FROM gym_machines gm
JOIN gyms g ON g.id = gm.gym_id
WHERE gm.machine_id = $machineId
ORDER BY g.name
```

### Zobrazení v UI

- Každá posilovna jako karta s možností kliknutí pro přechod na `/admin/gyms/:id`
- Badge s počtem kusů
- Badge s max váhou (pokud je nastavena)
- Badge s bench konfigurací (pokud stroj `requires_bench_config = true`)
- Prázdný stav: "Žádná posilovna nemá tento stroj"

## Výsledek

Admin uvidí v editaci stroje:
1. Základní údaje (název, kategorie, kardio)
2. Napojené cviky (existující)
3. **NOVÉ:** Seznam posiloven, které mají tento stroj

To umožní rychle identifikovat, kam patří stroje bez videí/cviků.
