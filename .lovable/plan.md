

# Oprava: Přidání ceníku do public_gyms view

## Příčina problému

1. **View `public_gyms`** neobsahuje sloupec `pricing` - byl vytvořen před přidáním systému ceníků
2. **Interface `PublicGym`** v `usePublishedGyms.ts` nemá pole `pricing`
3. Data ceníků **jsou** správně uložena v databázi (ověřeno dotazem)

## Řešení

### 1. Aktualizovat databázový view

Přepíšu view `public_gyms` a přidám sloupec `pricing`:

```sql
CREATE OR REPLACE VIEW public.public_gyms
WITH (security_invoker=on) AS
SELECT 
  id,
  name,
  description,
  latitude,
  longitude,
  address,
  is_published,
  opening_hours,
  cover_photo_url,
  logo_url,
  pricing,          -- Přidáno
  created_at,
  updated_at
FROM public.gyms
WHERE is_published = true;
```

### 2. Aktualizovat TypeScript interface

V `src/hooks/usePublishedGyms.ts` přidám `pricing` do interface a query:

```typescript
import { GymPricing } from '@/contexts/GymContext';

export interface PublicGym {
  // ... stávající pole
  pricing: GymPricing | null;  // Přidáno
}
```

## Soubory k úpravě

| Soubor | Změna |
|--------|-------|
| Databázová migrace | Přepsat view `public_gyms` s přidaným sloupcem `pricing` |
| `src/hooks/usePublishedGyms.ts` | Přidat `pricing` do interface `PublicGym` a zpracování v query |

## Výsledek

- Ceník Fitness Boby a Fitness Motivace se bude správně zobrazovat na mapě
- Všechny veřejné posilovny budou mít přístupný ceník pro uživatele

