# Trenérský systém — Pozvánkový flow

> Status: PLÁNOVÁNO
> Poslední update: 2026-04-05
> Autor: David Novotný + Claude

## Současný stav (špatně)
- Majitel ručně vyplňuje profil trenéra v admin dashboardu
- Trenér může poslat žádost z member appky, ale majitel musí schválit a data se nepropojí čistě

## Nový flow

### 1. Majitel posílá pozvánkový link
- V admin dashboardu tab "Trenéři" → tlačítko "Pozvat trenéra"
- Vygeneruje se unikátní link: `pumplo.vercel.app/become-trainer?gym=UUID&invite=INVITE_CODE`
- Majitel ho pošle trenérovi (WhatsApp, SMS, email)

### 2. Trenér otevře link v member appce
- **Nový uživatel**: link ho hodí do registrace → po registraci rovnou na `/become-trainer` s předvyplněnou posilovnou
- **Existující uživatel (člen)**: link ho hodí na `/become-trainer` s předvyplněnou posilovnou
- **Existující trenér (v jiné posilovně)**: zobrazí se "Přidat se k posilovně [název]" → jedním klikem potvrdí

### 3. Trenér vyplní svůj profil sám
- Fotka, bio, specializace, certifikace, ceník, kontakty
- Vše na jednom místě v member appce (`/trainer-profile`)

### 4. Majitel schvaluje/zamítá
- V admin dashboardu vidí žádost s kompletním profilem (trenér ho vyplnil sám)
- Jen klikne Schválit/Zamítnout
- Nemusí nic vyplňovat

### 5. Odebrání vztahu
- **Trenér** se může sám odebrat z posilovny (v member appce)
- **Majitel** může trenéra odebrat (v admin dashboardu)
- Obojí smaže záznam v `gym_trainers`, ne účet trenéra

## DB změny
- Nová tabulka `gym_trainer_invites` (gym_id, invite_code, created_at, used_at, used_by)
- Nebo rozšíření `trainer_gym_requests` o invite_code

## Soubory k úpravě
- **Member app**:
  - `src/pages/BecomeTrainer.tsx` — přidat detekci invite linku
  - `src/pages/TrainerProfile.tsx` — profil správa
- **Admin app**:
  - `src/pages/GymProfilePage.tsx` — trenéři tab: odebrat formulář "Nový trenér", přidat "Pozvat trenéra" (generuje link)
  - Schvalování žádostí zůstává

## Odhad: 2-3 dny
