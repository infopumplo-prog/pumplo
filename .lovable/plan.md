
# Plán opravy: Přidat možnost regenerace plánu

## Problém

Uživatel vidí chybovou hlášku "Plán nemá vygenerované cviky. Prosím regeneruj plán v nastavení.", ale **stránka Nastavení nemá žádnou funkci pro regeneraci plánu**.

Funkce `handleRegeneratePlan` existuje v `Training.tsx`, ale je volána pouze automaticky při dokončení celého plánu.

## Řešení

Místo přidávání regenerace do Settings (kde to logicky nepatří), opravíme flow přímo na stránce Training:

### Možnost A: Přidat tlačítko regenerace na Training stránce (doporučeno)

Když plán nemá cviky, zobrazit **tlačítko "Regenerovat plán"** přímo na stránce Training místo chybové hlášky.

### Změny v `src/pages/Training.tsx`

1. **Upravit chybové hlášky** (řádky 655, 754):
   - Místo `toast.error('Plán nemá vygenerované cviky. Prosím regeneruj plán v nastavení.')` 
   - Použít `toast.error('Plán nemá vygenerované cviky.')` a zobrazit akční tlačítko

2. **Přidat UI pro regeneraci** když plán nemá cviky:
   - Detekovat že `currentExercises.length === 0` při aktivním plánu
   - Zobrazit informační kartu s tlačítkem "Regenerovat plán"
   - Použít existující `handleRegeneratePlan` funkci

3. **Přidat alternativní akci** při chybějících cvikách:
   - Zobrazit AlertDialog s možností regenerace
   - Tlačítko "Regenerovat nyní" které zavolá `handleRegeneratePlan`

### Konkrétní kód

**Krok 1:** Upravit hlášku na řádku 655:
```typescript
} else {
  // Žádné cviky v DB - plán nemá vygenerované cviky
  // Zobrazit dialog s možností regenerace místo neakční toast
  setShowMissingExercisesDialog(true);
}
```

**Krok 2:** Přidat nový state:
```typescript
const [showMissingExercisesDialog, setShowMissingExercisesDialog] = useState(false);
```

**Krok 3:** Přidat nový dialog:
```tsx
<AlertDialog open={showMissingExercisesDialog} onOpenChange={setShowMissingExercisesDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-amber-500" />
        Plán nemá vygenerované cviky
      </AlertDialogTitle>
      <AlertDialogDescription className="space-y-3">
        <p>
          Tvůj tréninkový plán nemá vygenerované cviky. To se může stát, když:
        </p>
        <ul className="list-disc list-inside text-sm space-y-1">
          <li>Změnila se dostupná vybavení v posilovně</li>
          <li>Plán byl vytvořen bez vybrané posilovny</li>
        </ul>
        <p className="text-sm">
          Klikni na tlačítko níže pro vygenerování nového plánu.
        </p>
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
      <AlertDialogCancel>Zrušit</AlertDialogCancel>
      <AlertDialogAction 
        onClick={handleRegeneratePlan}
        disabled={isRegeneratingPlan}
        className="gap-2"
      >
        {isRegeneratingPlan ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Generuji plán...
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4" />
            Regenerovat plán
          </>
        )}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Krok 4:** Upravit řádek 754 podobně:
```typescript
} else {
  setShowMissingExercisesDialog(true);
}
```

---

## Alternativa: Přidat sekci do Settings

Pokud preferuješ mít regeneraci v Nastavení, přidáme novou sekci do `Settings.tsx`:

```tsx
{/* Training Plan Section */}
<motion.div variants={itemVariants}>
  <div className="flex items-center gap-3 mb-4">
    <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
      <Dumbbell className="w-5 h-5 text-purple-500" />
    </div>
    <h2 className="text-lg font-semibold">Tréninkový plán</h2>
  </div>
  <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
    <p className="text-sm text-muted-foreground">
      Regenerace plánu vytvoří nový tréninkový plán podle tvého aktuálního profilu.
    </p>
    <Button
      onClick={handleRegeneratePlan}
      disabled={isRegeneratingPlan}
      variant="outline"
      className="w-full"
    >
      <RefreshCw className={cn("w-4 h-4 mr-2", isRegeneratingPlan && "animate-spin")} />
      {isRegeneratingPlan ? 'Generuji...' : 'Regenerovat plán'}
    </Button>
  </div>
</motion.div>
```

---

## Doporučení

**Možnost A (přidat dialog v Training.tsx)** je lepší protože:
- Uživatel je už na stránce kde problém vidí
- Nemusí navigovat jinam
- Je to akčnější a přímočařejší UX

## Shrnutí změn

| Soubor | Změna |
|--------|-------|
| `src/pages/Training.tsx` | Přidat `showMissingExercisesDialog` state |
| `src/pages/Training.tsx` | Přidat AlertDialog pro chybějící cviky s tlačítkem regenerace |
| `src/pages/Training.tsx` | Změnit toast.error na zobrazení dialogu (řádky 655, 754) |
