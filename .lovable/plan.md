
# Oprava zobrazení šipek a křížku ve fullscreen galerii

## Problém

Šipky a křížek v `GymPhotoViewer` nejsou viditelné, protože:

1. **Z-index konflikt**: Elementy uvnitř `DialogContent` mají `z-50`, ale rodičovský dialog je na `z-[200]`. Relativní z-indexy uvnitř jsou stále platné, ale kombinace stylů způsobuje problémy.

2. **Pozicování**: Výchozí styl `DialogContent` používá `translate-x-[-50%] translate-y-[-50%]` a `max-w-lg`, což může ořezávat absolutně pozicované elementy.

3. **Přepsání stylů**: V `GymPhotoViewer` používáme `max-w-full h-full w-full`, ale výchozí transformace z `dialog.tsx` stále přetrvává a může způsobovat problémy s pozicováním.

---

## Řešení

Upravit `GymPhotoViewer.tsx`:

1. Přidat `fixed inset-0` pro zajištění fullscreen pozice
2. Přepsat transformace pomocí `translate-x-0 translate-y-0 left-0 top-0`
3. Zvýšit z-index navigačních prvků z `z-50` na `z-[60]` pro jistotu

---

## Technické změny

### Soubor: `src/components/business/GymPhotoViewer.tsx`

**Řádek 69-71** - DialogContent className:
```typescript
// Před:
className="max-w-full h-full w-full p-0 border-0 bg-black/95 [&>button]:hidden z-[200]"

// Po:
className="fixed inset-0 max-w-full h-full w-full p-0 border-0 bg-black/95 [&>button]:hidden z-[200] translate-x-0 translate-y-0"
```

**Řádky 76, 82, 109, 115, 124** - Zvýšit z-index prvků:
```typescript
// Všechny prvky s z-50 změnit na z-[60]:

// Křížek (řádek 76):
className="absolute top-4 right-4 z-[60] p-2 ..."

// Počítadlo fotek (řádek 82):
className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] ..."

// Šipka vlevo (řádek 109):
className="absolute left-4 top-1/2 -translate-y-1/2 z-[60] ..."

// Šipka vpravo (řádek 115):
className="absolute right-4 top-1/2 -translate-y-1/2 z-[60] ..."

// Dot indikátory (řádek 124):
className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[60] flex gap-2"
```

---

## Soubor ke změně

| Soubor | Změna |
|--------|-------|
| `src/components/business/GymPhotoViewer.tsx` | Opravit pozicování a z-indexy |

---

## Výsledek

Po úpravě bude fullscreen galerie zobrazovat:
- Křížek pro zavření v pravém horním rohu
- Šipky vlevo/vpravo pro navigaci mezi fotkami
- Počítadlo fotek nahoře uprostřed (1 / 7)
- Dot indikátory dole

Vše bude viditelné a klikatelné nad fotkami.
