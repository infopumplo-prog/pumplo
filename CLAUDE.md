# Pumplo — Claude Code Context

## Co je Pumplo
SaaS retention platforma pro nezávislé fitness posilovny. Řeší vysoký churn členů (30–50 % nových členů odchází do 6 měsíců) a konkurenci řetězcových posiloven. Klíčové funkce: personalizované tréninkové plány, gamifikace, datová analytika.

Firma: **GynTools CZ s.r.o.** (IČ: 278 04 461), jednatel a jediný společník: David Novotný.

## Architektura

### Dvě části produktu
1. **Mobilní app** — postavená v Lovable, pro členy posilovny (end users)
2. **Pumplo Admin** — webový dashboard v Lovable, pro majitele posiloven (gym admins)

Obojí sdílí **stejnou Supabase instanci**.

### Tech stack
- **Frontend**: Lovable (React/TypeScript)
- **Backend**: Supabase (databáze, auth, storage)
- **Video editing**: CapCut → ffmpeg komprese → Supabase Storage
- **Data management**: Excel / openpyxl

## Supabase — technické detaily

```
Project ID: udqwjqgdsjobdufdxbpn
Public URL: https://udqwjqgdsjobdufdxbpn.supabase.co
```

### Storage buckety
- `exercise-videos` — videa cviků
- `gym-assets` — fotky posiloven

### Důležitá pravidla
- `video_path` v tabulce exercises ukládá **celou public URL** — nepřidávej base URL
- `gyms.owner_id` referencuje `auth.uid()`, ne `user_profiles.id` — používej `.eq('owner_id', user.id)` se session user objektem
- `get_users_with_email()` RPC používá `SECURITY DEFINER` pro join s `auth.users`
- `CREATE POLICY IF NOT EXISTS` je neplatné v PostgreSQL — používej `DO $$ BEGIN IF NOT EXISTS ... END $$;` blok
- DDL změny dělej přes Supabase Dashboard SQL Editor
- Storage upload: používej `--data-binary "@file"` s curl, `-T` flag je nespolehlivý

### FK deletion order
`user_workout_exercises` → `gym_machines` → `exercises` → `machines`

### Exercise count
Používej `GET /rest/v1/exercises?select=id&limit=1000` piped do Python `len()`, ne `content-range` header

## Role-based access
- `super_admin` — plný přístup (David)
- `gym_admin` — přístup jen ke své posilovně

## První zákazník
**Eurogym Olomouc** — platící pilot zákazník.
- Databáze cviků: 130+ cviků s videi
- Video pipeline: CapCut edit/loop → ffmpeg (`-vcodec libx264 -crf 28 -an -movflags faststart`, `-stream_loop 2` pro krátké/unilaterální pohyby) → upload do Supabase Storage → update `video_path`

### 6 cviků k přetočení (glute focus)
Při novém upload session vždy začni těmito — potřebují jen update `video_path`:
1. Kickback
2. Standing hip thrust
3. Hip thrust machine
4. Belt squat
5. Abduction
6. Hip extension

## Byznys kontext

### Validace
- 32 rozhovorů s majiteli posiloven
- 243 member surveys
- Eurogym director potvrdil 3 000 CZK/měsíc jako akceptovatelné, potenciál 5 000–10 000 CZK

### Pricing
- Aktuální uvažovaná cena: **5 000 CZK/měsíc** (pro nové zákazníky)
- Eurogym má existující smlouvu — opatrně před aplikací nového pricing

### Funding
- **Newton Angels**: až 500 000 CZK, David zvažuje 2 % equity (~25M CZK pre-money valuace)
- Pitch ideálně po launchi (původně 1. dubna)

## Coding guidelines

### Obecně
- Vždy TypeScript, strict mode
- Komponenty v češtině komentovat minimálně, kód psát anglicky
- Před každou větší změnou zkontroluj TypeScript errors: `npx tsc --noEmit 2>&1 | head -20`

### Supabase queries
```typescript
// Správně — použij session user
const { data: { user } } = await supabase.auth.getUser()
const { data } = await supabase.from('gyms').select('*').eq('owner_id', user.id)

// Špatně
.eq('owner_id', profile.id) // profile.id není auth.uid()
```

### Lovable workflow
- Změny v kódu přes Lovable nebo přímo v projektu
- Po změnách vždy otestuj na mobilním zařízení (Android Motorola k dispozici)

## Kontakt & přístupy
- Supabase Dashboard: https://supabase.com/dashboard/project/udqwjqgdsjobdufdxbpn
- Google Drive (Pumplo folder): `1WO49jy3Y40jtUJua4BXsBlBzO4NB2_5VikQE94am-k0`
- Excel zdroj cviků: `Stroje_eurogym_10_3_2026.xlsx`

## Skills
- UI/UX guidelines: .claude/skills/ui-ux-pro-max/
- Obsidian skills: .claude/skills/obsidian-skills/

## Knowledge Graph (Graphify RAG)
Before grepping through files for architecture or business questions, consult the knowledge graph:
- **Graph Report:** ~/Desktop/graphify-workspace/graphify-out/GRAPH_REPORT.md
- **Graph JSON:** ~/Desktop/graphify-workspace/graphify-out/graph.json
- **Query CLI:** `graphify query "<question>"`
