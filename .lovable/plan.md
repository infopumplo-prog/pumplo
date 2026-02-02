
# Oprava kategorizace vybavení v databázi

## Problém
Uživatel vybírá preferenci vybavení v dotazníku (Stroje / Volné váhy / Vlastní váha), ale systém **nedokáže správně prioritizovat cviky**, protože:

- **Algoritmus je správný**: Hledá `barbell`, `dumbbell`, `kettlebell` pro volné váhy
- **Databáze je špatná**: Všechny cviky s vybavením mají `equipment_type = 'machine'`

### Příklad:
| Cvik | machine_id → | equipment_type |
|------|--------------|----------------|
| Barbell Bent Over Row | Barbell | `machine` ❌ |
| Dumbbell RDL Stretch | Dumbbells | `machine` ❌ |

---

## Řešení

### 1. Definovat mapování strojů na typy vybavení

Stroje v `machines` tabulce lze rozdělit do kategorií:

| Kategorie | Příklady strojů |
|-----------|-----------------|
| `barbell` | Barbell, Barbell 20kg, EZ bar |
| `dumbbell` | Dumbbells, Dumbbell zóna |
| `kettlebell` | Kettlebell, Kettlebells 4-22kg |
| `cable` | Cable crossover, Cable Fly, Cable Row, cable station |
| `plate_loaded` | Chest Press plate-loaded, Dips machine plate-loaded |
| `machine` | Leg press, Chest press machine, Smith machine |

### 2. Aktualizovat exercises.equipment_type

Spustit SQL migrace, které nastaví správný `equipment_type` podle `machine_id`:

```sql
-- Barbell cviky
UPDATE exercises SET equipment_type = 'barbell'
WHERE machine_id IN (
  SELECT id FROM machines 
  WHERE name ILIKE '%barbell%' OR name ILIKE 'ez bar'
);

-- Dumbbell cviky  
UPDATE exercises SET equipment_type = 'dumbbell'
WHERE machine_id IN (
  SELECT id FROM machines 
  WHERE name ILIKE '%dumbbell%'
);

-- Kettlebell cviky
UPDATE exercises SET equipment_type = 'kettlebell'
WHERE machine_id IN (
  SELECT id FROM machines 
  WHERE name ILIKE '%kettlebell%'
);

-- Cable cviky
UPDATE exercises SET equipment_type = 'cable'
WHERE machine_id IN (
  SELECT id FROM machines 
  WHERE name ILIKE '%cable%' OR name ILIKE '%pulley%'
);

-- Plate-loaded stroje
UPDATE exercises SET equipment_type = 'plate_loaded'
WHERE machine_id IN (
  SELECT id FROM machines 
  WHERE name ILIKE '%plate-loaded%' OR name ILIKE '%plate loaded%'
);
```

### 3. Rozšířit algoritmus o další kategorie

Aktualizovat `matchesEquipmentPreference()` v `selectionAlgorithm.ts`:

```typescript
if (preference === 'free_weights') {
  return ['barbell', 'dumbbell', 'kettlebell', 'ez_bar', 'hex_bar'].includes(exType);
}
```

---

## Změny v souborech

| Soubor | Změna |
|--------|-------|
| SQL migrace | UPDATE exercises.equipment_type podle machine_id |
| `src/lib/selectionAlgorithm.ts` | Rozšířit mapování kategorií (volitelně) |
| `src/lib/equipmentTypes.ts` | Přidat chybějící typy do labels (již částečně hotovo) |

---

## Datový tok po opravě

```text
PREFERENCE "VOLNÉ VÁHY":
┌──────────────────────────────────────────────────────────────┐
│  Uživatel: equipment_preference = 'free_weights'             │
│       ↓                                                      │
│  matchesEquipmentPreference()                                │
│       ↓                                                      │
│  Hledá: equipment_type IN ('barbell','dumbbell','kettlebell')│
│       ↓                                                      │
│  Databáze: Barbell Bench Press (equipment_type='barbell')    │
│       ↓                                                      │
│  +5 bonus → vyšší priorita oproti machine cvikům            │
└──────────────────────────────────────────────────────────────┘

PREFERENCE "STROJE":
┌──────────────────────────────────────────────────────────────┐
│  Uživatel: equipment_preference = 'machines'                 │
│       ↓                                                      │
│  matchesEquipmentPreference()                                │
│       ↓                                                      │
│  Hledá: equipment_type IN ('machine','cable','plate_loaded') │
│       ↓                                                      │
│  Databáze: Chest Press Machine (equipment_type='machine')    │
│       ↓                                                      │
│  +5 bonus → vyšší priorita oproti free weights cvikům       │
└──────────────────────────────────────────────────────────────┘
```

---

## Očekávaný výsledek

1. **Správná prioritizace** - Cviky odpovídající preferenci získají +5 bodů
2. **Variabilita zachována** - Pokud gym nemá preferovaný typ, použije se dostupný
3. **Fallback logika** - Bodyweight zůstává jako poslední možnost (F4)

---

## Technická poznámka

Aktualizace bude provedena pomocí SQL příkazů na databázi. Algoritmus v kódu už je správně připravený a po aktualizaci databáze bude fungovat.
