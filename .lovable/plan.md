
# Reorganizace stránky Můj plán - Sloučení karet

## Přehled změn

Uživatel chce dvě hlavní karty:

1. **Karta 1: "Přehled plánu"** = Sloučení "Celkový progress" + "Detaily plánu"
2. **Karta 2: "Kalendář & Tréninky"** = Sloučení "Kalendář týdnů" + "Tréninky týdne X"
   - Primárně zobrazovat kalendář týdnů
   - Po kliknutí na týden se rozbalí/zobrazí tréninky daného týdne

## Nová struktura UI

```text
┌─────────────────────────────────────────────────────────────────┐
│  ← Nabrat svaly                                                 │
│     12 týdnů • 4× týdně                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  📊 Přehled plánu                                               │
│  ───────────────────────────────────────────────────────────────│
│  Celkový progress:  0/48 tréninků                          0%   │
│  ════════════════════════════════════════════════════════       │
│                                                                 │
│  🏋️ Split: Upper/Lower                                          │
│  📍 Posilovna: Gym Name                                         │
│  📅 Dny: Po, St, Pá, Ne                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  📅 Kalendář plánu                                              │
│  ───────────────────────────────────────────────────────────────│
│  ┌─────┬─────┬─────┬─────┐                                      │
│  │  1  │  2  │  3  │  4  │  ← Kliknutelné týdny                │
│  │ ⚪  │ ⚪  │ 🟠  │ 🟠  │                                      │
│  ├─────┼─────┼─────┼─────┤                                      │
│  │  5  │  6  │  7  │  8  │                                      │
│  │ 🔴  │ 🔴  │ 🟢  │ 🟢  │                                      │
│  ├─────┼─────┼─────┼─────┤                                      │
│  │  9  │ 10  │ 11  │ 12  │                                      │
│  │ ⚪  │ ⚪  │ 🟠  │ 🟠  │                                      │
│  └─────┴─────┴─────┴─────┘                                      │
│  Legenda: ⚪ Normální | 🟠 Náročný | 🔴 Hardcore | 🟢 Deload     │
│                                                                 │
│  ─────────────── Týden 5 (Hardcore) ────────────────            │
│  ┌─────────────────────────────────────────────────┐            │
│  │  A  Pondělí    Horní tělo                       │            │
│  │  B  Středa     Dolní tělo                       │            │
│  │  A  Pátek      Horní tělo                       │            │
│  │  B  Neděle     Dolní tělo              [Dnes]   │            │
│  └─────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  [🔄 Regenerovat plán]                                          │
│  [⚙️ Změnit plán]                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Detailní změny

### Karta 1: Přehled plánu (sloučení řádků 354-375 a 524-566)

Sloučíme do jedné karty:
- **Progress bar** s počtem tréninků a procentem
- **Detaily:** Split type, Posilovna, Tréninkové dny

```tsx
<Card className="border-border rounded-2xl shadow-card">
  <CardHeader className="pb-3">
    <CardTitle className="text-lg font-semibold flex items-center gap-2">
      <Target className="w-5 h-5 text-primary" />
      Přehled plánu
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Progress */}
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-muted-foreground">Celkový progress</span>
        <span className="text-lg font-bold text-primary">{Math.round(progressPercent)}%</span>
      </div>
      <Progress value={progressPercent} className="h-2" />
      <p className="text-sm text-muted-foreground mt-1">
        {completedSessions}/{totalPlanSessions} tréninků
      </p>
    </div>

    {/* Detaily */}
    <div className="grid grid-cols-2 gap-3 pt-2 border-t">
      <div className="flex items-center gap-2">
        <Dumbbell className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm">{SPLIT_TYPE_LABELS[plan.splitType]}</span>
      </div>
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm">{gymName || 'Nevybráno'}</span>
      </div>
    </div>

    {/* Tréninkové dny */}
    <div className="flex flex-wrap gap-1">
      {trainingDays.map(day => (
        <Badge key={day} variant="secondary" className="text-xs">
          {DAY_NAMES_SHORT[day]}
        </Badge>
      ))}
    </div>
  </CardContent>
</Card>
```

### Karta 2: Kalendář plánu + Tréninky týdne (sloučení řádků 468-522 a 414-466)

Jedna karta obsahující:
1. **Kalendář týdnů** (grid 4x3) - vždy viditelný
2. **Legenda** pod kalendářem
3. **Sekce tréninků vybraného týdne** - zobrazí se po kliknutí na týden
   - Tato sekce bude mít barevné pozadí podle typu týdne

```tsx
<Card className="border-border rounded-2xl shadow-card">
  <CardHeader className="pb-3">
    <CardTitle className="text-lg font-semibold flex items-center gap-2">
      <Calendar className="w-5 h-5 text-primary" />
      Kalendář plánu
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Kalendář týdnů - grid 4x3 */}
    <div className="grid grid-cols-4 gap-2">
      {/* ... týdny 1-12 jako kliknutelné buttony ... */}
    </div>

    {/* Legenda */}
    <div className="grid grid-cols-2 gap-2 pt-3 border-t">
      {/* ... legenda ... */}
    </div>

    {/* Tréninky vybraného týdne - zobrazí se když selectedWeek !== null */}
    {selectedWeek && (
      <div className={cn(
        "mt-4 p-4 rounded-xl border-2",
        weekTypeStyles[getWeekType(selectedWeek)].bg,
        weekTypeStyles[getWeekType(selectedWeek)].border
      )}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {weekTypeStyles[getWeekType(selectedWeek)].icon}
            <span className={cn("font-semibold", weekTypeStyles[getWeekType(selectedWeek)].text)}>
              Týden {selectedWeek} - {weekTypeLabels[getWeekType(selectedWeek)]}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setSelectedWeek(null)}
          >
            Zavřít
          </Button>
        </div>
        
        {/* Seznam tréninků */}
        <div className="space-y-2">
          {schedule.slice(0, trainingDaysCount).map((day, index) => (
            <div key={index} className="flex items-center gap-3 p-2 bg-background/50 rounded-lg">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold bg-background">
                {day.dayLetter}
              </div>
              <div>
                <p className="font-medium">{DAY_NAMES_CZ[day.dayOfWeek]}</p>
                <p className="text-xs text-muted-foreground">{dayTemplate?.dayName}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </CardContent>
</Card>
```

## Soubory ke změně

| Soubor | Změna |
|--------|-------|
| `src/pages/MyPlan.tsx` | Sloučit karty: Progress+Detaily → "Přehled plánu", Kalendář+Tréninky → "Kalendář plánu" |

## Logika zobrazení tréninků

1. **Výchozí stav:** `selectedWeek = null` → zobrazí se pouze kalendář
2. **Po kliknutí na týden:** `selectedWeek = číslo` → pod kalendářem se zobrazí barevná sekce s tréninky
3. **Tlačítko "Zavřít"** nebo klik na stejný týden → `selectedWeek = null`

## Interakce

- Klik na týden v kalendáři → zobrazí tréninky daného týdne
- Klik na aktuálně vybraný týden → skryje tréninky (toggle)
- Barevné pozadí sekce tréninků odpovídá typu týdne (červená=hardcore, zelená=deload, atd.)

## Očekávaný výsledek

Stránka bude mít pouze 3 hlavní sekce:
1. **Header** (cíl + frekvence)
2. **Přehled plánu** (progress + split + posilovna + dny)
3. **Kalendář plánu** (12 týdnů + legenda + rozbalitelné tréninky po kliknutí)
4. **Akční tlačítka** (Regenerovat, Změnit plán)
