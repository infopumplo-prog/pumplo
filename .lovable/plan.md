

# Nástroj pro sloučení duplicitních strojů v Admin panelu

## Přehled

Přidám do admin panelu strojů tlačítko **"Najít duplicity"**, které otevře drawer se seznamem duplicitních strojů a umožní je sloučit.

## Co se bude měnit při sloučení

| Tabulka | Sloupec | Akce |
|---------|---------|------|
| `exercises` | `machine_id` | Přesměruje na primární ID |
| `exercises` | `secondary_machine_id` | **NEBUDE SE MĚNIT** |
| `gym_machines` | `machine_id` | Přesměruje na primární ID |
| `machines` | - | Smaže duplicitní záznamy |

## Funkce nástroje

### 1. Detekce duplicit
- Seskupí stroje podle názvu (case-insensitive)
- Zobrazí pouze skupiny s 2+ záznamy

### 2. Zobrazení použití každého duplicitního stroje
Pro každý duplicitní stroj ukáže:
- Počet cviků kde je použit jako `machine_id`
- Počet posiloven kde je přiřazen (`gym_machines`)

### 3. Sloučení (Merge)
Uživatel vybere **primární** stroj (ten co zůstane) a systém:
1. Přesune všechny reference z `exercises.machine_id` na primární ID
2. Přesune všechny reference z `gym_machines.machine_id` na primární ID (s ošetřením konfliktů)
3. Smaže duplicitní záznamy z `machines`

**DŮLEŽITÉ**: `secondary_machine_id` zůstane nedotčen!

## UI Design

### Tlačítko v hlavičce
```
[Najít duplicity]
```

### Drawer s duplicitami
```
┌─────────────────────────────────────────┐
│  Duplicitní stroje (4 skupiny)          │
├─────────────────────────────────────────┤
│                                         │
│  📦 Ab roller (2 záznamy)               │
│  ┌─────────────────────────────────┐    │
│  │ ○ Ab roller (623edf0f...)       │    │
│  │   Cviky: 0 | Posilovny: 1       │    │
│  │ ○ Ab roller (9e6dcffc...)       │    │
│  │   Cviky: 0 | Posilovny: 0       │    │
│  │                                 │    │
│  │ [Sloučit vybrané]               │    │
│  └─────────────────────────────────┘    │
│                                         │
│  📦 Abductor machine (2 záznamy)        │
│  ┌─────────────────────────────────┐    │
│  │ ● Abductor machine (79820aad..) │    │
│  │   Cviky: 1 | Posilovny: 1       │    │
│  │ ○ Abductor machine (7ad2691a..) │    │
│  │   Cviky: 0 | Posilovny: 1       │    │
│  │                                 │    │
│  │ [Sloučit vybrané]               │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

## Technická implementace

### Logika sloučení (bez secondary_machine_id)
```typescript
const mergeDuplicates = async (groupName: string) => {
  const primaryId = selectedPrimary[groupName];
  const duplicateIds = group.items
    .filter(m => m.id !== primaryId)
    .map(m => m.id);
  
  // 1. Přesunout POUZE exercises.machine_id
  await supabase
    .from('exercises')
    .update({ machine_id: primaryId })
    .in('machine_id', duplicateIds);
  
  // 2. Přesunout gym_machines (s ošetřením konfliktů)
  // ... logika pro přesměrování nebo smazání duplicitních vazeb
  
  // 3. Smazat duplicitní stroje
  await supabase
    .from('machines')
    .delete()
    .in('id', duplicateIds);
};
```

## Soubor k úpravě

| Soubor | Změna |
|--------|-------|
| `src/pages/admin/MachinesManagement.tsx` | Přidat tlačítko, drawer, logiku pro detekci a sloučení duplicit |

## Výsledek

- Admin může jedním kliknutím najít všechny duplicitní stroje
- Vidí kde je každý stroj použit (cviky, posilovny)
- Může zvolit primární stroj a sloučit ostatní
- Reference z `exercises.machine_id` a `gym_machines` se přesměrují
- **`secondary_machine_id` zůstane beze změny**
- Duplicitní záznamy se smažou

