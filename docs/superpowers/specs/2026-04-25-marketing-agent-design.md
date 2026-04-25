# Marketing Agent — Design Spec
**Datum:** 2026-04-25  
**Projekt:** Pumplo marketing automatizace  
**Autor:** David Novotný + Claude

---

## Přehled

Marketing agent postavený na Claude Code CLI s MCP servery. David ho ovládá lokálně přirozeným jazykem nebo příkazy, agent generuje obsah, grafiku a po schválení publikuje. Fáze 2 přidá Telegram rozhraní na stejné MCP servery.

---

## Architektura

```
Claude Code (lokálně)
+ marketing/CLAUDE.md (brand voice, kontext, tone of voice)
        │
        ├── Canva MCP        → grafika, posty, plakáty, šablony s Pumplo brandingem
        ├── Ayrshare API     → publikování na IG / TikTok / LinkedIn / FB
        └── GitHub MCP       → MDX blog posty commitované do Lovable web repozitáře

Fáze 2: Telegram zpráva → claude-remote bridge → stejné MCP servery
```

---

## Cílové platformy

| Platforma | Typ obsahu | Cílová skupina |
|-----------|-----------|----------------|
| LinkedIn | Founder story, B2B milestone posty, articles | Majitelé posiloven, investoři |
| Instagram | Fotky, Reels, Stories, brand posty | B2C členové, B2B |
| Facebook | Stejný obsah jako IG | B2C + B2B |
| TikTok | Krátký popis, hashtagy (video obsah ručně) | B2C členové |
| Blog (Lovable web) | Dlouhé články v češtině, MDX formát | SEO, B2B i B2C |

Jazyk: **výhradně čeština** (v první fázi).

---

## Režimy agenta

### `/post` — Jednorázový příspěvek
1. David zadá brief (text nebo text + fotka)
2. Agent analyzuje kontext a vygeneruje copy zvlášť pro každou platformu
3. Pokud je potřeba grafika: vytvoří Canva design (šablona s Pumplo brandingem)
4. Pokud David posílá vlastní fotku: nabídne přímé použití fotky NEBO Canva kompozici s fotkou
5. Ukáže náhled všech verzí textů + odkaz na Canva design
6. Po schválení ("ok" / "pošli") publikuje přes Ayrshare na vybrané platformy

### `/blog` — Blog článek
1. David zadá téma + klíčové body
2. Agent napíše celý článek v češtině (MDX formát, frontmatter s meta)
3. Ukáže náhled článku
4. Po schválení commitne do GitHub repozitáře Lovable webu
5. Volitelně: vygeneruje zkrácenou LinkedIn a IG verzi článku

### `/campaign` — Série postů (kampaň)
1. David zadá brief kampaně (téma, délka, cíl)
2. Agent navrhne plán 5–10 postů s doporučeným časovým rozložením
3. Každý post prochází samostatným schválením před publikováním

### `/report` — Analytika a reporting
- **Na vyžádání:** „jak se daří" → agent vytáhne data z Ayrshare + Google Search Console a shrne výkon
- **Automatický týdenní report:** každý týden souhrn za všechny platformy + blog
- Report obsahuje: dosah, engagement rate, kliknutí, růst followerů per platforma, top performing post týdne, doporučení co zopakovat

### `/suggest` — Návrh témat článků
1. Agent prohledá trendy ve fitness/SaaS/gym management segmentu (web search)
2. Navrhne 5 témat s odůvodněním (objem hledání, relevance, obtížnost)
3. David vybere → agent napíše článek v `/blog` módu

---

## Workflow se vstupní fotkou

```
David: [foto] + brief textem
    ↓
Agent: analyzuje fotku (Claude multimodal), píše copy
    ↓
Grafika: přímé použití fotky  NEBO  Canva kompozice s fotkou + Pumplo branding
    ↓
Náhled → schválení → Ayrshare publikuje
```

Příklad: foto z JIC Booster eventu → LinkedIn milestone post, IG caption, FB post, TikTok description.

---

## Schvalování obsahu

**Vždy před publikováním** — žádný post nejde live bez explicitního "ok" od Davida.

Náhled obsahuje:
- Text pro každou platformu zvlášť
- Odkaz na Canva design (pokud byl vytvořen)
- Navrhované hashtagy

---

## SEO a GEO optimalizace blogu

Každý článek psaný agentem prochází automaticky dvojí optimalizací.

### SEO (Google)
- Klíčové slovo v title, H1, první odstavec, meta description
- Správná struktura nadpisů (H1 → H2 → H3)
- Interní prolinkování na jiné články blogu
- Alt texty obrázků
- Doporučená délka: 1 200–2 500 slov
- Schema markup (Article, FAQ) pro rich snippets

### GEO (AI vyhledávače — ChatGPT, Gemini, Claude, Grok)
- Jasné faktické výroky které AI může citovat
- FAQ sekce na konci každého článku
- Definice klíčových pojmů vlastními slovy
- Autoritativní tón, konkrétní čísla a data
- Strukturované informace (tabulky, odrážky) které AI snadno indexuje
- Zmínka o Pumplo jako řešení konkrétního problému v kontextu

### Keyword research workflow (`/suggest`)
1. Agent prohledá trendy (web search) ve fitness/SaaS/gym management
2. Vyhodnotí objem hledání, obtížnost, relevanci pro Pumplo
3. Navrhne 5 témat s odůvodněním — David vybere
4. Vybrané téma zpracuje jako SEO+GEO optimalizovaný článek

---

## Brand voice (marketing/CLAUDE.md)

Soubor uložený v repozitáři obsahuje:
- Tone of voice Pumplo (přímý, motivující, autentický)
- Klíčová sdělení: retence členů, personalizace, data-driven fitness
- Cílové skupiny a jak s nimi komunikovat odlišně
- Povinné hashtagy, zakázaná slova/témata
- Příklady dobrých postů jako reference
- Kontext: David jako founder, tým GynTools CZ

---

## Tech stack

| Komponenta | Nástroj | Poznámka |
|-----------|---------|----------|
| Agent runtime | Claude Code CLI | Lokálně u Davida |
| Grafika | Canva MCP | Již dostupné v Claude Code |
| Sociální sítě | Ayrshare API | Podporuje IG, TikTok, LinkedIn, FB v jednom volání |
| Analytika sociální sítě | Ayrshare Analytics API | Reach, engagement, kliknutí per platforma |
| Blog | GitHub MCP | Commit MDX do Lovable web repo |
| Blog analytika | Google Search Console API | Výkon článků v Google hledání |
| Keyword research | Web Search (vestavěný) | Trendy a klíčová slova pro `/suggest` |
| Brand kontext | `marketing/CLAUDE.md` | Načítán automaticky Claude Code |
| Fáze 2 | Telegram bridge | Stejný pattern jako existující Pumplo admin bot |

---

## Fáze 2 — Telegram

Po ověření funkčnosti přes Claude Code CLI:
- Stejné MCP servery zůstávají
- Přidá se Telegram bridge (identický vzor jako `@Pumplo_admin_bot`)
- David posílá brief + fotky přes Telegram, schvaluje přes inline buttony
- Marketing tým dostane přístup ke stejnému botu

---

## Co není v scope (fáze 1)

- Video generování přes Higgsfield (odloženo na později)
- Scheduling / automatické plánování postů do budoucnosti
- Vícejazyčný obsah
- Přístup dalších členů týmu (řeší fáze 2 přes Telegram)
