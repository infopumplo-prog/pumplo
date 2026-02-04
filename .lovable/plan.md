
# Automatické přesměrování admina na /admin po přihlášení

## Současný stav

Aktuálně `AuthRoute` komponenta v `App.tsx` (řádky 108-120) přesměrovává **všechny** přihlášené uživatele na `/`:

```typescript
const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  
  if (user) {
    return <Navigate to="/" replace />;  // Vždy na /
  }
  return <>{children}</>;
};
```

## Řešení

Upravit `AuthRoute` tak, aby:
1. Po přihlášení zjistila roli uživatele
2. Admin → přesměrovat na `/admin`
3. Business → přesměrovat na `/business`
4. User → přesměrovat na `/`

## Technická implementace

### Soubor: `src/App.tsx`

Změnit `AuthRoute` komponentu:

```typescript
const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading: authLoading } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();
  
  if (authLoading || roleLoading) {
    return <LoadingSpinner />;
  }
  
  if (user) {
    // Přesměrování podle role
    if (role === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    if (role === 'business') {
      return <Navigate to="/business" replace />;
    }
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};
```

## Změny souborů

| Soubor | Změna |
|--------|-------|
| `src/App.tsx` | Upravit `AuthRoute` - přidat kontrolu role a přesměrování podle ní |

## Očekávaný výsledek

1. **Admin** se po přihlášení automaticky dostane na `/admin` (dashboard)
2. **Business** uživatel se dostane na `/business`
3. **Běžný uživatel** zůstane přesměrován na `/` (domovská stránka)

## Poznámka

Admin nemusí mít vyplněný onboarding dotazník - admin stránky nepotřebují tato data, protože slouží pouze pro správu aplikace.
