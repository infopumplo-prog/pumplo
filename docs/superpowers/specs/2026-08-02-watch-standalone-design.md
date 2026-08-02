# Samostatné hodinky — Pumplo bez telefonu

**Datum:** 2. 8. 2026
**Stav:** návrh ke schválení
**Navazuje na:** `2026-08-02-watch-v2-design.md` (hodinky v2 — ovládání prstem, vlastní trénink, spouštění z hodinek)

## Proč

Dnešní hodinková appka je **displej telefonu**. Trénink počítá webová vrstva v Capacitoru, hodinky jen zobrazují snapshot a posílají zpět akce. Když Pumplo v telefonu neběží, hodinky nemají s kým mluvit.

David to při zkoušce na zápěstí shrnul takhle: *„sere mě, že Hevy na telefonu zapnout vůbec nemusím, ale Pumplo jo, aby mi to fungovalo."* Hevy má na hodinkách skutečnou appku, která si sama sáhne na server.

Rozhodnutí (David, 2. 8. 2026): **postavit plnou samostatnost.** Mezikrok s předvařeným tréninkem posílaným z telefonu byl nabídnut a zamítnut.

## Rozhodnutí, ze kterých návrh vychází

| Otázka | Rozhodnutí |
|---|---|
| Přihlášení | Hodinky **převezmou přihlášení z telefonu jednorázově**. Žádné psaní hesla na displeji hodinek. |
| Zdroj tréninku | **Serverová funkce**, která trénink složí. Pravidla plánu zůstanou na jednom místě. |
| Rozsah první verze | **Plánový i vlastní tréninky.** |

## Architektura

```
Apple Watch  ──(jednorázově, WCSession)──  iPhone     přihlášení
Apple Watch  ──────── HTTPS ─────────────  Supabase   obnova přístupu
Apple Watch  ──────── HTTPS ─────────────  edge fn    trénink + zápis
```

Hodinky přestávají být displejem a stávají se klientem. Telefon je potřeba **jednou** — při prvním spárování, aby předal přístup.

### Proč serverová funkce, a ne dotazy z hodinek přímo do tabulek

Pravidla „který cvik dnes, kolik sérií, jaké rozmezí opakování, jaké RIR, jak dlouhá pauza" dnes žijí v TypeScriptu (`useWorkoutPlan.getCurrentDayExercises`, `trainingGoals.ts`, per-kategorii pauzy ve `WorkoutSession`). Přepsat je do Swiftu znamená **dvě kopie týchž pravidel**, které se rozejdou — a rozdíl se pozná až tak, že hodinky ukazují jiná čísla než appka.

Nová edge funkce **`watch-api`** je proto jediné místo, kde se trénink skládá. Když se pravidla změní, hodinky to umí hned, bez nového buildu a bez schvalování v App Storu. Stejnou funkci využije i budoucí Wear OS klient.

## Přihlášení

### Předání

Telefon při aktivní `WCSession` pošle hodinkám relaci přes `transferUserInfo` (spolehlivé doručení, na rozdíl od `sendMessage`): `access_token`, `refresh_token`, `expires_at`, `user_id`. Posílá se při přihlášení a při každé obnově relace v telefonu, aby hodinky nikdy nedržely mrtvý token, dokud je telefon po ruce.

### Uložení

Keychain na hodinkách, `kSecAttrAccessibleAfterFirstUnlock`. Nikdy `UserDefaults` — refresh token je přihlašovací údaj.

### Obnova bez telefonu

Hodinky si přístup obnovují samy: `POST {SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`. Obnovuje se, když do vypršení zbývá méně než pět minut, a vždy po probuzení appky.

Když obnova selže (token odvolán, změna hesla), hodinky ukážou **„Přihlas se v telefonu"** a čekají na nové předání. Nikdy nesmí tiše ukazovat prázdno.

## Serverová funkce `watch-api`

Autentizace hlavičkou `Authorization: Bearer <access_token>`, uživatel se bere z tokenu — nikdy z těla požadavku.

### `GET /watch-api/menu`

Co nabídnout na hodinkách, když trénink neběží.

```json
{
  "resume": { "kind": "custom", "planId": "…", "dayId": "…", "label": "Push Pull · Push" },
  "plan": { "label": "Trénink A", "dayLetter": "A", "exerciseCount": 6 },
  "customDays": [ { "planId": "…", "dayId": "…", "label": "Push Pull · Push" } ]
}
```

### `GET /watch-api/workout?kind=plan` / `?kind=custom&planId=…&dayId=…`

Hotový trénink k odcvičení. Tohle je **jediné místo**, kde se plán překládá na cviky.

```json
{
  "title": "Trénink A",
  "kind": "plan",
  "planId": "…", "gymId": "…", "dayLetter": "A", "goalId": "…",
  "exercises": [
    {
      "exerciseId": "…", "name": "Šikmý tlak na prsa", "nameEn": "Incline bench press",
      "slotCategory": "main",
      "sets": 4, "repMin": 8, "repMax": 12, "rir": 2,
      "targetWeight": 40, "restSeconds": 120,
      "isCardio": false, "durationSeconds": null,
      "thumbUrl": "https://…/thumb.jpg"
    }
  ]
}
```

Kardio cviky z vlastních plánů mají `isCardio: true` a `durationSeconds`.

### `POST /watch-api/complete`

Uloží odcvičený trénink. Dělá **přesně to, co dnes dělá telefon**, aby historie nezávisela na tom, odkud trénink přišel:

1. `workout_sessions` — jeden řádek (souhrny série, opakování, objem, trvání).
2. `workout_session_sets` — dávka na cvik, aby historie držela pořadí.
3. **Jen u plánového tréninku:** posun plánu na další den, tedy `user_profiles.current_day_index` (dnes `advanceToNextDay`).

Bod 3 se nesmí zapomenout — bez něj by trénink z hodinek plán neposunul a appka by druhý den nabízela tentýž den.

Odpověď obsahuje `sessionId`. Volání je **idempotentní přes klientský `clientSessionId`** (UUID vyrobené na hodinkách), aby opakované odeslání z fronty nezaložilo trénink dvakrát.

## Na hodinkách

### Co se přebírá z v2 beze změny

Obrazovky `ExerciseListView`, `ActiveSetView` (korunka i tažení prstem), `RestView`, `CardioView`, `DoneView` a formátování ve `WatchWorkoutSnapshot` zůstávají. Mění se jen to, **odkud data tečou**.

### Nový stav

Trénink se drží v paměti hodinek jako `WatchSession`: seznam cviků, index aktuálního, zapsané série, začátek, konec pauzy. Po každé zapsané sérii se stav ukládá na disk hodinek, aby zabití appky uprostřed tréninku neznamenalo ztrátu.

### Offline

V posilovně bývá signál mizerný, proto:

- **Trénink se stáhne celý dopředu**, na začátku. Během cvičení hodinky síť nepotřebují.
- **Zapsané série se drží lokálně** a odesílají se až na konci jedním voláním.
- Když odeslání selže, trénink jde do **fronty na disku** a zkusí se znovu při dalším otevření appky a při naskočení sítě. Uživatel vidí „Uloží se, až bude signál", ne chybu.
- Fronta se posílá i tehdy, když uživatel mezitím odcvičí další trénink.

## Souběh s telefonem

Dva zdroje pravdy jsou past. Pravidlo: **v jednu chvíli běží trénink jen na jednom místě.**

- Když hodinky spustí vlastní trénink, oznámí to telefonu (`transferUserInfo`). Telefon při pokusu spustit trénink upozorní, že jeden běží na hodinkách.
- Když trénink běží na telefonu, telefon posílá snapshot jako dnes a hodinky se chovají jako displej — režim z v2 zůstává funkční a nepřepisuje se.
- Hodinky si tedy drží dva režimy: **vlastní trénink** a **zrcadlo telefonu**. Rozhoduje ten, kdo začal dřív.

## Milníky

Každý stojí samostatně a dá se osahat na zápěstí.

1. **Přihlášení na hodinkách** — předání z telefonu, Keychain, obnova přístupu, obrazovka „Přihlas se v telefonu". Ověření: hodinky umí zavolat Supabase se zavřeným telefonem.
2. **`watch-api` s menu a tréninkem** — serverová funkce plus testy proti tomu, co skládá appka; čísla se musí shodovat.
3. **Odcvičení na hodinkách** — stažení tréninku, průchod sériemi a pauzami, stav přežije zavření appky. Zatím bez ukládání.
4. **Uložení a fronta** — `POST /complete`, idempotence, offline fronta, posun plánu.
5. **Souběh s telefonem** — pravidlo „kdo dřív začal", hlášky na obou stranách.

## Rizika

- **Dvě kopie pravidel** — hlídá je milník 2: funkce a appka musí na stejném plánu vrátit stejné cviky, série i pauzy. Bez toho se to rozejde do měsíce.
- **Token na hodinkách** je plnohodnotné přihlášení. Keychain, nikdy ne log, a při odhlášení v telefonu se musí zneplatnit i na hodinkách.
- **Baterie** — hodinky během tréninku drží displej a odpočty. Měřit na skutečném tréninku, ne odhadovat.
- **Zapomenutý posun plánu** po tréninku z hodinek (viz `POST /complete`, bod 3).
- **Souběh** — nejzrádnější část. Když se pravidlo „kdo dřív začal" neudrží, uživatel přijde o sérii, což je horší než nefunkční hodinky.

## Mimo rozsah

- **Wear OS** — samostatný plán, ale `watch-api` je stavěná tak, aby ji použil i on.
- **Tepovka z HealthKit, zápis do Apple Fitness, complication na ciferníku.**
- **Registrace nového účtu z hodinek** — hodinky vždycky navazují na účet z telefonu.
