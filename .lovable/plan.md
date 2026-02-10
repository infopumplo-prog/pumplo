

# Oprava nefunkčních inputů B/I/A a opakování

## Problém

Základní `Input` komponenta (`src/components/ui/input.tsx`) má ve výchozích stylech:
- `px-4` (16px padding vlevo + 16px vpravo = 32px)
- `py-3` (12px padding nahoře + dole)
- `h-12` (48px výška)

Inputy v šablonách mají `w-12` (48px šířka) a `h-8` (32px výška). Problém:
- 48px šířka minus 32px padding = **pouze 16px pro text** -- prakticky nelze psát
- Výška `h-8` přepíše `h-12`, ale `py-3` padding zůstává a stlačuje obsah

## Řešení

### Soubor: `src/pages/admin/DayTemplatesManagement.tsx`

Ke všem numerickým inputům (B, I, A, rep_min, rep_max) přidat explicitní override paddingu v `className`:

```
// Změna z:
className="w-12 h-8 text-xs text-center"

// Na:
className="w-14 h-8 text-xs text-center px-1 py-0"
```

Konkrétně:
- `px-1` -- minimální horizontální padding (4px), aby zbylo místo pro čísla
- `py-0` -- žádný vertikální padding, protože `h-8` je malá výška
- `w-14` -- mírně širší (56px místo 48px) pro pohodlnější zadávání

Toto se týká 5 inputů na každém řádku (beginner_sets, intermediate_sets, advanced_sets, rep_min, rep_max).

## Rozsah změn

Pouze jeden soubor, pouze CSS třídy na existujících elementech. Žádná změna logiky.
