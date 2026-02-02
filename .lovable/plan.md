

# Oprava kategorizace resistance bands

## Problém
Cviky s resistance bands mají v databázi `equipment_type = 'machine'`, ale měly by být kategorizovány jako volné váhy (`resistance_band`).

### Aktuální stav:
| Cvik | Machine | equipment_type |
|------|---------|----------------|
| Band Bent Over Row | Resistance band with handles | `machine` ❌ |
| Band Deadlift | Resistance band with handles | `machine` ❌ |

### Algoritmus je už správně nastaven:
- `cable` je pod `machines` ✅
- Potřebujeme jen přidat `resistance_band` pod `free_weights`

---

## Řešení

### 1. Aktualizovat databázi - přiřadit resistance bands správný typ

```sql
UPDATE exercises SET equipment_type = 'resistance_band'
WHERE machine_id IN (
  SELECT id FROM machines 
  WHERE name ILIKE '%band%' OR name ILIKE '%resistance%'
);
```

### 2. Rozšířit algoritmus o resistance_band kategorizaci

**Soubor: `src/lib/selectionAlgorithm.ts`**

Aktualizovat `matchesEquipmentPreference()`:

```typescript
if (preference === 'free_weights') {
  return ['barbell', 'dumbbell', 'kettlebell', 'resistance_band'].includes(exType);
}
```

---

## Změny

| Soubor/Akce | Změna |
|-------------|-------|
| SQL UPDATE | Změnit `equipment_type` na `resistance_band` pro cviky s gumy |
| `src/lib/selectionAlgorithm.ts` | Přidat `resistance_band` do `free_weights` kategorie |

---

## Výsledná kategorizace

| Preference uživatele | Zahrnuje equipment_type |
|---------------------|-------------------------|
| **Stroje** | `machine`, `cable`, `plate_loaded` |
| **Volné váhy** | `barbell`, `dumbbell`, `kettlebell`, `resistance_band` |
| **Vlastní váha** | `bodyweight` |

---

## Očekávaný výsledek

Po této změně:
- Uživatel s preferencí "Volné váhy" dostane +5 bonus pro cviky s odporovými gumami
- Uživatel s preferencí "Stroje" bude správně preferovat cable machine cviky (už funguje)
- Lepší rozlišení vybavení pro přesnější výběr cviků

