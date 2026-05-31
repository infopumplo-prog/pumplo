# Další session — TODO

> Stav: k implementaci
> Datum: 2026-04-05

## Opravy a doladění

### Admin dashboard
- [ ] Vyřešit Service Worker cache problém v normálním okně (admin se správně chová jen v anonymním)
- [ ] Po uložení profilu ukázat success toast/notifikaci místo scrollu nahoru

### Member app — GymProfilePreview
- [ ] Zobrazit služby (services) v detailu posilovny
- [ ] Průměrná návštěvnost — Google Places API integrace (nebo odebrat pokud není relevantní)
- [ ] Služby zobrazit jako tagy/badges

### Trenérský systém
- [ ] Otestovat celý invite flow end-to-end (majitel generuje link → trenér otevře → vyplní profil → auto-approve)
- [ ] Tlačítko "Upravit" u trenéra — nechat nebo odebrat? (majitel by neměl editovat profil trenéra)

### Registrace
- [ ] Otestovat kompletní Stripe checkout flow s novým emailem
- [ ] Success message na login stránce po úspěšné platbě

### Mapa
- [ ] Otestovat zavřené posilovny — šedé s 60% opacity

### Testy ze staršího seznamu (neotestované)
- [ ] Test admin dashboard - registration page (#14)
- [ ] Test admin dashboard - feature gating (#15)
- [ ] Test member app - featured gym pin on map (#16)
