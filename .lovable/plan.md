
# Přidání ceníku do Admin panelu a data pro Fitness Motivace

## Problém

1. **AdminGymDetail.tsx** nezobrazuje ceník posilovny - chybí sekce s ceníkem
2. **Fitness Motivace** (ID: `3a70c9bb-7a60-4613-a195-2fce2d2d97fc`) nemá vyplněný ceník v databázi

## Řešení

### 1. Přidat sekci ceníku do AdminGymDetail.tsx

Přidám novou kartu s ceníkem mezi kartu "Otevírací hodiny" a "Stroje" (kolem řádku 520):

```typescript
// Nový import
import { CreditCard } from 'lucide-react';
import GymPricingDisplay from '@/components/business/GymPricingDisplay';
import { GymPricing } from '@/contexts/GymContext';

// V GymData interface přidat:
pricing: GymPricing | null;

// Nová karta v renderování:
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-base flex items-center gap-2">
      <CreditCard className="w-4 h-4" />
      Ceník
    </CardTitle>
  </CardHeader>
  <CardContent>
    <GymPricingDisplay pricing={gym.pricing} />
  </CardContent>
</Card>
```

### 2. Vložit ceník Fitness Motivace

Z obrázku jsem vyčetl ceník:

**Jednorázový vstup:**
| Typ | Základní | Student |
|-----|----------|---------|
| Vstup | 150 Kč | 130 Kč |

**Permanentky:**
| Typ | Základní | Student |
|-----|----------|---------|
| 10 vstupů | 1 290 Kč | 1 150 Kč |
| 20 vstupů | 2 300 Kč | 2 000 Kč |
| Měsíční | 1 350 Kč | 1 190 Kč |
| Roční | 12 000 Kč | 9 990 Kč |

SQL pro vložení:

```sql
UPDATE gyms
SET pricing = '{
  "single_entries": [
    {
      "name": "Jednorázový vstup",
      "prices": [
        { "group": "Základní", "price": 150 },
        { "group": "Student", "price": 130 }
      ]
    }
  ],
  "memberships": [
    {
      "name": "10 vstupů",
      "prices": [
        { "group": "Základní", "price": 1290 },
        { "group": "Student", "price": 1150 }
      ]
    },
    {
      "name": "20 vstupů",
      "prices": [
        { "group": "Základní", "price": 2300 },
        { "group": "Student", "price": 2000 }
      ]
    },
    {
      "name": "Měsíční permanentka",
      "prices": [
        { "group": "Základní", "price": 1350 },
        { "group": "Student", "price": 1190 }
      ]
    },
    {
      "name": "Roční permanentka",
      "prices": [
        { "group": "Základní", "price": 12000 },
        { "group": "Student", "price": 9990 }
      ]
    }
  ]
}'
WHERE id = '3a70c9bb-7a60-4613-a195-2fce2d2d97fc';
```

## Soubory k úpravě

| Soubor | Změna |
|--------|-------|
| `src/pages/admin/AdminGymDetail.tsx` | Přidat interface pricing, import GymPricingDisplay, nová karta s ceníkem |
| Databázová migrace | INSERT ceníku pro Fitness Motivace |

## Výsledek

- Admin panel bude zobrazovat ceník všech posiloven
- Fitness Motivace bude mít vyplněný kompletní ceník podle jejich webu
