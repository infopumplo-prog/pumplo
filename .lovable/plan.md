

# Oprava UI šablon tréninků

## Problem

1. **Chybí označení cíle** — 4 řádky na slot vypadají identicky, není vidět který patří strength/muscle_gain/fat_loss/general_fitness
2. **Inputy B/I/A nefungují** — pravděpodobně problém s `onChange` handlerem (parsuje `parseInt` a prázdný string vrátí `NaN`/`0`)
3. **UI je nepřehledné** pro komunikaci s trenérem

## Řešení

### Soubor: `src/pages/admin/DayTemplatesManagement.tsx`

#### 1. Přidat štítek cíle ke každému řádku

Ke každému slotu přidat barevný badge s názvem cíle:
- strength = fialový badge
- muscle_gain = modrý badge  
- fat_loss = oranžový badge
- general_fitness = zelený badge

#### 2. Seskupit řádky vizuálně podle slot_order

Oddělit skupiny slotů (4 řádky se stejným `slot_order`) vizuálním separátorem, aby bylo jasné že patří k jednomu cviku.

#### 3. Opravit inputy B/I/A

Změnit `onChange` handler aby správně zpracovával prázdné hodnoty a umožnil editaci:
- Prázdný input = dočasně `''` (ne `0`)
- Při uložení se validuje na číslo

#### 4. Přidat zobrazení rep range

Aktuální hodnoty `rep_min` a `rep_max` z DB zobrazit v inputech (teď jsou prázdné protože mají `value={slot.rep_min ?? ''}` ale data tam jsou).

### Výsledek

Každý slot bude vypadat takto:
```
#1  Drep  [strength]   B: 3  I: 4  A: 5  | 4 - 6
#1  Drep  [muscle]     B: 3  I: 3  A: 4  | 8 - 12
#1  Drep  [fat_loss]   B: 3  I: 3  A: 3  | 10 - 15
#1  Drep  [kondice]    B: 3  I: 3  A: 3  | 10 - 12
───────────────────────────────────────────
#2  Horiz. tlak  [strength]   B: 3  I: 4  A: 5  | 4 - 6
...
```

Trenér tak uvidí celou strukturu dne a může ověřit:
- Pořadí cviků (role ve slotech)
- Objemy podle úrovně (B/I/A série)
- Rozsahy opakování podle cíle

