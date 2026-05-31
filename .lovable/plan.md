

# Oprava chyby generování tréninku (ambiguous relationship)

## Problem

Dotaz na cviky v plánu (`useWorkoutPlan.ts`, řádek 127) používá:
```
exercises (id, name, video_path, machine_id, machines (name))
```

Tabulka `exercises` má ale DVA cizí klíče na tabulku `machines`:
- `exercises_machine_id_fkey` (hlavní stroj)
- `exercises_secondary_machine_id_fkey` (sekundární stroj)

PostgREST neví, kterou relaci použít, a vrací chybu **300** (Multiple Choices). Kvůli tomu se cviky nenačtou a plán se tváří jako neexistující -- proto se zobrazuje "Vytvoř si plán" místo aktuálního plánu.

## Řešení

### Soubor: `src/hooks/useWorkoutPlan.ts` (řádek 127)

Změna z:
```
exercises (id, name, video_path, machine_id, machines (name))
```

Na:
```
exercises (id, name, video_path, machine_id, machines!exercises_machine_id_fkey (name))
```

Tím se explicitně specifikuje, že chceme relaci přes `machine_id`, ne přes `secondary_machine_id`.

## Rozsah

Jeden soubor, jeden řádek. Žádná změna logiky, jen disambiguace PostgREST dotazu.
