
# Přidání editace ceníku do Admin panelu

## Aktuální stav

V admin panelu (`AdminGymDetail.tsx`) se ceník pouze zobrazuje pomocí `GymPricingDisplay`, ale není možné ho upravovat. Edit drawer obsahuje pouze:
- Název, popis, adresa
- Lokace na mapě  
- Otevírací hodiny

## Požadovaná změna

Přidat editor ceníku do stejného edit draweru, kde jsou otevírací hodiny - stejně jako je to v B2B panelu.

## Technické změny

### Soubor: `src/pages/admin/AdminGymDetail.tsx`

**1. Přidat import `GymPricingEditor`:**
```typescript
import GymPricingEditor from '@/components/business/GymPricingEditor';
```

**2. Přidat state pro ceník (za řádek 119):**
```typescript
const [pricing, setPricing] = useState<GymPricing | null>(null);
```

**3. Inicializovat pricing state při načtení dat (za řádek 173):**
```typescript
setPricing(typedGym.pricing);
```

**4. Přidat ceník do onSubmit (řádek 223-233):**
```typescript
const { error } = await supabase
  .from('gyms')
  .update({
    name: data.name,
    description: data.description || null,
    address: data.address || null,
    latitude: location.lat,
    longitude: location.lng,
    opening_hours: openingHours,
    pricing: pricing,  // Přidáno
  })
  .eq('id', gym.id);
```

**5. Aktualizovat lokální stav po uložení (řádek 243):**
```typescript
setGym(prev => prev ? { 
  ...prev, 
  ...data, 
  latitude: location.lat, 
  longitude: location.lng, 
  opening_hours: openingHours,
  pricing: pricing  // Přidáno
} : null);
```

**6. Přidat sekci ceníku do edit draweru (za otevírací hodiny, před tlačítko Uložit, kolem řádku 664):**
```tsx
<Separator className="my-4" />

<div className="space-y-3">
  <Label>Ceník</Label>
  <GymPricingEditor 
    pricing={pricing} 
    onChange={setPricing} 
    showSaveButton={false} 
  />
</div>
```

## Struktura upraveného draweru

```
Drawer "Upraviť posilovňu"
├── Názov posilovne
├── Popis  
├── Adresa
├── Lokácia na mape
├── Otváracie hodiny
│   └── [Po-Ne s časom open/close]
├── Separator
├── Ceník
│   ├── Jednorázové vstupy
│   │   └── [Položky s cenami pro skupiny]
│   └── Permanentky / Členství
│       └── [Položky s cenami pro skupiny]
└── Tlačítko "Uložiť zmeny"
```

## Soubory k úpravě

| Soubor | Změna |
|--------|-------|
| `src/pages/admin/AdminGymDetail.tsx` | Přidat pricing state, import GymPricingEditor, sekci ceníku do draweru, aktualizovat onSubmit |

## Výsledek

- Admin bude moci upravovat ceník přímo v edit draweru
- Ceník se uloží společně s ostatními údaji
- Konzistentní UX s B2B panelem
