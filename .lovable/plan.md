
# Úprava B2B navigace - Business uživatel přímo na /business

## Identifikovaný problém

Business uživatel po přihlášení vidí uživatelskou domovskou stránku (`/`) s pozdravem "Ahoj Boby..." místo business rozhraní. 

**Důvod**: `AuthRoute` přesměrovává na `/business` pouze při přihlašování přes `/auth`. Pokud business uživatel přejde na jiné stránky jako `/` nebo se vrací zpět, zobrazí se mu běžné uživatelské rozhraní.

## Řešení

### Varianta 1: Přesměrování na Index stránce (doporučeno)

Upravit `src/pages/Index.tsx` tak, aby business uživatel byl automaticky přesměrován na `/business`:

```typescript
const Index = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();

  if (authLoading || roleLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Business uživatel → /business
  if (role === 'business') {
    return <Navigate to="/business" replace />;
  }

  // Admin uživatel → /admin
  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return <Home />;
};
```

Tím zajistíme, že:
- **Business uživatel** přejde automaticky na `/business` odkudkoli
- **Admin uživatel** přejde automaticky na `/admin`
- **Běžný uživatel** zůstane na domovské stránce `/`

### Varianta 2: Úprava BusinessLayout šipky zpět

Aktuálně `BusinessLayout` má šipku zpět (`ArrowLeft`) která vede na `/`. Pro business uživatele to nemá smysl - vrátí se na stránku, která ho okamžitě přesměruje zpět.

**Možnosti:**
- Odstranit šipku zpět úplně
- Změnit na navigaci do `/business` (hlavní business dashboard)
- Ponechat (přesměrování zajistí, že se neztratí)

## Změny souborů

| Soubor | Změna |
|--------|-------|
| `src/pages/Index.tsx` | Přidat kontrolu role a přesměrování pro business/admin |

## Výsledek

1. Business uživatel "Boby Fitness" se po přihlášení dostane přímo na `/business`
2. Pokud business uživatel navštíví `/`, je automaticky přesměrován na `/business`
3. Business uživatel nikdy neuvidí "Ahoj Boby..." obrazovku
4. Stejná logika platí pro admin uživatele (přesměrování na `/admin`)
