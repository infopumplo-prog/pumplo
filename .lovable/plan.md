
# Oprava B2B Settings - Přidání odhlášení i bez gym profilu

## Problém

Aktuálně když B2B uživatel nemá vytvořený profil posilovny a přejde do Nastavení, vidí pouze:
- Varování "Nemáte vytvořený profil posilovny"
- Tlačítko "Vytvořit profil"

**Chybí tlačítko pro odhlášení** - uživatel je uvězněný a nemůže se odhlásit.

## Řešení

Přidat sekci "Účet" s tlačítkem odhlášení i do stavu, kdy uživatel nemá gym profil.

## Technická změna

### Soubor: `src/pages/business/GymSettings.tsx`

Upravím podmínku `if (!gym)` (řádky 67-83) tak, aby obsahovala i kartu s odhlášením:

```typescript
if (!gym) {
  return (
    <BusinessLayout>
      <div className="space-y-4">
        <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">
            Nemáte vytvořený profil posilovny
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Pro přístup k nastavení posilovny musíte mít vytvořený profil.
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link to="/business">Vytvořit profil</Link>
        </Button>

        {/* Účet sekce - vždy dostupná */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Účet</CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full border-destructive text-destructive hover:bg-destructive/10"
              onClick={logout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Odhlásit se
            </Button>
          </CardContent>
        </Card>
      </div>
    </BusinessLayout>
  );
}
```

## Změny

| Soubor | Změna |
|--------|-------|
| `src/pages/business/GymSettings.tsx` | Přidat kartu "Účet" s odhlášením i do stavu bez gym profilu |

## Výsledek

- Uživatel bez gym profilu uvidí:
  1. Varování že nemá profil
  2. Tlačítko "Vytvořit profil"
  3. **Kartu "Účet" s tlačítkem odhlášení**
- Uživatel se může vždy odhlásit, i když ještě nevytvořil posilovnu
