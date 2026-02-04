
# Úpravy detailu posilovny

## Přehled změn

1. Odstranění tabu "Trenéři" z profilu posilovny
2. Rozdělení vybavení do podkategorií "Stroje" a "Volné váhy"
3. Kliknutelná galerie fotek s fullscreen prohlížením

---

## 1. Odstranění tabu "Trenéři"

### Soubor: `GymDetailTabs.tsx`

- Změnit grid z `grid-cols-4` na `grid-cols-3`
- Odstranit tab trigger "Trenéři"
- Odstranit tab content pro "trainers"
- Odstranit import ikony `Users` (používá se i v attendance, takže zůstane)

---

## 2. Kategorizace strojů

### Logika kategorizace

Protože tabulka `machines` nemá sloupec pro kategorii, rozdělíme stroje podle klíčových slov v názvu:

**Volné váhy** (klíčová slova):
- `barbell`, `dumbbell`, `kettlebell`, `činka`, `jednoručka`, `olymp`

**Stroje** (vše ostatní):
- Lat pulldown, cable, press machine, atd.

### Implementace v `GymDetailTabs.tsx`

```typescript
const FREE_WEIGHT_KEYWORDS = [
  'barbell', 'dumbbell', 'kettlebell', 'činka', 
  'jednoručka', 'olymp', 'osa', 'kotouč'
];

const isFreeWeight = (machineName: string) => {
  const name = machineName.toLowerCase();
  return FREE_WEIGHT_KEYWORDS.some(kw => name.includes(kw));
};

// Rozdělení do kategorií
const freeWeights = machines.filter(m => isFreeWeight(m.machine?.name || ''));
const machineEquipment = machines.filter(m => !isFreeWeight(m.machine?.name || ''));
```

### UI v tabu "Stroje"

```text
┌─────────────────────────────────────┐
│ 🏋️ STROJE (5)                       │
│ ┌─────────────────────────────────┐ │
│ │ Lat pulldown narrow             │ │
│ │ Leg press                       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 💪 VOLNÉ VÁHY (3)                   │
│ ┌─────────────────────────────────┐ │
│ │ Barbell               2×        │ │
│ │ Kettlebell            10×       │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## 3. Fullscreen galerie fotek

### Nová komponenta: `GymPhotoViewer.tsx`

Dialog/modal pro fullscreen prohlížení galerie:

```text
┌─────────────────────────────────────────┐
│ ←                              × (zavřít)│
├─────────────────────────────────────────┤
│                                         │
│          [FULLSCREEN FOTKA]             │
│                                         │
├─────────────────────────────────────────┤
│     ◄          2/5           ►          │
│               ● ○ ○ ○ ○                 │
└─────────────────────────────────────────┘
```

**Funkce:**
- Fullscreen dialog (zabírá celou obrazovku)
- Swipe/šipky pro navigaci mezi fotkami
- Indikátor pozice (2/5)
- Tlačítko zavřít (X)
- Tmavé pozadí pro lepší zobrazení fotek

### Úprava `GymPhotoGallery.tsx`

Přidat props pro kliknutelnost:

```typescript
interface GymPhotoGalleryProps {
  photos: GymPhoto[];
  fallbackCoverUrl?: string | null;
  className?: string;
  clickable?: boolean;  // nové
  onPhotoClick?: (index: number) => void;  // nové
}
```

Obalit fotky do kliknutelného prvku, který otevře fullscreen viewer.

### Úprava `GymProfilePreview.tsx`

Přidat stav pro otevření galerie a integrovat `GymPhotoViewer`:

```typescript
const [galleryOpen, setGalleryOpen] = useState(false);
const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

// V JSX:
<GymPhotoGallery 
  photos={photos} 
  clickable={true}
  onPhotoClick={(index) => {
    setSelectedPhotoIndex(index);
    setGalleryOpen(true);
  }}
/>

<GymPhotoViewer
  photos={photos}
  fallbackCoverUrl={gym.cover_photo_url}
  open={galleryOpen}
  onOpenChange={setGalleryOpen}
  initialIndex={selectedPhotoIndex}
/>
```

---

## Soubory ke změně/vytvoření

| Soubor | Akce |
|--------|------|
| `src/components/business/GymDetailTabs.tsx` | Odstranit tab Trenéři, přidat kategorizaci strojů |
| `src/components/business/GymPhotoGallery.tsx` | Přidat clickable props |
| `src/components/business/GymPhotoViewer.tsx` | **Nový** - fullscreen galerie dialog |
| `src/components/business/GymProfilePreview.tsx` | Integrovat fullscreen viewer |

---

## Výsledek

1. Tab "Trenéři" bude odstraněn - zůstanou 3 taby (Přehled, Stroje, Ceník)
2. Vybavení bude rozděleno do dvou sekcí - "Stroje" a "Volné váhy"
3. Kliknutím na fotku v profilu se otevře fullscreen galerie s možností procházení všech fotek
