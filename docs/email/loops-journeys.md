# Pumplo e-maily v Loops — journeys M3–M8 (spec ke stavbě)

Stav: texty M3–M8 a privacy odstavce o e-mailech / Loops **schválil David 18. 10. 2026**.
Nový uvítací e-mail **M0 Vítej** (text zadal David 18. 10. 2026) — jeho privacy odstavec `privacy.emails_welcome_loops` **ČEKÁ NA SCHVÁLENÍ DAVIDA**.
Rozhodnutí: obchodní e-maily (journeys + vizuální editor) běží v **Loops** (loops.so).
**Supabase zůstává zdrojem pravdy**, kdo smí obchodní e-mail dostat: právní brána, souhlas,
odmítnutí, odhlášení a blokované adresy.

## Jak to do sebe zapadá

| Kdo | Co dělá |
|---|---|
| `supabase/functions/loops-sync` (cron každou hodinu v :40) | **M0 Vítej** (transactional, všem novým jednou, viz níže) + posílá do Loops **jen kontakty s `marketingAllowed = true`** (z `email_eligible_users`) a jejich události počítané z DB. Výchozí `LOOPS_DRY_RUN=true` = jen log. |
| `supabase/functions/loops-webhook` | Odhlášení v Loops → `user_profiles.email_unsubscribed_at`; odeslaný e-mail → `contact_log` (ranní push ten den vynechá); hard bounce / spam → `email_suppressions`; vše do `email_events`. |
| `supabase/functions/lifecycle-emails` | Dál posílá **jen M2A** (servisní, přes Resend, beze změny). M3–M8 už neposílá. |
| Loops | Journeys níže, editor, šablony, statistiky. |

**Minimalizace dat:** do Loops jde jen kontakt, který smí dostávat obchodní e-maily
(`marketingAllowed = true`). Kdo to ztratí (odmítne tipy, stáhne souhlas, odhlásí se, bounce/spam,
stane se staff, smaže účet), tomu loops-sync **kontakt v Loops smaže** (`POST /v1/contacts/delete`)
a důvod zapíše do `loops_contacts.removed_reason` (`marketing_not_allowed` / `not_eligible` /
`account_deleted`) + log funkce. Vrátí se, až znovu splní `marketingAllowed`.
M2A (servisní) zůstává v našem systému, Loops tedy nikoho jiného nepotřebuje.

## ⚠️ Povinné pravidlo pro KAŽDOU obchodní journey

**Audience filtr: `marketingAllowed` is `true`.** A před každým e-mailem v journey ještě jednou
Branch na `marketingAllowed = true` (hodnota se může mezi čekáním změnit — loops-sync ji
aktualizuje každou hodinu a posílá ji i s každou událostí).

`marketingAllowed` = stejná právní brána jako F1 (§ 7 odst. 3 zák. 480/2004 Sb.):
souhlas v appce **NEBO** (při registraci nabídnuté odmítnutí **A** neodmítl **A** neodhlásil se).
Uživatel z buildu v obchodě bez zaškrtávátka a bez souhlasu má `false` → do Loops se vůbec nedostane.
Filtr v journeys je druhá pojistka (hodnota se může změnit mezi syncem a odesláním).

**Udržovací journeys M6–M8 (J3, J4, J5) navíc filtrují `retentionEmailsAllowed = true`**
— `false`, když si uživatel v appce vypnul comeback připomínky (`notification_comeback = false`).

Každý e-mail v Loops musí v patičce mít: „Obchodní sdělení“, GynTools CZ s.r.o., IČ 27804461,
proč e-mail přišel, odkaz na odhlášení (Loops ho doplňuje sám — nesmazat).

## Kontaktní vlastnosti (vytvořit v Loops → Audience → Properties před prvním syncem)

| API název | Typ | Obsah |
|---|---|---|
| `firstName` | výchozí | křestní jméno (jen první slovo) |
| `userGroup` | výchozí | `activation` (0 tréninků) / `retention` (≥ 1) |
| `language` | String | `cs` / `en` |
| `gymName` | String | název vybrané posilovny (chybí = bez posilovny) |
| `workoutsCompleted` | Number | počet dokončených tréninků |
| `lastWorkoutAt` | Date | poslední dokončený trénink |
| `signupAt` | Date | registrace |
| `onboardingCompleted` | Boolean | dotazník dokončen |
| `hasPlan` | Boolean | má aktivní plán |
| `marketingAllowed` | Boolean | **právní brána — filtr všech obchodních journeys** |
| `retentionEmailsAllowed` | Boolean | **comeback připomínky zapnuté — filtr M6–M8** |

Nikdy se neposílá: zranění, váha, výška, věk, pohlaví, motivace (hlídá test + CI).

## Události (posílá loops-sync, idempotentně přes `loops_event_log`)

| Událost | Kdy | eventProperties |
|---|---|---|
| `signed_up` | registrace (do 48 h zpět) | — |
| `onboarding_completed` | dotazník hotový = vznikl první plán | `hasGym`, `gymName` |
| `plan_ready` | plán postavený pro stroje posilovny (= „Začít trénink“), nebo po dotazníku bez posilovny | `gymName`, `noGym` |
| `first_workout_completed` | první dokončený trénink | `gymName`, `workoutsCompleted` |
| `workout_completed` | každý dokončený trénink | `gymName`, `workoutNumber` |
| `inactive_21d` | 21–24 dní od posledního tréninku, jednou na výpadek, max 2× / 90 dní | `workoutsCompleted`, `daysSinceLastWorkout` |
| `plan_slowing` | zpomalení plánu (definice M7 z 1. 10.), max 1× / 21 dní | `trainingsPerWeek`, `workoutsLast14d` |

Okamžikové události jdou jen 48 h zpět → po zapnutí nedojde k hromadnému rozeslání staré historie.
Event properties se v editoru vkládají přes `{` → dynamický obsah (`{EVENT_PROPERTY:gymName}`), fungují jen v e-mailech uvnitř workflow.

## Rozdíly proti F1 (vědomě)

- **Strop 1 kontakt / den napříč kanály** Loops neumí. Náhrada: každý e-mail z Loops se přes webhook
  zapíše do `contact_log` a ranní push ten den vynechá. Opačně (push → e-mail) se e-mail nepozdrží.
- **Vypnutý comeback push** (`notification_comeback=false`) = zákaz M6–M8 jako v F1, přes vlastnost
  `retentionEmailsAllowed` (posílá se s kontaktem i s každou událostí).
- Slot 16:30: nastavit v Loops odesílací čas, pokud to workflow umí; jinak čekání volit tak, aby
  e-mail šel odpoledne.

---

## J1 — Aktivace po dotazníku (M3A / M3B → M5)

- **Trigger:** událost `onboarding_completed`, jednou na kontakt.
- **Audience filtr:** `marketingAllowed = true`.
- **Průběh:**
  1. Wait 20 h.
  2. Branch: `workoutsCompleted = 0` a `marketingAllowed = true`, jinak **exit**.
  3. Branch podle `gymName`: vyplněno → **M3A**, prázdné → **M3B**.
  4. Wait 6 dní (≈ den 7–8 od dotazníku).
  5. Branch: `workoutsCompleted = 0` a `marketingAllowed = true`, jinak **exit**.
  6. **M5**.
- **Exit:** první trénink (`workoutsCompleted > 0`), `marketingAllowed = false`, odhlášení.
- Pozn.: kdo mezitím stiskne „Začít trénink“, dostane i J2 (M4). Pokud M4 odešel, M5 poslat stejně (F1 to tak měl: M5 uzavírá aktivaci).

### M3A — Plán pro {gymName} je připravený
_Náhled:_ Cviky jsou vybrané podle strojů, které tam opravdu mají.

> Ahoj,
>
> plán máš hotový a posilovnu vybranou: {gymName}. Cviky v něm jsou podle strojů, které tam opravdu mají.
>
> Až tam příště budeš, stačí v appce ťuknout na Začít trénink. Appka tě provede cvik po cviku.
>
> **[Otevřít Pumplo](https://app.pumplo.com/)**

EN: *Your plan for {gymName} is ready* — your plan is ready and your gym is set: {gymName}. The exercises match the machines they really have there. Next time you are there, just tap Start workout in the app. It walks you through exercise by exercise. **Open Pumplo**.

### M3B — Kde cvičíš?
_Náhled:_ Plán skládáme podle strojů v tvé posilovně. Nebo i bez ní.

> Ahoj,
>
> dotazník máš hotový. Aby ti Pumplo poskládalo trénink na míru, potřebuje vědět, kde cvičíš. Cviky vybírá podle strojů, které tam opravdu mají. Posilovnu vybereš v appce na mapě.
>
> Cvičíš doma nebo tvoje fitko v seznamu není? Zvol „Nejsem v žádné z těchto posiloven“, vyber, co máš k dispozici, a trénink poskládáme z toho.
>
> A když nám odpovíš názvem své posilovny, rádi se jí ozveme.
>
> **[Vybrat posilovnu](https://app.pumplo.com/)**

EN: *Where do you train?* — your questionnaire is done. To build a workout that fits you, Pumplo needs to know where you train: it picks exercises for the machines your gym really has. You choose your gym on the map in the app. Training at home, or your gym is not on the list? Choose “I am not in any of these gyms”, pick the equipment you have and we build the workout from that. And if you reply with the name of your gym, we will get in touch with them. **Choose your gym**.

(Odpovědi s názvem posilovny = B2B lead → reply-to musí být čtená schránka.)

### M5 — Můžu se na něco zeptat?
_Náhled:_ Stačí odpovědět jedním slovem. **Prostý text, bez tlačítka a bez grafiky** (podpis David, odesílatel stejný jako u ostatních).

> Ahoj,
>
> tady David z Pumpla. Před týdnem vznikl tvůj tréninkový plán, ale první trénink zatím nepřišel. Nechci tě přemlouvat, jen mě zajímá: co ti brání?
>
> Stačí odpovědět jedním slovem: čas / nevím, jak začít / appka / posilovna / jiné. Čtu to sám a podle odpovědí appku opravujeme.
>
> David

EN: *Can I ask you something?* — this is David from Pumplo. Your training plan was created a week ago, but the first workout has not happened yet. I do not want to push you, I would just like to know: what is in the way? A one-word reply is enough: time / not sure how to start / the app / the gym / something else. I read the replies myself and we fix the app based on them. David

---

## J2 — Spustil, nedokončil (M4)

- **Trigger:** událost `plan_ready`, jednou na kontakt. (Událost s `noGym = true` přijde hned po dotazníku bez posilovny — pro ni Branch `gymName` prázdné → **exit**.)
- **Audience filtr:** `marketingAllowed = true`.
- **Průběh:** Wait 20 h → Branch `workoutsCompleted = 0`, `marketingAllowed = true`, `gymName` vyplněno a `signupAt` nejvýš 7 dní zpět, jinak **exit** → **M4**.
- **Exit:** první trénink, `marketingAllowed = false`.
- F1 jemnost „pokud zítra není tréninkový den, počkat až 72 h“ se do Loops nepřenáší (dny v týdnu se neposílají). Volitelně Wait 44 h místo 20 h.

### M4 — První trénink na tebe počká
_Náhled:_ Obsazený stroj vyměníš jedním ťuknutím.

> Ahoj,
>
> první trénink v Pumplu máš nachystaný, jen ještě nedoběhl do konce. To se stává: obsazený stroj, málo času, nejasný cvik.
>
> Obsazený stroj vyměníš přímo u cviku tlačítkem Vyměnit cvik. A když musíš odejít dřív, trénink pozastavíš a dokončíš později.
>
> **[Otevřít první trénink](https://app.pumplo.com/)**
>
> Něco nefungovalo? Odpověz na tenhle e-mail, čteme to.

EN: *Your first workout is waiting for you* — your first Pumplo workout is set up, it just has not reached the finish yet. That happens: a busy machine, little time, an unclear exercise. A busy machine is swapped right at the exercise with the Swap exercise button. And if you have to leave early, pause the workout and finish it later. **Open your first workout**. Something did not work? Reply to this e-mail, we read every reply.

(F1 věta „Zítra máš v plánu tréninkový den.“ vypadla — Loops nezná dny plánu.)

---

## J3 — Druhý trénink (M6)

- **Trigger:** událost `first_workout_completed`, jednou na kontakt.
- **Audience filtr:** `marketingAllowed = true` **a** `retentionEmailsAllowed = true`.
- **Průběh:** Wait 2 dny → Branch `workoutsCompleted = 1`, `marketingAllowed = true` a `retentionEmailsAllowed = true`, jinak **exit** → **M6**.
- **Exit:** druhý trénink (`workoutsCompleted ≥ 2`).

### M6 — První trénink máš. Druhý je na řadě
_Náhled:_ Po druhém tréninku se z toho začne stávat zvyk.

> Ahoj,
>
> první trénink máš za sebou. To je ten nejtěžší krok.
>
> Druhý trénink je ten, po kterém se z toho začne stávat zvyk.
>
> **[Otevřít druhý trénink](https://app.pumplo.com/)**

EN: *First workout done. The second one is next* — your first workout is done. That is the hardest step. The second workout is the one that starts turning it into a habit. **Open your second workout**.

---

## J4 — Zpomalení plánu (M7)

- **Trigger:** událost `plan_slowing`, **pokaždé** (opakování hlídá loops-sync: max 1× / 21 dní).
- **Audience filtr:** `marketingAllowed = true` **a** `retentionEmailsAllowed = true`.
- **Průběh:** Branch `marketingAllowed = true` a `retentionEmailsAllowed = true` → **M7**. Bez čekání.
- **Exit:** — (jeden e-mail).
- Záměrně neradit „sniž počet dní“ (nový plán vynuluje postup).

### M7 — Tento týden stačí jeden trénink
_Náhled:_ Plán na tebe počká, nic se neztratilo.

> Ahoj,
>
> tvůj plán je nastavený na {EVENT_PROPERTY:trainingsPerWeek}× týdně. Poslední dva týdny byly asi nabité. Týden má někdy jiné plány a to je v pořádku.
>
> Vyber si tento týden jeden den, kdy to dáš. Plán pojede dál od dalšího tréninku, nic se neztratilo.
>
> **[Otevřít Pumplo](https://app.pumplo.com/)**

(Když `trainingsPerWeek = 0` = dny neznáme, první věta zní „Tvůj plán počítá s pravidelnými tréninky.“ — v Loops buď Branch na event property, nebo použít jen obecnou větu.)

EN: *One workout this week is enough* — Your plan is set to {trainingsPerWeek}× a week. The last two weeks were probably busy. Some weeks have other plans and that is fine. Pick one day this week when you will make it. Your plan continues with the next workout, nothing is lost. **Open Pumplo**.

---

## J5 — Návrat po pauze (M8)

- **Trigger:** událost `inactive_21d`, **pokaždé** (loops-sync: jednou na výpadek, max 2× / 90 dní).
- **Audience filtr:** `marketingAllowed = true` **a** `retentionEmailsAllowed = true`.
- **Průběh:** Branch `marketingAllowed = true` a `retentionEmailsAllowed = true` → **M8**.
- **Exit:** —. Comeback push má den 23; e-mail přijde den 21–22, push skip přes `contact_log` řeší jen ranní push ten den.

### M8 — Nezačínáš od nuly
_Náhled:_ Stačí jeden trénink a jsi zpátky.

> Ahoj,
>
> od posledního tréninku uběhly zhruba tři týdny. Nezačínáš ale od nuly: v Pumplu máš za sebou {workoutsCompleted} tréninků a plán pokračuje dalším tréninkem.
>
> Stačí jeden trénink a jsi zpátky.
>
> **[Otevřít Pumplo](https://app.pumplo.com/)**

(F1 skloňoval „1 trénink / 3 tréninky / 7 tréninků“. V Loops buď Branch podle `workoutsCompleted` (1 / 2–4 / 5+), nebo formulace „počet tréninků v Pumplu: {workoutsCompleted}“.)

EN: *You are not starting from zero* — it has been about three weeks since your last workout. But you are not starting from zero: you have {workoutsCompleted} workouts saved in Pumplo and your plan continues with the next one. One workout and you are back. **Open Pumplo**.

---

## M0 Vítej — od zakladatelů (transactional, všem novým jednou)

**Co to je:** servisní/onboardingový e-mail (kdo za Pumplem stojí, jak začít), **bez propagace**.
Právní základ plnění smlouvy (čl. 6 odst. 1 písm. b) GDPR) → **nepotřebuje `marketingAllowed`**,
ale **respektuje odhlášení** (`email_unsubscribed_at`) a **blokované adresy** (`email_suppressions`).

**Jak se posílá (hotovo v kódu, `loops-sync`):**
- Kandidáti = `email_eligible_users` (přes `loops_contact_facts`; bez demo, staff, odhlášených, suppressions),
  účet založený **v posledních 72 h** (po zapnutí tedy žádné hromadné rozeslání starým účtům).
- Jednou za život: zámek = řádek `email_sends` (`template_key 'M0'`, `episode_key 'life'`, unique) založený
  **před** odesláním + `Idempotency-Key` `<userId>:M0:life`.
- `POST /api/v1/transactional` s `addToAudience: false` → člověk se tím **nedostane do audience** obchodních e-mailů.
- Po odeslání řádek `contact_log` (`channel 'email'`, `type 'welcome'`) → ranní push ten den vynechá.
  (Webhook `transactional.email.sent` zapíše do `contact_log` ještě jeden řádek se zdrojem — neškodí.)
- Bez `LOOPS_WELCOME_TRANSACTIONAL_ID` se M0 přeskočí a zaloguje; `LOOPS_DRY_RUN=true` jen vypíše, komu by šel.
- Chyba Loops 5xx / 429 → zámek se uvolní a příští běh to zkusí znovu; 4xx (např. nepublikovaný e-mail)
  → řádek zůstane `failed` s chybou, neopakuje se (po opravě smazat ručně, pokud má jít znovu, do 72 h).
- Pozn.: M2A (servisní připomínka dotazníku, 2 h po registraci, Resend) běží dál — nový člověk tak může
  dostat M0 i M2A v jeden den. Pokud to bude vadit, M2A posunout.

**Data variables (Loops → transactional e-mail → Data variables):**

| Název | Typ | Poznámka |
|---|---|---|
| `firstName` | String, **optional** | křestní jméno (první slovo); když chybí, neposílá se → v editoru označit jako optional |
| `language` | String | `cs` / `en` — v Loops buď dvě transactional verze, nebo Branch/Conditional podle jazyka |

Nic dalšího (žádná posilovna, souhlasy, tělesné údaje).

**Nastavení v Loops:** Transactional → New → název „M0 Vítej“, odesílatel `Pumplo <zpravy@pumplo.com>`,
reply-to `zpravy@pumplo.com` (odpovědi čteme my tři) → vložit text níže → Publish → zkopírovat Transactional ID →
`LOOPS_WELCOME_TRANSACTIONAL_ID` (viz Setup checklist). Patička **bez** „Obchodní sdělení“ (je servisní),
ale s firmou: „GynTools CZ s.r.o., IČ 27804461 · Tento e-mail ti přišel, protože sis založil(a) účet v Pumplu.“

**Rozvržení (návrh):**
- Hlavička navy `#0B1222`, bílé logo pumplo.
- Pod ní **tři kulaté fotky vedle sebe** (96 px, kruh, rámeček 3 px cyan `#4CC9FF`), pod každou jméno:
  - David Novotný — fotku nahraje David (v DB je jen avatar u demo trenéra: `https://udqwjqgdsjobdufdxbpn.supabase.co/storage/v1/object/public/avatars/2e70d26e-ff70-44b7-a4fe-a6902f409c7b/avatar.jpeg` — použít jen pokud ji David schválí)
  - David „Benda“ Beníšek — `https://udqwjqgdsjobdufdxbpn.supabase.co/storage/v1/object/public/gym-assets/trainers/benisek.jpg`
  - Adam Kakiš — `https://auth.pumplo.com/storage/v1/object/public/gym-assets/trainers/9ca7aeaf-32d1-4988-b0ca-c820e8242067/1791484949038.png`
  (URL z `gym_trainers.photo_url`, read-only dotaz 18. 10. 2026.)
- Tělo bílé, text `#111111`, 16 px; „Jak začít“ jako číslovaný seznam s cyan číslicemi; žádné tlačítko
  s nabídkou — nejvýš nenápadný odkaz „Otevřít Pumplo“ na `https://app.pumplo.com/`.

### M0 (cs) — Vítej v Pumplu, tady David, Benda a Adam
_Náhled:_ Kdo za Pumplem stojí a jak začít.

_Oslovení v Loops:_ `Ahoj` + optional data variable `firstName` s mezerou před ním jen když je vyplněné (Loops: Dynamic content → Data variable `firstName`, fallback prázdný). Bez jména tedy jen „Ahoj,“.

> Ahoj{{firstName? ' ' + firstName}},
>
> vítej v Pumplu. Jsme malý tým a Pumplo děláme proto, aby se nikdo v posilovně necítil ztracený a věděl přesně, co dnes cvičit.
>
> **David Novotný** — Pumplo založil a stará se o appku. Když ti něco nefunguje, píšeš vlastně jemu.
>
> **David „Benda“ Beníšek** — hlavní trenér a spoluzakladatel. 12 let trénuje klienty od úplných začátků až po první závody a stojí za cviky a plány, podle kterých budeš cvičit.
>
> **Adam Kakiš** — trenér se zaměřením na nabírání svalů a hubnutí, v posilovně je 11 let. Natáčí cviky a připravuje hotové tréninky.
>
> **Jak začít:**
> 1. Otevři svůj plán na Domů — je poskládaný podle strojů tvé posilovny.
> 2. V posilovně ťukni na Začít trénink, appka tě provede cvik po cviku i s videem.
> 3. Na strojích najdeš samolepky s QR kódem — naskenuj a uvidíš, co se na stroji dá cvičit.
>
> Cokoli tě napadne, odpověz na tenhle e-mail. Čteme to my tři.
>
> David, Benda a Adam

### M0 (en) — Welcome to Pumplo, this is David, Benda and Adam
_Preview:_ Who is behind Pumplo and how to get started.

> Hi{{firstName? ' ' + firstName}},
>
> welcome to Pumplo. We are a small team and we build Pumplo so that nobody feels lost in the gym and everyone knows exactly what to train today.
>
> **David Novotný** — founded Pumplo and looks after the app. If something does not work for you, you are actually writing to him.
>
> **David “Benda” Beníšek** — head coach and co-founder. He has been coaching clients for 12 years, from complete beginners to their first competitions, and he is behind the exercises and plans you will train with.
>
> **Adam Kakiš** — a coach focused on building muscle and losing weight, 11 years in the gym. He films the exercises and prepares ready-made workouts.
>
> **How to start:**
> 1. Open your plan on Home — it is built for the machines in your gym.
> 2. At the gym, tap Start workout and the app guides you exercise by exercise, with videos.
> 3. On the machines you will find stickers with a QR code — scan it to see what you can train on that machine.
>
> Anything on your mind, just reply to this e-mail. The three of us read it.
>
> David, Benda and Adam

---

## M1 — po skenu QR kódu (pozdější fáze, ZATÍM NESTAVĚT)

Scénář: člověk bez účtu naskenuje samolepku na stroji (`/s/<short_code>`, `StationPage`) a nechá e-mail.
**Požadavek Davida (18. 10. 2026): e-mail musí být VŽDY personalizovaný podle toho, CO naskenoval:**
posilovna, stroj, 2–3 cviky, které se na tom stroji dají dělat, a odkaz zpátky přímo na to stanoviště.
Bez těchto údajů M1 **neodesílat** (žádná generická verze).

**Zdroj dat** (stejně jako `src/hooks/useStationData.ts`):
- `gym_machines` podle `short_code` → `machine_id`, `gym_id`, `machines(name, name_en)`;
- `gyms.name` podle `gym_id`;
- `exercises` kde `machine_id = <machine_id>` **NEBO** `secondary_machine_id = <machine_id>` (stanoviště „Osa“
  sdružuje cviky s osou z half racku, benche a platformy) → vybrat 2–3 (přednostně s videem, stabilní pořadí).

**Data variables (návrh):**

| Název | Typ | Obsah |
|---|---|---|
| `gymName` | String | název posilovny (`gyms.name`) |
| `machineName` | String | název stroje v jazyce člověka (`machines.name` / `name_en`, fallback `name`) |
| `exercise1` | String | 1. cvik (`exercises.name` / `name_en`) |
| `exercise2` | String | 2. cvik |
| `exercise3` | String, optional | 3. cvik, když existuje |
| `exerciseCount` | Number | kolik cviků stanoviště celkem má („a dalších N cviků“) |
| `stationUrl` | String | `https://app.pumplo.com/s/<short_code>` — odkaz zpátky na stanoviště |
| `language` | String | `cs` / `en` |

Otevřené otázky před stavbou: právní základ (souhlas při zadání e-mailu, ne § 7/3 — člověk ještě není zákazník),
kde se e-mail ukládá (tabulka leadů vs. Loops kontakt), dvojí potvrzení, a co když stroj má < 2 cviky (pak M1 neposlat).

---

## M2A — servisní (zatím zůstává v Supabase)

Běží dál v `lifecycle-emails` přes Resend (schválená šablona, dry run podle `EMAIL_DRY_RUN`).
Případný přesun do Loops později: trigger `signed_up`, Wait 2 h, Branch `onboardingCompleted = false`
(do 72 h od registrace), **bez** filtru `marketingAllowed` (servisní, čl. 6/1/b), ale s respektem
k odhlášení. Do té doby v Loops M2A **nestavět** — jinak by šel dvakrát.

## Styl pro editor Loops (Pumplo brand)

- **Pozadí hlavičky:** navy `#0B1222`, logo bílé — wordmark „pumplo“ **Nunito 900** (logo jako obrázek PNG, e-mailoví klienti Nunito nemají: `https://app.pumplo.com/pumplo-icon-512.png` nebo export wordmarku).
- **Akcent / tlačítko:** cyan `#4CC9FF`, text tlačítka navy `#0B1222`, zaoblení 12 px, jedno tlačítko na e-mail.
- **Tělo:** bílé pozadí, text `#111111`, systémové písmo (-apple-system, Segoe UI, Roboto, Helvetica, Arial), 16 px, řádkování 1,5, šířka max 480–560 px.
- **Patička:** šedá `#6B7280`, 12 px: „Obchodní sdělení · GynTools CZ s.r.o., IČ 27804461 · Přišlo ti to, protože máš účet v Pumplu a zasílání tipů jsi neodmítl(a). · Odhlásit“.
- **Tón:** tykání, krátké věty, žádné výčitky, nikdy tělo/váha/zranění. M5 prostý text bez grafiky.
- **Odesílatel (rozhodnutí Davida):** přesně `Pumplo <zpravy@pumplo.com>` u všech e-mailů včetně M5, **reply-to stejný** `zpravy@pumplo.com` (odpovědi M3B/M5 musí někdo číst).

## Setup checklist pro Davida (v tomto pořadí)

1. **Účet:** založit na loops.so (team Pumplo), vyplnit firmu GynTools CZ s.r.o., podepsat DPA (SCC) v nastavení.
2. **Sending domain:** odesílatel je `Pumplo <zpravy@pumplo.com>` → v Loops Settings → Domain zadat `pumplo.com`. Loops ukáže záznamy (MX + TXT/SPF na `envelope.pumplo.com`, DKIM CNAME, případně DMARC) → přidat v **Cloudflare** DNS zóně pumplo.com, u CNAME **DNS only** (šedý mráček). Stávající záznamy Resendu (stejná adresa pro M2A) **nemazat** — Loops má vlastní DKIM selektor a SPF na envelope subdoméně. Pak Verify Records. Výchozí odesílatel + reply-to: `zpravy@pumplo.com`.
3. **Vlastnosti kontaktu:** vytvořit podle tabulky výše (přesné API názvy a typy — později nejdou měnit).
4. **API klíč:** Settings → API → Generate key, pak
   `supabase secrets set LOOPS_API_KEY=… LOOPS_DRY_RUN=true --project-ref udqwjqgdsjobdufdxbpn`
4b. **M0 Vítej:** Transactional → postavit podle sekce M0, `firstName` jako optional, Publish → ID do schránky →
   `supabase secrets set LOOPS_WELCOME_TRANSACTIONAL_ID="$(pbpaste)" --project-ref udqwjqgdsjobdufdxbpn`.
   Bez tohoto secretu loops-sync M0 přeskočí (a zaloguje).
5. **Nasadit (po merge PR):** migrace `20261019_email_f1.sql`, pak `20261019b_loops.sql`;
   `supabase functions deploy loops-sync loops-webhook lifecycle-emails --project-ref udqwjqgdsjobdufdxbpn`
   (loops-webhook a loops-sync mají `verify_jwt = false` v config.toml).
6. **Webhook:** Loops → Settings → Webhooks → endpoint
   `https://udqwjqgdsjobdufdxbpn.supabase.co/functions/v1/loops-webhook`, události: contact.unsubscribed,
   email.unsubscribed, email.resubscribed, campaign/loop/transactional.email.sent, email.delivered,
   email.opened, email.clicked, email.softBounced, email.hardBounced, email.spamReported →
   `supabase secrets set LOOPS_WEBHOOK_SECRET=whsec_… --project-ref udqwjqgdsjobdufdxbpn` → Send test event.
7. **Cron:** odkomentovat a spustit blok z `20261019b_loops.sql` (loops-sync v :40).
   Ručně: `curl -X POST …/functions/v1/loops-sync -H "Authorization: Bearer $CRON_SECRET"` → v dry runu vrátí, co by poslal.
8. **Journeys:** postavit J1–J5 podle tohoto dokumentu, **každá s filtrem `marketingAllowed = true`, J3–J5 navíc `retentionEmailsAllowed = true`**, nechat v draftu.
9. Po kontrole dry-run výstupu: `supabase secrets set LOOPS_DRY_RUN=false` → kontakty a události tečou do Loops. Journeys zapínat jednotlivě až po schválení textů.
10. Zásady: `privacy.emails_*` a `privacy.emails_processor_loops` schválil David 18. 10. 2026; **`privacy.emails_welcome_loops` (M0) ČEKÁ NA SCHVÁLENÍ DAVIDA** — schválit před zapnutím M0 naostro (`LOOPS_DRY_RUN=false`).
