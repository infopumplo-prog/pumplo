
# Úprava Admin Layoutu - Logout tlačítko a odstranění šipky zpět

## Požadované změny

Ze screenshotu vidím aktuální stav:
1. **Vlevo nahoře** je šipka zpět, která vede na "/" - ale admin by se měl přihlásit rovnou do admin panelu, takže šipka je zbytečná
2. **Vpravo nahoře** chybí tlačítko pro odhlášení

## Technické změny

### Soubor: `src/pages/admin/AdminLayout.tsx`

**1. Přidat import pro logout funkci a ikonu:**
```typescript
import { useAuth } from '@/contexts/AuthContext';
import { LogOut } from 'lucide-react';
```

**2. Použít hook v komponentě:**
```typescript
const { logout } = useAuth();
```

**3. Upravit header - odstranit šipku, přidat logout:**
```typescript
<header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  <div className="flex items-center justify-between px-4 py-3">
    <h1 className="text-lg font-semibold">Admin</h1>
    <button 
      onClick={logout}
      className="flex items-center justify-center w-9 h-9 rounded-full bg-muted hover:bg-muted/80 transition-colors"
    >
      <LogOut className="w-5 h-5 text-muted-foreground" />
    </button>
  </div>
</header>
```

Změny v headeru:
- Odstraním `Link` se šipkou zpět (`ArrowLeft`)
- Změním layout na `justify-between` pro rozložení vlevo/vpravo
- Nadpis "Admin" zůstane vlevo
- Vpravo přidám tlačítko s ikonou `LogOut`
- Po kliknutí se zavolá `logout()` z AuthContext

## Soubor ke změně

| Soubor | Změna |
|--------|-------|
| `src/pages/admin/AdminLayout.tsx` | Odstranit šipku zpět, přidat logout tlačítko vpravo |

## Výsledek

Po úpravě:
- Vlevo nahoře bude jen text "Admin"
- Vpravo nahoře bude tlačítko pro odhlášení (ikona LogOut)
- Po kliknutí na logout se admin odhlásí a bude přesměrován na přihlašovací stránku
