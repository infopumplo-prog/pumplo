

# Obnovení stroje Adductor machine a oprava cviku

## Situace

Adductor a Abductor jsou **dva různé stroje**:

| Stroj | Pohyb | Svaly | Stav |
|-------|-------|-------|------|
| **Abductor machine** | Odtahování nohou | outer_thighs, glutes | ✅ Existuje |
| **Adductor machine** | Přitahování nohou | inner_thighs | ❌ Smazán |

## Plán opravy

### Krok 1: Vytvořit nový stroj "Adductor machine"

Vložíme nový záznam do tabulky `machines`:

```sql
INSERT INTO machines (name, equipment_category, is_cardio)
VALUES ('Adductor machine', 'machine', false);
```

### Krok 2: Přiřadit machine_id ke cviku

Aktualizujeme cvik "Seated Machine Hip Adductor":

```sql
UPDATE exercises 
SET machine_id = (SELECT id FROM machines WHERE name = 'Adductor machine')
WHERE id = '057456ba-c06b-48a6-b36c-57e94c887d01';
```

## Výsledek

Po opravě:

| Cvik | machine_id | Stroj |
|------|-----------|-------|
| Seated Hip Abductor Machine | `79820aad...` | Abductor machine |
| Seated Machine Hip Adductor | `{nové ID}` | Adductor machine ✅ |

## Implementace

Provedu SQL příkazy přes insert tool pro:
1. Vytvoření stroje "Adductor machine"
2. Přiřazení jeho ID ke cviku "Seated Machine Hip Adductor"

