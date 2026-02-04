
# Rozšíření nastavení B2B - Skrytí z mapy a reorganizace

## Přehled změn

1. **Přidat tlačítko "Skrýt z mapy"** - přepíná viditelnost posilovny na mapě
2. **Smazat posilovnu jako méně výrazné** - ghost/outline varianta místo destructive
3. **Nové pořadí akcí**: Skrýt → Smazat → Odhlásit
4. **Potvrzovací dialogy** pro obě akce s upozorněním na nevratnost
5. **Výběr posilovny** pokud uživatel vlastní více posiloven

---

## Struktura stránky nastavení (nová)

```text
┌─────────────────────────────────────────┐
│ [Indikátor vybrané posilovny - pokud >1]│
├─────────────────────────────────────────┤
│ Nastavení                               │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Viditelnost                         │ │
│ │ ───────────────────────────────     │ │
│ │ [👁 Skrýt z mapy]  (outline btn)    │ │
│ │ nebo                                │ │
│ │ [✓ Zobrazit na mapě] (pokud skrytá) │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Nebezpečná zóna                     │ │
│ │ ───────────────────────────────     │ │
│ │ [🗑 Smazat posilovnu] (ghost/muted) │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Účet                                │ │
│ │ ───────────────────────────────     │ │
│ │ [↪ Odhlásit se]                     │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## Funkční logika

### 1. Skrýt z mapy
- Využije existující `togglePublish()` z `GymContext`
- Pokud `is_published = true` → tlačítko "Skrýt z mapy" 
- Pokud `is_published = false` → tlačítko "Zobrazit na mapě"
- **AlertDialog** s potvrzením:
  - "Opravdu chcete skrýt posilovnu '{název}' z mapy?"
  - "Uživatelé ji nebudou moci najít ani vybrat pro trénink."

### 2. Smazat posilovnu  
- Méně výrazné tlačítko (`variant="ghost"` s jemným textem)
- **AlertDialog** s důrazným varováním:
  - Červený nadpis "Trvale smazat posilovnu"
  - "Tato akce je **NEVRATNÁ**. Posilovna '{název}' bude trvale odstraněna spolu se všemi stroji."
  - Červené potvrzovací tlačítko

### 3. Indikátor vybrané posilovny (pro více posiloven)
- Již existuje v kódu
- Odkaz "Změnit" vede na `/business` kde lze přepnout

---

## Technické detaily

### Import nových ikon
```typescript
import { EyeOff, Eye } from 'lucide-react';
```

### Nová sekce Viditelnost
```typescript
<Card>
  <CardHeader>
    <CardTitle className="text-base">Viditelnost</CardTitle>
    <CardDescription>
      Ovládejte, zda je posilovna viditelná na mapě pro uživatele.
    </CardDescription>
  </CardHeader>
  <CardContent>
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2">
          {gym.is_published ? (
            <>
              <EyeOff className="w-4 h-4" />
              Skrýt z mapy
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              Zobrazit na mapě
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {gym.is_published ? 'Skrýt posilovnu z mapy?' : 'Zobrazit posilovnu na mapě?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {gym.is_published 
              ? `Posilovna "${gym.name}" nebude viditelná pro uživatele. Nebudou ji moci najít ani vybrat pro trénink.`
              : `Posilovna "${gym.name}" bude viditelná pro všechny uživatele na mapě.`
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Zrušit</AlertDialogCancel>
          <AlertDialogAction onClick={togglePublish}>
            {gym.is_published ? 'Skrýt' : 'Zobrazit'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </CardContent>
</Card>
```

### Úprava tlačítka Smazat (méně výrazné)
```typescript
<Button 
  variant="ghost" 
  className="w-full gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
>
  <Trash2 className="w-4 h-4" />
  Smazat posilovnu
</Button>
```

### Vylepšený dialog pro smazání
```typescript
<AlertDialogContent>
  <AlertDialogHeader>
    <AlertDialogTitle className="text-destructive">
      Trvale smazat posilovnu?
    </AlertDialogTitle>
    <AlertDialogDescription className="space-y-2">
      <p>
        <strong>Tato akce je NEVRATNÁ.</strong>
      </p>
      <p>
        Posilovna "{gym.name}" bude trvale odstraněna spolu se všemi přiřazenými stroji.
      </p>
    </AlertDialogDescription>
  </AlertDialogHeader>
  ...
</AlertDialogContent>
```

---

## Soubor ke změně

| Soubor | Změna |
|--------|-------|
| `src/pages/business/GymSettings.tsx` | Reorganizace sekcí, přidání Viditelnost, úprava stylů |

---

## Výsledek

1. B2B uživatel může snadno skrýt/zobrazit posilovnu na mapě
2. Smazání je méně nápadné ale stále dostupné s jasným varováním
3. Logické pořadí: Viditelnost → Smazání → Odhlášení
4. Potvrzovací dialogy pro všechny důležité akce
5. Při více posilovnách je jasně označeno, kterou nastavujeme
