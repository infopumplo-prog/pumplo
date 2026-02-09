

# Oprava stránky Šablony tréninků

## Problem

Stránka `/admin/templates` je prázdná, protože kód filtruje podle split typů `FB_AB`, `UL_AB`, `PPL_ABC`, ale v databázi jsou hodnoty `full_body`, `upper_lower`, `ppl`.

## Oprava

### Soubor: `src/pages/admin/DayTemplatesManagement.tsx`

Jediná změna -- opravit konstantu `SPLIT_TYPES` na řádku 36:

```
// Bylo:
const SPLIT_TYPES = ['FB_AB', 'UL_AB', 'PPL_ABC'];

// Bude:
const SPLIT_TYPES = ['full_body', 'upper_lower', 'ppl'];
```

Po této opravě se zobrazí všech 112 slotů seskupených do 3 split typů a 7 dnů (full_body A/B, upper_lower A/B, ppl A/B/C), každý den s 16 sloty.

### Stránka Rolí

Stránka `/admin/roles` funguje správně. Zobrazuje 26 rolí v 5 kategoriích (Upper 12, Lower 5, Core 6, Compound 1, Cardio 2). Po rozkliknutí role lze editovat:
- **Povolene vybaveni** -- jaký typ vybavení je pro danou roli přijatelný (machine, cable, barbell, dumbbell, kettlebell, bodyweight...)
- **Kontraindikovana zraneni** -- při jakých zraněních se role přeskočí (shoulder, knees, lower_back...)
- **Obtiznost** -- zda je role vhodná pro začátečníky nebo pokročilé
- **Faze** -- zda jde o hlavní cvik, warmup, cooldown nebo doplněk

Toto je potřeba vyplnit pro všech 26 rolí, aby algoritmus správně pároval cviky s vybavením.
