

# Přidání tlačítka "Začít trénink" na domovskou stránku

## Problém
Na domovské stránce chybí rychlé tlačítko pro zahájení tréninku. Bylo pravděpodobně omylem odstraněno při předchozích úpravách.

## Řešení
Přidat výrazné tlačítko "Začít trénink" **pod sekci "Nadcházející tréninky"** na domovské stránce.

## Návrh UI

```text
Nadcházející tréninky                     [Vše >]
┌─────────────────────────────────────────────────────┐
│  [A]  Pondělí                           Dnes       │
│       Push                                          │
├─────────────────────────────────────────────────────┤
│  [B]  Středa                                        │
│       Pull                                          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│          [▶ ZAČÍT TRÉNINK]  ◄── NOVÉ TLAČÍTKO      │
└─────────────────────────────────────────────────────┘
```

## Změny v kódu

| Soubor | Změna |
|--------|-------|
| `src/pages/Home.tsx` | Přidat tlačítko "Začít trénink" za sekci s nadcházejícími tréninky (cca řádek 340) |

## Technické detaily

1. Přidat novou `motion.div` sekci s tlačítkem za mapováním `schedule.slice(0, 4).map(...)`
2. Tlačítko bude:
   - Plné šířky s ikonou `Play` 
   - Gradient pozadí pro výraznost
   - Navigovat na `/training` při kliknutí
3. Tlačítko se zobrazí pouze pokud:
   - Existuje aktivní plán (`plan` je truthy)
   - Dnešní trénink NEBYL dokončen (`!wasCompletedToday`)

## Poznámka k datům
Tréninky z neděle jsou v databázi v pořádku - nejsou smazané. Historii všech tréninků najdeš v profilu → Historie tréninků.

