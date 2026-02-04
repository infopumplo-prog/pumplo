
# Nový design interakce s posilovnou na mapě

## Přehled změn

Podle mockupů z Figma bude interakce s posilovnou rozdělena do dvou kroků:

### 1. Quick Preview Card (kompaktní náhled)
Když uživatel klikne na marker posilovny na mapě, zobrazí se kompaktní karta nad mapou:

```text
┌─────────────────────────────────────────────┐
│ ┌─────┐                                     │
│ │LOGO │  Athletics                          │
│ │     │  Ulice 12, Praha, 110 00    15 km   │
│ └─────┘  Otevřeno 9:00-21:00 (zelená)       │
├─────────────────────────────────────────────┤
│   [    DETAIL    ]  [   NAVIGACE    ]       │
└─────────────────────────────────────────────┘
```

**Obsah:**
- Logo posilovny (čtvercové)
- Název posilovny
- Adresa + vzdálenost od uživatele
- Otevírací doba pro dnešní den (zelená = otevřeno, červená = zavřeno)
- Tlačítko DETAIL → otevře fullscreen drawer
- Tlačítko NAVIGACE → otevře Google Maps navigaci

### 2. Fullscreen Detail Drawer
Po kliknutí na "DETAIL" se otevře velký drawer:

```text
┌───────────────────────────────────────┐
│ ←     [   GALERIE FOTEK   ]       ⋮  │
│              ● ○ ○                    │
├───────────────────────────────────────┤
│                                       │
│   Athletics                           │
│   📍 Ulice 12, Praha, 110 00          │
│                                       │
│   Lorem ipsum dolor sit amet...       │
│                                       │
│   [     ZAHÁJIT TRÉNINK     ]         │
│                                       │
│   PŘEHLED | STROJE | CENÍK | TRENÉŘI  │
│   ─────────                           │
│                                       │
│   🕐 Otevřeno • 9:00 - 21:00  ∨       │
│   📊 Průměrná návštěvnost             │
│                                       │
└───────────────────────────────────────┘
```

---

## Technické řešení

### Nová komponenta `GymQuickPreview.tsx`
Kompaktní karta pro rychlý náhled:
- Přijímá: gym, distance, userLocation, onDetailClick, onNavigateClick
- Zobrazuje logo, název, adresu, vzdálenost, otevírací dobu
- Dvě tlačítka s primární barvou (zelená)

### Upravená komponenta `GymProfilePreview.tsx`
Rozšíření pro fullscreen drawer:
- Přidat taby (Přehled, Stroje, Ceník, Trenéři)
- Tab "Stroje" - už existující seznam vybavení
- Tab "Ceník" a "Trenéři" - zatím placeholder
- Vylepšená sekce otevírací doby s rozbalovacím menu
- Tlačítko "Zahájit trénink" místo "Vybrat pro trénink"

### Úpravy v `Map.tsx`
1. Přidat stav `showQuickPreview` - zobrazit quick preview kartu
2. Přidat stav `showFullDetail` - zobrazit fullscreen drawer
3. Klik na marker → `showQuickPreview = true`
4. Klik na "DETAIL" → `showFullDetail = true`, `showQuickPreview = false`
5. Klik na "NAVIGACE" → otevřít Google Maps s navigací

### Funkce navigace
```typescript
const openNavigation = (gym: PublicGym) => {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${gym.latitude},${gym.longitude}`;
  window.open(url, '_blank');
};
```

---

## Struktura souborů

| Soubor | Akce |
|--------|------|
| `src/components/map/GymQuickPreview.tsx` | Nová komponenta - kompaktní karta |
| `src/components/business/GymProfilePreview.tsx` | Přidat taby a vylepšit layout |
| `src/pages/Map.tsx` | Upravit interakci (quick preview → detail) |

---

## UI detaily

### Quick Preview Card
- Pozice: Fixně nad spodním drawerem se seznamem
- Stín a zaoblené rohy
- Animace: fade-in při zobrazení
- Zavření: kliknutím mimo nebo na X

### Fullscreen Detail
- Zabírá 90% výšky obrazovky
- Zpětná šipka v levém horním rohu
- Galerie fotek s karuselem (už existuje)
- Taby pro přepínání mezi sekcemi

### Barvy tlačítek
- DETAIL: zelená (bg-primary)
- NAVIGACE: zelená (bg-primary)
- ZAHÁJIT TRÉNINK: zelená (bg-primary)

---

## Výsledek

1. Rychlý přehled posilovny po kliknutí na marker
2. Možnost okamžité navigace do posilovny
3. Detailní pohled s taby pro více informací
4. Konzistentní design podle Figma mockupů
5. Lepší UX - uživatel vidí klíčové info bez otevírání celého detailu
