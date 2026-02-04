
# Oprava viditelnosti křížku ve fullscreen galerii

## Identifikovaný problém

Po důkladném testování v prohlížeči a analýze kódu jsem našel **přesnou příčinu**:

V `GymPhotoViewer.tsx` používám CSS selektor `[&>button]:hidden` na DialogContent. Tento selektor skrývá **VŠECHNY** buttony, které jsou přímými potomky DialogContent - včetně mého vlastního close button!

```typescript
// Aktuálně v GymPhotoViewer.tsx (řádek 70):
className="... [&>button]:hidden ..."

// To způsobuje:
// - Skryje výchozí Radix Close button (správně)
// - Skryje i MŮJ custom close button (ŠPATNĚ!)
```

## Řešení

Zabalit navigační prvky (close button, counter, arrows, dots) do wrapper `<div>`, který NENÍ typu `<button>`. Tím se stanou potomky divu, ne DialogContent, a nebudou skryty selektorem `[&>button]:hidden`.

Struktura před:
```text
DialogContent
├── button (close) ← skrytý [&>button]:hidden
├── div (counter)
├── div (carousel)
├── button (prev arrow) ← skrytý
├── button (next arrow) ← skrytý
└── div (dots)
```

Struktura po:
```text
DialogContent
├── div (navigation wrapper)
│   ├── button (close) ← VIDITELNÝ
│   ├── div (counter)
│   ├── button (prev arrow) ← VIDITELNÝ
│   ├── button (next arrow) ← VIDITELNÝ
│   └── div (dots)
└── div (carousel)
```

---

## Technické změny

### Soubor: `src/components/business/GymPhotoViewer.tsx`

**Zabalit všechny navigační prvky do wrapperu (řádky 73-139):**

```typescript
{/* Navigation wrapper - aby button nebyl přímým potomkem DialogContent */}
<div className="contents">
  {/* Close button */}
  <button
    onClick={() => onOpenChange(false)}
    className="absolute top-4 left-4 z-[60] p-2.5 rounded-full bg-white/20 hover:bg-white/30 border border-white/40 transition-colors pointer-events-auto"
  >
    <X className="w-6 h-6 text-white" />
  </button>

  {/* Photo counter */}
  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] text-white text-sm bg-black/50 px-3 py-1 rounded-full">
    {selectedIndex + 1} / {allImages.length}
  </div>

  {/* Navigation arrows - taky uvnitř wrapperu */}
  {allImages.length > 1 && (
    <>
      <button onClick={scrollPrev} className="...">...</button>
      <button onClick={scrollNext} className="...">...</button>
    </>
  )}

  {/* Dot indicators */}
  {allImages.length > 1 && (
    <div className="...">...</div>
  )}
</div>
```

Použití `className="contents"` zajistí, že wrapper div neovlivní layout - jeho děti se budou chovat jako by wrapper neexistoval, ale přitom nebudou přímými potomky DialogContent.

---

## Soubor ke změně

| Soubor | Změna |
|--------|-------|
| `src/components/business/GymPhotoViewer.tsx` | Zabalit navigační prvky do wrapper divu s `className="contents"` |

---

## Očekávaný výsledek

Po úpravě:
- Selektor `[&>button]:hidden` skryje pouze výchozí Radix Close button (který je přímým potomkem)
- Můj custom close button bude potomkem wrapper divu → nebude skrytý → BUDE VIDITELNÝ
- Stejně tak navigační šipky budou viditelné
- Layout zůstane nezměněný díky `contents`
