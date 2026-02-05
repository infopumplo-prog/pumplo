
# Přesun editoru ceníku do hlavního draweru

## Aktuální stav

- Tlačítko s ikonou CreditCard otevírá samostatný drawer pro úpravu ceníku
- Data Fitness Boby jsou již v databázi správně uložena

## Požadovaná změna

Odstranit tlačítko s kartou a přesunout editor ceníku do stejného draweru jako otevírací hodiny (drawer s tužkou).

## Technické změny

### Soubor: `src/components/business/GymProfile.tsx`

**1. Odstranit:**
- Import `CreditCard` z lucide-react
- State `isPricingDrawerOpen`
- Samostatný Drawer pro ceník (řádky 178-195)
- Funkci `handlePricingSave` - místo ní uložím přímo v `onSubmit`

**2. Přidat do hlavního formuláře v editačním draweru:**
- State pro ceník: `const [pricing, setPricing] = useState<GymPricing | null>(gym.pricing)`
- Sekce s ceníkem za otevírací hodiny
- Aktualizovat `onSubmit` aby ukládal i ceník

**3. Struktura upraveného draweru:**

```
Drawer "Upravit posilovnu"
├── Název posilovny
├── Popis
├── Adresa
├── Lokace na mapě
├── Otevírací hodiny
│   └── [Po-Ne s časem open/close]
├── Separator
├── Ceník
│   ├── Jednorázové vstupy
│   │   └── [Položky s cenami pro skupiny]
│   └── Permanentky / Členství
│       └── [Položky s cenami pro skupiny]
└── Tlačítko "Uložit změny"
```

**4. Upravený kód:**

```typescript
// Přidat state
const [pricing, setPricing] = useState<GymPricing | null>(gym.pricing);

// Aktualizovat onSubmit
const onSubmit = async (data: FormData) => {
  setIsSubmitting(true);
  const result = await updateGym({
    name: data.name,
    description: data.description || null,
    address: data.address || null,
    latitude: location.lat,
    longitude: location.lng,
    opening_hours: openingHours,
    pricing: pricing,  // Přidáno
  });
  setIsSubmitting(false);
  if (result.success) {
    setIsDrawerOpen(false);
  }
};
```

**5. Inline verze editoru ceníku:**
Místo použití `GymPricingEditor` komponenty vložím přímo funkcionalitu do formuláře, protože potřebuji jednotné tlačítko "Uložit změny" místo dvou oddělených.

## Soubory k úpravě

| Soubor | Změna |
|--------|-------|
| `src/components/business/GymProfile.tsx` | Odstranit tlačítko CreditCard, přesunout ceník do hlavního draweru |

## Výsledek

- Jedno tlačítko tužky pro úpravu všech dat (info, lokace, hodiny, ceník)
- Ceník se ukládá společně s ostatními daty
- Data Fitness Boby jsou již v databázi správně
