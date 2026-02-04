
# Úprava Business rozhraní

## Přehled změn

Úpravy pro zlepšení B2B uživatelského rozhraní:
1. Odstranění šipky zpět z hlavičky (nikam nevede)
2. Změna pořadí navigace podle požadavku
3. Přidání tlačítka pro odhlášení do nastavení

---

## 1. Odstranění šipky zpět

Aktuálně `BusinessLayout` obsahuje šipku zpět vedoucí na `/`, ale díky novému přesměrování je business uživatel okamžitě přesměrován zpět na `/business`. Šipka je tedy zbytečná a bude odstraněna.

**Změna v hlavičce:**
- Smazat tlačítko s `ArrowLeft` ikonou
- Ponechat pouze nadpis "Business"

---

## 2. Změna pořadí navigace

**Současné pořadí:**
1. Posilovna
2. Stroje
3. Statistiky
4. Nastavení

**Nové pořadí:**
1. Statistiky
2. Posilovna
3. Stroje
4. Nastavení

---

## 3. Přidání odhlášení do nastavení

Stránka `GymSettings` aktuálně obsahuje pouze možnost smazání posilovny. Přidám sekci pro odhlášení, která umožní business uživateli se odhlásit z aplikace.

**Nová sekce bude obsahovat:**
- Tlačítko "Odhlásit se" s ikonou `LogOut`
- Červené variantní stylování (destructive/outline)
- Volání `logout()` funkce z `AuthContext`

---

## Soubory ke změně

| Soubor | Změna |
|--------|-------|
| `src/pages/business/BusinessLayout.tsx` | Odstranit šipku zpět, změnit pořadí navigace |
| `src/pages/business/GymSettings.tsx` | Přidat tlačítko pro odhlášení |

---

## Technické detaily

### BusinessLayout.tsx

```typescript
// Změna pořadí navigace
const navItems = [
  { path: '/business/stats', icon: BarChart3, label: 'Statistiky' },
  { path: '/business', icon: Building2, label: 'Posilovna' },
  { path: '/business/machines', icon: Dumbbell, label: 'Stroje' },
  { path: '/business/settings', icon: Settings, label: 'Nastavení' },
];

// Header bez šipky zpět
<header>
  <div className="flex items-center gap-3 px-4 py-3">
    <h1 className="text-lg font-semibold">Business</h1>
  </div>
</header>
```

### GymSettings.tsx

```typescript
import { useAuth } from '@/contexts/AuthContext';
import { LogOut } from 'lucide-react';

// V komponentě:
const { logout } = useAuth();

// Nová sekce před nebezpečnou zónou:
<Card>
  <CardHeader>
    <CardTitle>Účet</CardTitle>
  </CardHeader>
  <CardContent>
    <Button 
      variant="outline" 
      className="w-full border-destructive text-destructive"
      onClick={logout}
    >
      <LogOut className="w-4 h-4 mr-2" />
      Odhlásit se
    </Button>
  </CardContent>
</Card>
```

---

## Výsledek

1. Čistší hlavička bez zbytečné šipky zpět
2. Logičtější pořadí navigace - statistiky jako první (hlavní přehled)
3. Business uživatel se může snadno odhlásit z aplikace přes nastavení
