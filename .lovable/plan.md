
# Implementace ceníku pro posilovny

## Analýza požadavku

Z přiloženého screenshotu ceníku Fitness Boby vidím strukturovaný ceník s:

**Jednorázové vstupy (Fitness):**
| Čas | Základní | Studenti a senioři |
|-----|----------|-------------------|
| Po-Pá, Ne (do 14:00) | 125 Kč | 95 Kč |
| Po-Pá, Ne (od 14:00) | 155 Kč | 110 Kč |
| Sobota (celý den) | 115 Kč | 90 Kč |

**Permanentky Fitness:**
| Typ | Základní | Studenti a senioři |
|-----|----------|-------------------|
| 10 vstupů | 1 395 Kč | - |
| 15 vstupů | 1 975 Kč | - |
| 20 vstupů | 2 480 Kč | - |
| 1 měsíc | 1 290 Kč | 999 Kč |
| 3 měsíce | 3 850 Kč | 2 900 Kč |
| 6 měsíců | 7 250 Kč | 5 400 Kč |
| 12 měsíců | 13 200 Kč | 10 200 Kč |

## Navrhovaná struktura dat

Pro univerzální formát ceníku použitelný pro všechny posilovny navrhuji následující JSONB strukturu:

```typescript
interface GymPricing {
  single_entries: PricingCategory[];  // Jednorázové vstupy
  memberships: PricingCategory[];     // Permanentky/členství
}

interface PricingCategory {
  name: string;           // Název položky (např. "Po-Pá do 14:00", "1 měsíc")
  description?: string;   // Volitelný popis
  prices: PriceVariant[]; // Cenové varianty pro různé skupiny
}

interface PriceVariant {
  group: string;          // Skupina (např. "Základní", "Studenti a senioři")
  price: number | null;   // Cena v Kč (null = nedostupné)
}
```

## Technické změny

### 1. Databázová migrace

Přidám nový sloupec `pricing` do tabulky `gyms`:

```sql
ALTER TABLE gyms 
ADD COLUMN pricing jsonb DEFAULT NULL;
```

### 2. Aktualizace TypeScript typů

V `src/contexts/GymContext.tsx` přidám interface pro pricing:

```typescript
export interface PriceVariant {
  group: string;
  price: number | null;
}

export interface PricingItem {
  name: string;
  description?: string;
  prices: PriceVariant[];
}

export interface GymPricing {
  single_entries: PricingItem[];
  memberships: PricingItem[];
}

export interface Gym {
  // ... stávající pole
  pricing: GymPricing | null;
}
```

### 3. Nová komponenta pro správu ceníku

Vytvořím `src/components/business/GymPricingEditor.tsx`:

- Formulář pro přidávání/úpravu položek ceníku
- Oddělené sekce pro jednorázové vstupy a permanentky
- Dynamické přidávání cenových skupin (Základní, Studenti, Senioři...)
- Možnost přidat/odebrat položky

### 4. Komponenta pro zobrazení ceníku

Vytvořím `src/components/business/GymPricingDisplay.tsx`:

- Přehledné tabulkové zobrazení ceníku
- Responzivní design pro mobilní zobrazení
- Použití v tabu "Ceník" v `GymDetailTabs.tsx`

### 5. Integrace do GymProfile.tsx

Přidám nový drawer pro úpravu ceníku:
- Nové tlačítko s ikonou CreditCard vedle stávajících tlačítek
- Drawer s kompletním editorem ceníku

### 6. Aktualizace GymDetailTabs.tsx

Nahradím placeholder v tabu "Ceník" reálným zobrazením dat z `gym.pricing`.

### 7. Vložení dat Fitness Boby

Po implementaci vložím ceník Fitness Boby do databáze:

```json
{
  "single_entries": [
    {
      "name": "Po-Pá, Ne (do 14:00)",
      "prices": [
        { "group": "Základní", "price": 125 },
        { "group": "Studenti a senioři", "price": 95 }
      ]
    },
    {
      "name": "Po-Pá, Ne (od 14:00)",
      "prices": [
        { "group": "Základní", "price": 155 },
        { "group": "Studenti a senioři", "price": 110 }
      ]
    },
    {
      "name": "Sobota (celý den)",
      "prices": [
        { "group": "Základní", "price": 115 },
        { "group": "Studenti a senioři", "price": 90 }
      ]
    }
  ],
  "memberships": [
    {
      "name": "10 vstupů",
      "prices": [
        { "group": "Základní", "price": 1395 },
        { "group": "Studenti a senioři", "price": null }
      ]
    },
    {
      "name": "15 vstupů",
      "prices": [
        { "group": "Základní", "price": 1975 },
        { "group": "Studenti a senioři", "price": null }
      ]
    },
    {
      "name": "20 vstupů",
      "prices": [
        { "group": "Základní", "price": 2480 },
        { "group": "Studenti a senioři", "price": null }
      ]
    },
    {
      "name": "1 měsíc",
      "prices": [
        { "group": "Základní", "price": 1290 },
        { "group": "Studenti a senioři", "price": 999 }
      ]
    },
    {
      "name": "3 měsíce",
      "prices": [
        { "group": "Základní", "price": 3850 },
        { "group": "Studenti a senioři", "price": 2900 }
      ]
    },
    {
      "name": "6 měsíců",
      "prices": [
        { "group": "Základní", "price": 7250 },
        { "group": "Studenti a senioři", "price": 5400 }
      ]
    },
    {
      "name": "12 měsíců",
      "prices": [
        { "group": "Základní", "price": 13200 },
        { "group": "Studenti a senioři", "price": 10200 }
      ]
    }
  ]
}
```

## Soubory k vytvoření/úpravě

| Soubor | Akce |
|--------|------|
| Databázová migrace | Přidat sloupec `pricing` |
| `src/contexts/GymContext.tsx` | Přidat typy pro pricing |
| `src/components/business/GymPricingEditor.tsx` | **Nový** - editor ceníku |
| `src/components/business/GymPricingDisplay.tsx` | **Nový** - zobrazení ceníku |
| `src/components/business/GymProfile.tsx` | Přidat drawer pro ceník |
| `src/components/business/GymDetailTabs.tsx` | Implementovat tab Ceník |
| Data pro Fitness Boby | INSERT do tabulky gyms |

## Výsledek

- Majitelé posiloven mohou spravovat ceník přímo v aplikaci
- Ceník je strukturovaný a konzistentní napříč všemi posilovnami
- Uživatelé uvidí přehledný ceník v detailu posilovny
- Fitness Boby bude mít kompletní ceník podle přiloženého screenshotu
