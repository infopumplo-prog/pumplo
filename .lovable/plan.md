
# Oprava navigace šipky v kartě "Týden X"

## Problém

Šipka (ChevronRight) v modré kartě "Týden X" na domovské stránce aktuálně přesměrovává na `/training`, ale uživatel chce, aby vedla na stejné místo jako tlačítko "Vše" - tedy na `/profile/plan` (stránka "Můj plán" s kalendářem a detaily).

## Řešení

Změnit `onClick` handler tlačítka šipky z:
```tsx
onClick={() => navigate('/training')}
```
na:
```tsx
onClick={() => navigate('/profile/plan')}
```

## Soubor ke změně

| Soubor | Změna |
|--------|-------|
| `src/pages/Home.tsx` | Řádek 267: změnit navigaci z `/training` na `/profile/plan` |

## Vizuální kontext

```text
┌─────────────────────────────────────────────────────┐
│  ✨ Týden 1                              [→]  ◄──── Tato šipka
│     Nabrat svaly                                    │
│  Celkový progress                          0%       │
│  ════════════════════════════════════════           │
└─────────────────────────────────────────────────────┘

Nadcházející tréninky                     [Vše >] ◄── Stejná destinace
```

## Očekávaný výsledek

Po kliknutí na šipku v kartě "Týden X" bude uživatel přesměrován na stránku `/profile/plan` - centralizovanou správu plánu s kalendářem týdnů a detaily.
