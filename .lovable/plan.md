

# Oprava fullscreen galerie fotek

## Problém

Když kliknu na fotku v detailu posilovny, galerie se otevře "za" ostatním obsahem místo úplně navrchu. To je způsobeno tím, že:

1. `GymPhotoViewer` používá `Dialog` s defaultním `z-50`
2. Ale rodičovský `Drawer` (detail posilovny) má `z-[100]`
3. Dialog se tedy zobrazuje za Drawerem

## Řešení

Zvýšit z-index pro `DialogContent` v `GymPhotoViewer` na hodnotu vyšší než Drawer (např. `z-[200]`).

---

## Technické změny

### Soubor: `src/components/business/GymPhotoViewer.tsx`

Změnit řádek 69 - přidat vyšší z-index do `DialogContent`:

```text
Před:
<DialogContent className="max-w-full h-full w-full p-0 border-0 bg-black/95 [&>button]:hidden">

Po:
<DialogContent className="max-w-full h-full w-full p-0 border-0 bg-black/95 [&>button]:hidden z-[200]">
```

Také potřebujeme zajistit, že overlay (pozadí dialogu) má také vyšší z-index. Radix Dialog používá `DialogOverlay` s `z-50`. Protože `DialogContent` používá `DialogPortal`, který renderuje obsah mimo DOM strom, musíme také předat vyšší z-index pro overlay.

Nejjednodušší řešení je použít vlastní overlay styl přímo v komponentě:

```typescript
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="max-w-full h-full w-full p-0 border-0 bg-black/95 [&>button]:hidden z-[200] fixed inset-0">
```

---

## Soubor ke změně

| Soubor | Změna |
|--------|-------|
| `src/components/business/GymPhotoViewer.tsx` | Přidat `z-[200]` do className |

---

## Výsledek

Po této změně se fullscreen galerie fotek bude zobrazovat úplně navrchu, před všemi ostatními prvky, včetně Draweru. Uživatel uvidí:
- Fullscreen tmavé pozadí
- Fotku uprostřed
- Šipky vlevo/vpravo pro navigaci
- Křížek vpravo nahoře pro zavření
- Indikátor pozice (1/7)

