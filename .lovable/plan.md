

# Řešení problému se zastaralými verzemi PWA - Jednou provždy

## Identifikované problémy

### 1. Agresivní caching API dat (KRITICKÉ)
Současný service worker používá **StaleWhileRevalidate** pro `user_profiles` a workout data. To znamená:
- Uživatel dostane NEJDŘÍVE starou verzi z cache
- Až POTOM se stahuje nová verze (ale uživatel ji nevidí okamžitě)
- Pokud uživatel zavře aplikaci před dokončením update, vidí pořád starou verzi

### 2. CacheFirst pro exercises (KRITICKÉ)
Pro katalog cviků se používá **CacheFirst** s 30denní expirací:
```javascript
registerRoute(/exercises.*/, new CacheFirst({ maxAgeSeconds: 60 * 60 * 24 * 30 }))
```
To znamená, že jakékoli změny v cvicích se projeví až za 30 dní!

### 3. Chybí verzování aplikace
Není implementováno žádné sledování verze buildu. Když se nasadí nová verze, uživatel nemá jak zjistit, že běží na staré.

### 4. Prompt "Aktualizovat?" se snadno přehlédne
Současná implementace v `main.tsx` používá `confirm()`, který:
- Na iOS Safari PWA nefunguje správně
- Uživatelé ho často odmítnou reflexivně
- Po odmítnutí se nezobrazí znovu

### 5. Hodinový interval kontroly updatů
```javascript
setInterval(() => registration.update(), 60 * 60 * 1000);
```
Když uživatel spustí PWA z plochy, může běžet hodinu na staré verzi.

## Navrhované řešení

### Fáze 1: Změna caching strategie pro kritická data

**Změnit `public/sw.js`:**

| Endpoint | Současná strategie | Nová strategie |
|----------|-------------------|----------------|
| `user_profiles` | StaleWhileRevalidate (24h) | **NetworkFirst** (fallback 5s) |
| `user_workout_plans` | StaleWhileRevalidate (7d) | **NetworkFirst** (fallback 5s) |
| `workout_sessions` | StaleWhileRevalidate (7d) | **NetworkFirst** (fallback 3s) |
| `exercises` | CacheFirst (30d) | **StaleWhileRevalidate** (7d) |

NetworkFirst = vždy se pokusí stáhnout čerstvá data, cache pouze jako fallback při offline.

### Fáze 2: Automatická aktualizace při spuštění PWA

**Nový přístup v `main.tsx`:**
1. Kontrola updatů ihned při spuštění (ne až za hodinu)
2. Místo `confirm()` použít vlastní UI komponentu
3. Při kritickém updatu automaticky reload bez dotazu

### Fáze 3: Verzování a force-refresh mechanismus

**Nový soubor `src/lib/appVersion.ts`:**
- Exportuje BUILD_TIMESTAMP generovaný při buildu
- Ukládá do localStorage kdy naposledy proběhl refresh
- Při neshodě verzí vynutí reload

**Změna `vite.config.ts`:**
- Přidat define plugin pro `__BUILD_TIMESTAMP__`

### Fáze 4: Vylepšený Update Banner

**Nová komponenta `src/components/UpdateBanner.tsx`:**
- Zobrazí se jako sticky banner nahoře
- Nelze ignorovat - pouze tlačítko "Aktualizovat"
- Uloží do sessionStorage že update proběhl

## Technické detaily implementace

### 1. Úprava Service Workeru (`public/sw.js`)

```javascript
// ZMĚNA: user_profiles - NetworkFirst místo StaleWhileRevalidate
registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/user_profiles.*/i,
  new NetworkFirst({
    cacheName: 'user-profile-cache',
    networkTimeoutSeconds: 5, // Fallback na cache po 5s
    plugins: [...]
  })
);

// ZMĚNA: exercises - StaleWhileRevalidate místo CacheFirst
registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/exercises.*/i,
  new StaleWhileRevalidate({
    cacheName: 'exercises-catalog-cache',
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 dní místo 30
      }),
    ],
  })
);

// ZMĚNA: workout_plans - NetworkFirst
registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/user_workout_plans.*/i,
  new NetworkFirst({
    cacheName: 'workout-plans-cache',
    networkTimeoutSeconds: 5,
    plugins: [...]
  })
);
```

### 2. Verzování aplikace

**Nový soubor `src/lib/appVersion.ts`:**
```typescript
// BUILD_TIMESTAMP je injektován při buildu
export const BUILD_TIMESTAMP = __BUILD_TIMESTAMP__ || Date.now();

const LAST_VERSION_KEY = 'pumplo_last_version';

export function checkForVersionMismatch(): boolean {
  const lastVersion = localStorage.getItem(LAST_VERSION_KEY);
  const currentVersion = BUILD_TIMESTAMP.toString();
  
  if (lastVersion && lastVersion !== currentVersion) {
    return true; // Verze se neshodují
  }
  
  localStorage.setItem(LAST_VERSION_KEY, currentVersion);
  return false;
}

export function markVersionUpdated() {
  localStorage.setItem(LAST_VERSION_KEY, BUILD_TIMESTAMP.toString());
}
```

**Změna `vite.config.ts`:**
```typescript
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_TIMESTAMP__: Date.now(),
  },
  // ... zbytek konfigurace
}));
```

### 3. Update Banner komponenta

**Nový soubor `src/components/UpdateBanner.tsx`:**
```typescript
const UpdateBanner = ({ onUpdate }: { onUpdate: () => void }) => {
  return (
    <motion.div 
      className="fixed top-0 left-0 right-0 z-[9999] bg-primary text-white px-4 py-3"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
    >
      <div className="flex items-center justify-between max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="font-medium">Nová verze je dostupná</span>
        </div>
        <Button size="sm" variant="secondary" onClick={onUpdate}>
          Aktualizovat
        </Button>
      </div>
    </motion.div>
  );
};
```

### 4. Vylepšená registrace SW (`src/main.tsx`)

```typescript
import { checkForVersionMismatch, markVersionUpdated } from '@/lib/appVersion';

// Kontrola verze při startu
if (checkForVersionMismatch()) {
  // Vymazat SW cache a reload
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
  markVersionUpdated();
  window.location.reload();
}

const updateSW = registerSW({
  onNeedRefresh() {
    // Zobrazit UpdateBanner místo confirm()
    showUpdateBanner();
  },
  onRegisteredSW(swUrl, registration) {
    // Kontrola při každém spuštění, ne jen hodinově
    if (registration) {
      registration.update();
      
      // Pak kontrola každých 5 minut při aktivním používání
      setInterval(() => {
        if (!document.hidden) {
          registration.update();
        }
      }, 5 * 60 * 1000);
    }
  },
});
```

## Soubory k úpravě

| Soubor | Změna |
|--------|-------|
| `public/sw.js` | Změna caching strategií na NetworkFirst pro kritická data |
| `vite.config.ts` | Přidat `define: { __BUILD_TIMESTAMP__ }` |
| `src/lib/appVersion.ts` | NOVÝ - verzování a kontrola updatů |
| `src/vite-env.d.ts` | Deklarace `__BUILD_TIMESTAMP__` typu |
| `src/main.tsx` | Kontrola verze při startu, vylepšená SW registrace |
| `src/components/UpdateBanner.tsx` | NOVÝ - UI pro update notifikaci |
| `src/App.tsx` | Integrace UpdateBanner komponenty |

## Výsledek

Po implementaci:
1. **Kritická data (profil, plán)** se vždy stahují čerstvá ze serveru
2. **Při novém deployi** se uživatelům zobrazí banner s povinnou aktualizací
3. **Při neshodě verzí** (staré PWA) proběhne automatický refresh
4. **Offline režim** stále funguje díky fallback cache
5. **Kontrola updatů** probíhá při každém spuštění, ne jen hodinově

