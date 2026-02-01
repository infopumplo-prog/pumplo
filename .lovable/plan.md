
# Plán opravy: Problémy s počtem cviků a zobrazením dnů

## Identifikace kořenových příčin

### Problém 1: Stále 9 cviků v plánu
**PŘÍČINA:** Plán byl vygenerován **PŘED** nasazením oprav kódu.

Databáze ukazuje:
- Plán `9be41ad6-df6e-4bdf-a04f-ca18898a77a3` vytvořen: `2026-02-01 11:12:42`
- Počet cviků: `9 pro den A`, `9 pro den B`

Změny v `useWorkoutGenerator.ts` (hard cap 4/6/7 cviků) se projeví až při **GENEROVÁNÍ NOVÉHO PLÁNU**. Refresh stránky pouze načte existující data z databáze.

**ŘEŠENÍ:** Uživatel musí **regenerovat plán** - kliknout na "Začít trénink" → dialog s možností regenerace, nebo přidat explicitní tlačítko "Regenerovat plán" přímo na stránku Training.

### Problém 2: Budoucí dny označeny jako "Vynecháno"
**PŘÍČINA:** Logika výpočtu kalendářního data má bug v porovnání.

Konkrétní situace:
- Plán začal: **1. února 2026 (neděle)**
- Tréninkové dny: `[monday, tuesday, friday, saturday, sunday]`
- `current_day_index = 1` → `currentWeek = 2` (protože v týdnu 1 byl jen 1 den - neděle)
- Uživatel vidí "Týden 2" s dny Po, Út, Pá, So, Ne

Problém v kódu:
```typescript
// Řádek 500-512: getActualDateForDay()
const startDay = planStartDate.getDay(); // 0 (neděle)
const daysFromMonday = startDay === 0 ? 6 : startDay - 1; // = 6
const planWeekMonday = new Date(planStartDate);
planWeekMonday.setDate(planStartDate.getDate() - daysFromMonday);
// planWeekMonday = 1.2.2026 - 6 dní = 26.1.2026 (pondělí minulého týdne!)
```

Pak pro týden 2:
```typescript
viewingWeekMonday.setDate(planWeekMonday.getDate() + (viewingWeek - 1) * 7);
// = 26.1.2026 + 7 = 2.2.2026 (pondělí aktuálního kalendářního týdne)
```

A pro pondělí (dayOrderIndex = 0):
```typescript
targetDate.setDate(viewingWeekMonday.getDate() + dayOrderIndex);
// = 2.2.2026 + 0 = 2.2.2026 (pondělí)
```

Problém: `2.2.2026 < 1.2.2026` je **FALSE**, takže `isBeforePlanStart = false`.

ALE: Pondělí 2.2.2026 je **ZÍTRA** (budoucnost), ne minulost! Problém je v tom, že logika `isPastThisWeek` říká:
```typescript
const isPastThisWeek = viewingWeek === currentWeek && dayOrderIndex < todayDayOrder;
// todayDayOrder = 6 (neděle)
// dayOrderIndex = 0 (pondělí)
// 0 < 6 = TRUE → pondělí je označeno jako "past this week"
```

**SKUTEČNÝ BUG:** Logika `isPastThisWeek` pracuje s kalendářním pořadím dnů v týdnu, ale "Týden 2" v systému PLÁNU neznamená "tento kalendářní týden". Je to abstraktní "týden plánu" který nezohledňuje, že plán začal v neděli.

---

## Technické řešení

### Změna 1: Přidat tlačítko "Regenerovat plán" na Training stránku
Aby uživatel mohl jednoduše regenerovat plán bez nutnosti hledat, kde je funkce.

### Změna 2: Opravit logiku `isPastThisWeek` a `isMissed`
Místo spoléhání na kalendářní dny v týdnu, porovnávat **skutečná kalendářní data**:

```typescript
// Starý kód (problematický):
const isPastThisWeek = viewingWeek === currentWeek && dayOrderIndex < todayDayOrder;
const isMissed = !isExtraWeek && !isBeforePlanStart && (isPastThisWeek || isWeekInPast) && !isCompleted;

// Nový kód:
const actualDate = getActualDateForDay();
const today = new Date();
today.setHours(0, 0, 0, 0);

// Použít skutečné kalendářní datum místo abstraktního pořadí dnů
const isActuallyInPast = actualDate && actualDate < today;
const isBeforePlanStart = planStartDate && actualDate && actualDate < planStartDate;

// Den je vynechaný pouze pokud:
// 1. Není v extra týdnu (dny přesunuté z prvního týdne na konec)
// 2. Jeho skutečné datum je v minulosti
// 3. Není před startem plánu
// 4. Není dokončený
const isMissed = !isExtraWeek && 
                 isActuallyInPast && 
                 !isBeforePlanStart && 
                 !isCompleted;
```

### Změna 3: Přidat viditelné tlačítko regenerace
Na stránce Training přidat sekci s možností regenerovat plán, když plán obsahuje problémy (9 cviků místo max 7):

```tsx
{/* Zobrazit upozornění pokud plán potřebuje regeneraci */}
{plan && plan.exercises.filter(e => e.dayLetter === currentDayLetter).length > 7 && (
  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-4">
    <div className="flex items-center gap-2 text-amber-500">
      <AlertCircle className="w-5 h-5" />
      <span className="font-medium">Plán obsahuje příliš mnoho cviků</span>
    </div>
    <p className="text-sm text-muted-foreground mt-2">
      Dle nové metodiky by měl trénink obsahovat max 7 cviků.
    </p>
    <Button 
      onClick={handleRegeneratePlan} 
      variant="outline" 
      className="mt-3"
    >
      <RefreshCw className="w-4 h-4 mr-2" />
      Regenerovat plán
    </Button>
  </div>
)}
```

---

## Shrnutí změn

| Soubor | Změna |
|--------|-------|
| `src/pages/Training.tsx` | Opravit logiku `isMissed` - použít skutečná kalendářní data místo abstraktních indexů dnů |
| `src/pages/Training.tsx` | Přidat tlačítko "Regenerovat plán" viditelné přímo na stránce |
| `src/pages/Training.tsx` | Přidat upozornění když plán má více než 7 cviků za den |

---

## Proč refresh nepomohl

1. **Cviky jsou uloženy v databázi** - refresh pouze načte stejná data znovu
2. **Logika missed dnů má bug** - kód byl opraven správně, ale porovnání `actualDate < planStartDate` nefunguje správně pro budoucí dny protože `isPastThisWeek` je stále `true` na základě indexů dnů v týdnu
3. **Řešení:** Uživatel musí **regenerovat plán** pro nový počet cviků, a logika kalendářních dnů musí být opravena
