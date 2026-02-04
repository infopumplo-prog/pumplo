

# Galerie fotek posiloven (max 7 fotek)

## Přehled

Rozšíření systému fotek posiloven z 2 fotek (cover + logo) na až 7 fotek v galerii. Fotky budou dostupné pro nahrávání z B2B i Admin rozhraní a zobrazeny jako karusel v profilu posilovny.

---

## 1. Databázová změna

### Nová tabulka `gym_photos`

```sql
CREATE TABLE public.gym_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index pro rychlé vyhledávání
CREATE INDEX idx_gym_photos_gym_id ON public.gym_photos(gym_id);

-- Omezení na max 7 fotek (validace v aplikaci)

-- RLS politiky
ALTER TABLE public.gym_photos ENABLE ROW LEVEL SECURITY;

-- Veřejné čtení pro publikované posilovny
CREATE POLICY "Anyone can view photos of published gyms"
  ON public.gym_photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.gyms 
    WHERE gyms.id = gym_photos.gym_id 
    AND (gyms.is_published = true OR gyms.owner_id = auth.uid())
  ));

-- Business uživatel může spravovat fotky své posilovny
CREATE POLICY "Gym owners can insert photos"
  ON public.gym_photos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.gyms 
    WHERE gyms.id = gym_photos.gym_id 
    AND gyms.owner_id = auth.uid()
  ));

CREATE POLICY "Gym owners can delete photos"
  ON public.gym_photos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.gyms 
    WHERE gyms.id = gym_photos.gym_id 
    AND gyms.owner_id = auth.uid()
  ));

CREATE POLICY "Gym owners can update photos"
  ON public.gym_photos FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.gyms 
    WHERE gyms.id = gym_photos.gym_id 
    AND gyms.owner_id = auth.uid()
  ));

-- Admin může vše
CREATE POLICY "Admins can manage all photos"
  ON public.gym_photos FOR ALL
  USING (has_role(auth.uid(), 'admin'));
```

---

## 2. Nové komponenty

### 2.1 `GymPhotoGallery.tsx` - Zobrazení galerie (karusel)

Komponenta pro zobrazení fotek v profilu posilovny:
- Horizontální karusel s Embla Carousel (již nainstalován)
- Indikátory pozice (tečky)
- Placeholder pokud nejsou žádné fotky

### 2.2 `GymPhotosManager.tsx` - Správa fotek (B2B/Admin)

Komponenta pro nahrávání a správu fotek:
- Grid zobrazení nahraných fotek
- Tlačítko pro přidání nové fotky (pokud < 7)
- Možnost smazat existující fotku
- Drag & drop pro změnu pořadí (volitelně)
- Indikátor počtu fotek (např. "3/7")
- Upload do Supabase Storage bucket `gym-images`

---

## 3. Hook `useGymPhotos`

```typescript
interface GymPhoto {
  id: string;
  gym_id: string;
  photo_url: string;
  sort_order: number;
  created_at: string;
}

interface UseGymPhotosReturn {
  photos: GymPhoto[];
  isLoading: boolean;
  addPhoto: (url: string) => Promise<{ success: boolean }>;
  removePhoto: (photoId: string) => Promise<{ success: boolean }>;
  reorderPhotos: (orderedIds: string[]) => Promise<void>;
  canAddMore: boolean;
}
```

---

## 4. Integrace

### B2B rozhraní (`GymProfile.tsx`)

V Drawer pro úpravu fotek:
- Zachovat Cover a Logo sekce
- Přidat novou sekci "Galerie fotek (max 7)"
- Použít `GymPhotosManager` komponentu

### Admin rozhraní (`AdminGymDetail.tsx`)

V Drawer pro úpravu fotek:
- Stejná struktura jako B2B
- Přidat `GymPhotosManager` komponentu

### Profil posilovny (`GymProfilePreview.tsx`)

- Nahradit statický cover photo za `GymPhotoGallery` karusel
- Fallback na `cover_photo_url` pokud galerie prázdná
- Logo zůstává samostatně překrývající galerii

---

## 5. Struktura souborů

```text
src/
├── components/
│   └── business/
│       ├── GymPhotoGallery.tsx     (nový - zobrazení karuselu)
│       ├── GymPhotosManager.tsx     (nový - správa fotek)
│       ├── GymProfile.tsx           (úprava - přidat galerii)
│       └── GymProfilePreview.tsx    (úprava - karusel místo cover)
├── hooks/
│   └── useGymPhotos.ts              (nový - CRUD pro fotky)
└── pages/
    └── admin/
        └── AdminGymDetail.tsx       (úprava - přidat galerii)
```

---

## 6. UI návrh

### Správa fotek (Drawer)

```text
┌─────────────────────────────────────────┐
│ Upravit fotky                           │
├─────────────────────────────────────────┤
│ Titulní fotka                           │
│ ┌───────────────────────────────────┐   │
│ │         [Cover Upload]            │   │
│ └───────────────────────────────────┘   │
├─────────────────────────────────────────┤
│ Logo posilovny                          │
│       ┌─────┐                           │
│       │ 🏋️ │                           │
│       └─────┘                           │
├─────────────────────────────────────────┤
│ Galerie fotek (3/7)                     │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│ │ 📷 │ │ 📷 │ │ 📷 │ │  +  │        │
│ │  ❌ │ │  ❌ │ │  ❌ │ │     │        │
│ └─────┘ └─────┘ └─────┘ └─────┘        │
│                                         │
│ "Nahrajte až 7 fotek vaší posilovny"   │
└─────────────────────────────────────────┘
```

### Karusel v profilu

```text
┌─────────────────────────────────────────┐
│ ◄  [     Fotka 1/3     ]  ►            │
│         ● ○ ○                           │
├─────────────────────────────────────────┤
│   🏋️                                    │
│   Název posilovny                       │
│   📍 Adresa                             │
└─────────────────────────────────────────┘
```

---

## 7. Validace

- Max 7 fotek na posilovnu (kontrola v hooku i na backendu)
- Max 5MB na fotku
- Pouze image/* typy souborů
- Automatické mazání ze storage při smazání fotky z DB (CASCADE)

---

## Soubory ke změně/vytvoření

| Soubor | Akce |
|--------|------|
| `supabase/migrations/xxx_gym_photos.sql` | Nová tabulka + RLS |
| `src/hooks/useGymPhotos.ts` | Nový hook |
| `src/components/business/GymPhotoGallery.tsx` | Nová komponenta - karusel |
| `src/components/business/GymPhotosManager.tsx` | Nová komponenta - správa |
| `src/components/business/GymProfile.tsx` | Přidat galerii do draweru |
| `src/components/business/GymProfilePreview.tsx` | Karusel místo statického cover |
| `src/pages/admin/AdminGymDetail.tsx` | Přidat galerii do draweru |

---

## Výsledek

1. Majitel posilovny může nahrát až 7 fotek své posilovny
2. Admin může spravovat fotky jakékoli posilovny
3. Uživatelé vidí fotky jako atraktivní karusel
4. Cover photo a logo zůstávají pro zpětnou kompatibilitu
5. Galerie rozšiřuje vizuální prezentaci posilovny

