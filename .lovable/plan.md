

# Přidání konfigurace Bench Press do gym_machines

## Problém

Aktuálně máme jeden stroj "Bench press" (`acbf79b8-...`), ale posilovny mohou mít různé typy:
- Pouze **flat** (rovná lavice)
- **Incline** lavice (šikmo nahoru)
- **Decline** lavice (šikmo dolů)  
- **Adjustable** (nastavitelná - všechny konfigurace)

Uživatel s běžnou flat lavicí by neměl dostávat incline/decline cviky.

## Navrhované řešení

### 1. Rozšířit tabulku `gym_machines` o konfigurace

```sql
ALTER TABLE gym_machines 
ADD COLUMN bench_configs text[] DEFAULT NULL;

-- bench_configs obsahuje kombinaci: 'flat', 'incline', 'decline'
-- NULL = stroj nepotřebuje konfiguraci (není bench press)
-- '{flat}' = pouze rovná
-- '{flat,incline,decline}' = adjustable, podporuje vše
```

### 2. Přidat flagy na cviky, jakou konfiguraci vyžadují

```sql
ALTER TABLE exercises 
ADD COLUMN required_bench_config text DEFAULT NULL;

-- 'flat' pro Barbell Bench Press
-- 'incline' pro Barbell Bench Press Incline  
-- 'decline' pro Barbell Bench Press Decline
-- NULL pro cviky které bench nepotřebují
```

### 3. Nastavit required_bench_config pro existující cviky

| Cvik | required_bench_config |
|------|----------------------|
| Barbell Bench Press | flat |
| Barbell Bench Press Incline | incline |
| Barbell Bench Press Decline | decline |
| Dumbbell Incline Bench Press | incline |
| Dumbbell Decline Bench Press | decline |

### 4. Upravit algoritmus výběru cviků

```typescript
// V selectionAlgorithm.ts - getCandidates()

// Přidat kontrolu bench konfigurace
if (ex.required_bench_config && ex.machine_id) {
  // Najdi gym_machine pro tento stroj
  const gymMachine = await getGymMachineConfig(context.gymId, ex.machine_id);
  if (!gymMachine?.bench_configs?.includes(ex.required_bench_config)) {
    return false; // Posilovna nemá tuto konfiguraci
  }
}
```

### 5. UI pro B2B - výběr konfigurace při přidání bench press

```
┌─────────────────────────────────────────┐
│  Bench press                            │
│                                         │
│  Konfigurace lavice:                    │
│  ☑ Flat (rovná)                         │
│  ☐ Incline (šikmá nahoru)               │
│  ☐ Decline (šikmá dolů)                 │
│                                         │
│  Počet kusov: [1]                       │
│  Max váha: [___] kg                     │
│                                         │
│  [Pridať stroj]                         │
└─────────────────────────────────────────┘
```

## Změny v souborech

| Soubor | Změna |
|--------|-------|
| **Migrace SQL** | Přidání sloupců `gym_machines.bench_configs` a `exercises.required_bench_config` |
| `src/contexts/GymContext.tsx` | Rozšířit `GymMachine` interface, upravit `addMachine` a `updateMachine` |
| `src/pages/business/GymMachines.tsx` | Přidat checkbox UI pro bench konfigurace |
| `src/lib/selectionAlgorithm.ts` | Přidat kontrolu bench konfigurace do filtru |
| `src/integrations/supabase/types.ts` | Auto-aktualizace po migraci |

## Technické detaily

### Nový interface GymMachine

```typescript
export interface GymMachine {
  id: string;
  gym_id: string;
  machine_id: string;
  quantity: number;
  max_weight_kg: number | null;
  bench_configs: string[] | null;  // NEW: ['flat', 'incline', 'decline']
  machine?: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
  };
}
```

### Seznam strojů vyžadujících konfiguraci

Pro určení kdy zobrazit UI pro konfiguraci, označíme v `machines` tabulce:

```sql
ALTER TABLE machines 
ADD COLUMN requires_bench_config boolean DEFAULT false;

UPDATE machines SET requires_bench_config = true 
WHERE name ILIKE '%bench press%';
```

### Dumbbell cviky s adjustable bench

Pro dumbbell cviky jako "Dumbbell Incline Bench Press" nastavíme:
- `required_bench_config = 'incline'`
- Algoritmus zkontroluje `secondary_machine_id` (Adjustable Bench) nebo jakýkoliv bench s příslušnou konfigurací

## Výsledek

1. Posilovna označí při přidání bench press jaké konfigurace podporuje
2. Algoritmus automaticky vyfiltruje incline/decline cviky pokud posilovna nemá příslušnou konfiguraci
3. Uživatelé dostanou jen cviky, které mohou reálně provést na dostupném vybavení

