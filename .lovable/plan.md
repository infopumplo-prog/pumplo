

# Oprava viditelnosti křížku ve fullscreen galerii

## Identifikovaný problém

Ze screenshotu a kódu jsem zjistil **dva problémy**:

1. **Barva křížku** - Křížek má `bg-black/60` (černé pozadí) na `bg-black/95` (téměř černém) pozadí dialogu - proto splývá a není vidět
2. **CSS specifičnost** - Tailwind nemusí správně přepsat výchozí styly z `dialog.tsx` (`left-[50%]`, `translate-x-[-50%]`) kvůli pořadí tříd

## Řešení

### 1. Změnit barvu křížku na výrazně kontrastní
Místo `bg-black/60` použít `bg-white/20` s hover `bg-white/30` - bílé poloprůhledné tlačítko na tmavém pozadí bude viditelné.

### 2. Použít `!important` modifikátor pro pozicování
Tailwind `!` prefix zajistí přepsání výchozích stylů.

---

## Technické změny

### Soubor: `src/components/business/GymPhotoViewer.tsx`

**DialogContent (řádek 69-71):**
```typescript
// Před:
className="fixed inset-0 max-w-full h-full w-full p-0 border-0 bg-black/95 [&>button]:hidden z-[200] translate-x-0 translate-y-0 left-0 top-0"

// Po - přidat ! modifikátory:
className="!fixed !inset-0 !max-w-full !h-full !w-full !p-0 !border-0 bg-black/95 [&>button]:hidden z-[200] !translate-x-0 !translate-y-0 !left-0 !top-0"
```

**Close button (řádky 74-79):**
```typescript
// Před:
className="absolute top-4 left-4 z-[60] p-2.5 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 ..."

// Po - změnit na bílé poloprůhledné pozadí:
className="absolute top-4 left-4 z-[60] p-2.5 rounded-full bg-white/20 hover:bg-white/30 border border-white/40 ..."
```

**Navigační šipky (řádky 107-118):**
```typescript
// Šipky mají bg-white/10 což je taky málo viditelné
// Zvýšit na bg-white/20 a hover:bg-white/30
```

---

## Změny v souborech

| Soubor | Změna |
|--------|-------|
| `src/components/business/GymPhotoViewer.tsx` | Změnit barvy na kontrastní (bílé), přidat `!important` modifikátory pro pozicování |

---

## Výsledek

Po úpravě:
- **Křížek** bude mít bílé poloprůhledné pozadí (`bg-white/20`) - výrazně kontrastní na černém
- **Šipky** budou taky lépe viditelné
- **Pozicování** bude garantováno díky `!` modifikátorům

