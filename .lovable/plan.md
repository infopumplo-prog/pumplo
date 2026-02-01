

# Plán: Nová stránka "Můj plán" v sekci Profil

## Přehled

Vytvoříme novou stránku `/profile/plan`, která bude centrální místem pro správu tréninkového plánu. Bude dostupná z profilu a umožní uživateli:
- Vidět přehled aktuálního plánu (split, cíl, posilovna, týdny)
- Prohlížet kalendář týdnů
- Regenerovat plán
- Změnit plán (otevře dotazník)

## Co uživatel uvidí

### Sekce 1: Přehled plánu
- **Cíl tréninku** (např. "Nabrat svaly")
- **Typ splitu** (např. "Upper/Lower" nebo "Full Body")
- **Vybraná posilovna** (název)
- **Délka plánu** (např. "Týden 3/12")
- **Tréninkové dny** (Po, St, Pá, Ne)

### Sekce 2: Kalendář týdnů
- Vizuální přehled všech týdnů (1-12)
- Aktuální týden označen
- Dokončené týdny označeny zeleně
- Možnost kliknout pro detail (v budoucnu)

### Sekce 3: Akce plánu
- **Regenerovat plán** - vytvoří nový plán se stejnými nastaveními
- **Změnit plán** - otevře dotazník pro úpravu cíle/dnů/atd.

## Navigace

Z profilu přidáme novou položku menu:
```
📋 Můj plán → /profile/plan
```

## Technické detaily

### Nové soubory

| Soubor | Účel |
|--------|------|
| `src/pages/MyPlan.tsx` | Hlavní komponenta stránky |

### Úpravy existujících souborů

| Soubor | Změna |
|--------|-------|
| `src/App.tsx` | Přidat route `/profile/plan` |
| `src/pages/Profile.tsx` | Přidat menu položku "Můj plán" s ikonou Calendar |

### Struktura MyPlan.tsx

```tsx
// Hlavní komponenty:
// 1. Header s tlačítkem zpět
// 2. Card s přehledem plánu (cíl, split, posilovna, týden)
// 3. Kalendář týdnů (grid 4x3 pro 12 týdnů)
// 4. Akční tlačítka (Regenerovat, Změnit plán)
// 5. OnboardingDrawer pro editaci

// Použité hooks:
// - useWorkoutPlan() - data o plánu
// - useUserProfile() - profil uživatele
// - useWorkoutGenerator() - regenerace plánu
```

### Logika regenerace

Přesuneme/zkopírujeme logiku `handleRegeneratePlan` z `Training.tsx` do nové stránky (nebo vytvoříme sdílený hook). Důležité:
- Předat `profile.training_days` do `generateWorkoutPlan()`
- Deaktivovat starý plán
- Resetovat `current_day_index` na 0
- Zachovat streak

### Logika změny plánu

1. Klik na "Změnit plán" otevře `OnboardingDrawer`
2. Uživatel změní odpovědi v dotazníku
3. Po uložení se automaticky vygeneruje nový plán

## UI Design (konzistentní s WorkoutHistory.tsx)

- Header: gradient-hero s tlačítkem zpět
- Cards: `bg-card border border-border rounded-2xl`
- Grid pro týdny: `grid grid-cols-4 gap-2`
- Tlačítka: Primary pro regeneraci, Outline pro změnu

## Očekávaný výsledek

Uživatel půjde do Profilu → klikne na "Můj plán" → uvidí přehled svého plánu s kalendářem týdnů a dvěma tlačítky:
1. **Regenerovat plán** - vytvoří nový plán se správným Upper/Lower splitem
2. **Změnit plán** - otevře dotazník pro úpravu preferencí

