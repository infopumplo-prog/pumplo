
# Úpravy Quick Preview karty a navigace

## Požadované změny

Ze screenshotů a popisu chceš tři věci:
1. **Adresa + vzdálenost na jednom řádku** - Když je adresa příliš dlouhá, ořízne se "..." a za ní bude vzdálenost
2. **Odstranit křížek** - Zavírací tlačítko v rohu karty nepotřebuješ
3. **Nativní navigace** - Tlačítko "Navigace" otevře výchozí mapovou aplikaci telefonu (Apple Maps, Google Maps, Waze...)

---

## Technické změny

### 1. Soubor: `src/components/map/GymQuickPreview.tsx`

**Odstranění close button (řádky 35-41):**
Kompletně odstraním tlačítko s ikonou X a import `X` z lucide-react.

**Nový layout pro adresu + vzdálenost:**
```typescript
// Místo oddělených řádků pro adresu a vzdálenost:
{gym.address && (
  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
    <MapPin className="w-3 h-3 shrink-0" />
    <span className="truncate">{gym.address}</span>
    {distance !== undefined && (
      <span className="shrink-0 text-primary font-medium">
        {formatDistance(distance)}
      </span>
    )}
  </div>
)}
```

Klíčové třídy:
- `truncate` na adrese → ořízne s "..."
- `shrink-0` na vzdálenosti → nikdy se nezmenší, vždy viditelná
- `text-primary font-medium` → vzdálenost je zvýrazněná (jako ve Figma návrhu - modře)

**Odstranit původní zobrazení vzdálenosti** v názvu (řádky 65-69).

### 2. Soubor: `src/pages/Map.tsx`

**Vylepšená funkce pro nativní navigaci (řádky 37-41):**
```typescript
const openNavigation = (gym: PublicGym) => {
  const { latitude, longitude } = gym;
  
  // Detekce iOS zařízení
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  // iOS: geo: schéma otevře systémový dialog s výběrem aplikace
  // Android: geo: schéma otevře výchozí mapovou aplikaci
  const geoUrl = `geo:${latitude},${longitude}?q=${latitude},${longitude}`;
  
  // Fallback pro web nebo pokud geo: selže
  const webUrl = isIOS 
    ? `https://maps.apple.com/?daddr=${latitude},${longitude}`
    : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  
  // Nejdřív zkusit geo: schéma (funguje na mobilech)
  const link = document.createElement('a');
  link.href = geoUrl;
  link.click();
  
  // Fallback po krátké době pokud se nic neotevřelo
  setTimeout(() => {
    window.open(webUrl, '_blank');
  }, 500);
};
```

**Jednodušší varianta** (preferovaná - spolehlivější):
```typescript
const openNavigation = (gym: PublicGym) => {
  const { latitude, longitude } = gym;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  // iOS: Apple Maps link automaticky otevře Apple Maps nebo nabídne alternativy
  // Android/ostatní: Google Maps link otevře výchozí app nebo browser
  const url = isIOS 
    ? `https://maps.apple.com/?daddr=${latitude},${longitude}`
    : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  
  window.open(url, '_blank');
};
```

---

## Soubory ke změně

| Soubor | Změna |
|--------|-------|
| `src/components/map/GymQuickPreview.tsx` | Odstranit close button, změnit layout adresy + vzdálenosti |
| `src/pages/Map.tsx` | Implementovat nativní navigaci s detekcí iOS/Android |

---

## Výsledek

Po úpravách:
- Karta bude čistější bez rušivého křížku
- Adresa a vzdálenost budou vedle sebe (jak ve Figma návrhu)
- Kliknutí na "Navigace" otevře:
  - **iPhone**: Apple Maps (nebo výchozí nastavená aplikace)
  - **Android**: Google Maps, Waze nebo jinou výchozí mapovou aplikaci
  - **Desktop**: Webovou verzi map v novém tabu
