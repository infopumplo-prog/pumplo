

# Přidání viditelného křížku pro zavření galerie

## Problém

Křížek pro zavření galerie není viditelný. Ze screenshotu vidím, že:
1. Křížek má příliš průhledné pozadí (`bg-white/10`) a na tmavém pozadí splývá
2. Pozice může být překrytá nebo mimo viditelnou oblast

## Řešení

Udělám křížek výrazně viditelnější a umístím ho do **levého horního rohu** - to je intuitivnější pro mobilní zařízení (snadněji dosažitelné palcem při držení telefonu pravou rukou).

---

## Technické změny

### Soubor: `src/components/business/GymPhotoViewer.tsx`

**Změna křížku (řádky 73-79):**

```text
Před:
{/* Close button */}
<button
  onClick={() => onOpenChange(false)}
  className="absolute top-4 right-4 z-[60] p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors pointer-events-auto"
>
  <X className="w-6 h-6 text-white" />
</button>

Po:
{/* Close button - levý horní roh, výraznější */}
<button
  onClick={() => onOpenChange(false)}
  className="absolute top-4 left-4 z-[60] p-2.5 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 transition-colors pointer-events-auto"
>
  <X className="w-6 h-6 text-white" />
</button>
```

Změny:
- **Pozice**: z `right-4` na `left-4` (levý horní roh - intuitivnější na mobilu)
- **Pozadí**: z `bg-white/10` na `bg-black/60` (výrazně tmavší, lépe viditelné)
- **Rámeček**: přidán `border border-white/20` pro lepší kontrast
- **Padding**: zvětšen z `p-2` na `p-2.5` pro snadnější kliknutí

---

## Soubor ke změně

| Soubor | Změna |
|--------|-------|
| `src/components/business/GymPhotoViewer.tsx` | Přesunout křížek do levého rohu, zvýšit viditelnost |

---

## Výsledek

Křížek bude:
- V levém horním rohu obrazovky
- Výrazně viditelný s tmavým poloprůhledným pozadím
- Větší hit area pro snadné kliknutí
- Jemný bílý rámeček pro lepší kontrast

