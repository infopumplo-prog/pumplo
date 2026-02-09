
# Oprava problému se starou verzí aplikace (PWA cache)

## Kořenová příčina

Service Worker cachuje `index.html` jako součást precache manifestu. Když se nasadí nová verze:
1. Starý SW stále servíruje starý `index.html` z cache
2. `__BUILD_TIMESTAMP__` v tom starém HTML je taky starý -- takže version check nic nedetekuje
3. SW update check běží jen každých 5 minut a jen pokud tab není skrytý
4. Uživatel musí manuálně kliknout na banner -- pokud ho nevidí, zůstane na staré verzi

## Plán opravy

### 1. Přidat `visibilitychange` listener pro okamžitou kontrolu

Když uživatel přepne zpět do aplikace (např. swipne z jiné appky), okamžitě zkontrolovat SW update -- ne čekat 5 minut.

**Soubor:** `src/main.tsx`

```typescript
// V onRegisteredSW callbacku přidat:
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && registration) {
    console.log('[Main] App became visible, checking for updates...');
    registration.update();
  }
});
```

### 2. Automatický update bez čekání na banner

Změnit chování tak, aby se SW aktivoval okamžitě (bez čekání na klik uživatele). Banner zůstane jen jako notifikace, že se appka refreshne.

**Soubor:** `src/main.tsx` -- v `onNeedRefresh`:

```typescript
onNeedRefresh() {
  console.log('[Main] New version available, auto-updating...');
  // Ukázat banner a automaticky refreshnout po 1.5s
  triggerUpdateBanner();
  setTimeout(() => {
    updateSW(true).catch(() => window.location.reload());
  }, 1500);
},
```

### 3. Přidat `navigationPreload` a NetworkFirst pro HTML

Zajistit, že `index.html` se VŽDY načítá ze sítě (ne z cache).

**Soubor:** `public/sw.js` -- přidat route pro navigační requesty:

```javascript
import { NavigationRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

// HTML navigace - vždy network first
const navigationHandler = new NetworkFirst({
  cacheName: 'navigation-cache',
  networkTimeoutSeconds: 3,
});

registerRoute(
  ({ request }) => request.mode === 'navigate',
  navigationHandler
);
```

### 4. Přidat `Cache-Control` meta tag

Zabránit agresivnímu cachování HTML souboru.

**Soubor:** `index.html` -- přidat do `<head>`:

```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
```

### 5. Vylepšit UpdateBanner

Změnit banner tak, aby ukazoval odpočet a uživatel věděl, že se appka za chvíli aktualizuje.

**Soubor:** `src/components/UpdateBanner.tsx`

- Přidat odpočet (3, 2, 1...)
- Text: "Aktualizace za 3s..." s možností kliknout "Aktualizovat teď"

## Souhrn změn

| Soubor | Změna |
|--------|-------|
| `src/main.tsx` | Přidat visibilitychange listener, auto-update logiku |
| `public/sw.js` | NetworkFirst pro navigační requesty (HTML) |
| `index.html` | Cache-Control meta tagy |
| `src/components/UpdateBanner.tsx` | Odpočet a auto-refresh |

## Výsledek

- Uživatel **vždy** dostane novou verzi při návratu do aplikace
- HTML se nikdy neservíruje ze staré cache
- Pokud je dostupná nová verze SW, automaticky se aktivuje s krátkým upozorněním
- Žádné "zaseknutí" na staré verzi
