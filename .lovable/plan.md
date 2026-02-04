
# Oprava viditelnosti navigace ve fullscreen galerii

## Identifikovaný problém

Po testování v prohlížeči jsem zjistil, že:

1. **Křížek a šipky nejsou viditelné** - browser observe potvrdil, že v dialogu existuje pouze počítadlo (1/1) a obrázek, ale tlačítko pro zavření není viditelné
2. **Carousel div překrývá navigační prvky** - carousel má `h-full` a `overflow-hidden`, což vytváří stacking context a může překrývat absolutně pozicované prvky

## Příčina

V `GymPhotoViewer.tsx`:
- Carousel div (`<div ref={emblaRef}>`) má plnou výšku a zabírá celý prostor dialogu
- Absolutně pozicované prvky (křížek, šipky, počítadlo) jsou uvnitř `DialogContent`, ale carousel je také uvnitř
- I když mají navigační prvky `z-[60]`, carousel div bez explicitního z-indexu může vytvořit překrytí

## Řešení

Přidat explicitní z-index na carousel div, aby byl "pod" navigačními prvky:

1. Carousel div: `z-[10]` (nízký, protože je to pozadí)
2. Navigační prvky zůstanou na `z-[60]` (vysoký, protože mají být viditelné)

### Alternativně (bezpečnější):

Přesunout navigační prvky **mimo** carousel strukturu a zajistit, že jsou na stejné úrovni jako DialogContent children, s explicitními z-indexy.

---

## Technické změny

### Soubor: `src/components/business/GymPhotoViewer.tsx`

**Přidat z-index na carousel kontejner (řádek 87):**

```typescript
// Před:
<div ref={emblaRef} className="overflow-hidden h-full flex items-center">

// Po:
<div ref={emblaRef} className="overflow-hidden h-full flex items-center relative z-[10]">
```

A také přidat `pointer-events-none` na carousel wrapper aby nekradl kliknutí:

```typescript
// Celá struktura:
<div ref={emblaRef} className="overflow-hidden h-full flex items-center z-[10]">
  <div className="flex h-full">
    {allImages.map((url, index) => (
      <div key={index} className="flex-none w-full h-full flex items-center justify-center p-4">
        <img src={url} alt={`Photo ${index + 1}`} className="max-w-full max-h-full object-contain" />
      </div>
    ))}
  </div>
</div>
```

A na navigační prvky přidat `pointer-events-auto` pro jistotu:

```typescript
// Křížek:
<button
  onClick={() => onOpenChange(false)}
  className="absolute top-4 right-4 z-[60] p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors pointer-events-auto"
>
```

---

## Soubor ke změně

| Soubor | Změna |
|--------|-------|
| `src/components/business/GymPhotoViewer.tsx` | Přidat z-index na carousel, pointer-events na tlačítka |

---

## Výsledek

Po úpravě:
- Carousel bude mít nízký z-index (10), takže bude "pod" navigačními prvky
- Navigační prvky (křížek, šipky, počítadlo, tečky) budou mít z-index 60 a budou viditelné nad fotkami
- Vše bude klikatelné a funkční
