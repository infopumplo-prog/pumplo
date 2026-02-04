
# Oprava nahrávání fotek do galerie

## Problém

Nahrávání fotek do galerie selhává s chybou:
```
StorageApiError: new row violates row-level security policy
```

## Příčina

Storage bucket `gym-images` má RLS politiku, která vyžaduje, aby název složky odpovídal **user ID**:

```sql
(auth.uid())::text = (storage.foldername(name))[1]
```

Existující `GymImageUpload.tsx` (pro cover a logo) správně používá:
```typescript
const fileName = `${user.id}/${type}-${Date.now()}.${fileExt}`;
```

Ale nový `useGymPhotos.ts` (pro galerii) nesprávně používá:
```typescript
const fileName = `${gymId}/gallery-${Date.now()}.${fileExt}`;
```

## Řešení

Upravit `useGymPhotos.ts` aby používal **user ID** místo **gym ID** pro název složky při uploadu, ale přitom zachovat gymId v názvu souboru pro organizaci.

---

## Změna v kódu

### `src/hooks/useGymPhotos.ts`

Hook potřebuje přístup k aktuálnímu uživateli. Přidáme import `useAuth` a změníme cestu souboru:

```typescript
import { useAuth } from '@/contexts/AuthContext';

export const useGymPhotos = (gymId: string | undefined): UseGymPhotosReturn => {
  const { user } = useAuth();  // přidáno
  // ...
  
  const addPhoto = async (file: File) => {
    if (!gymId || !user) return { success: false };  // přidána kontrola user
    
    // ...
    
    // OPRAVA: Použít user.id jako složku místo gymId
    const fileName = `${user.id}/gallery-${gymId}-${Date.now()}.${fileExt}`;
    
    // ...
  };
};
```

---

## Soubor ke změně

| Soubor | Změna |
|--------|-------|
| `src/hooks/useGymPhotos.ts` | Přidat useAuth hook, změnit cestu uploadu na user.id |

---

## Výsledek

Po této změně bude galerie fotek ukládat soubory do složky pojmenované podle user ID (např. `2576dcf9-3ef5-48b8-93db-b303d6180e7c/gallery-141812dd-...-1707123456789.jpg`), což odpovídá existující RLS politice a nahrávání bude fungovat.
