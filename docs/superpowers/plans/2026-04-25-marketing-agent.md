# Marketing Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vybudovat Claude Code marketing agenta s MCP servery pro publikování na IG/TikTok/LinkedIn/FB, psaní SEO+GEO blog článků a analytiku — ovládaný přirozeným jazykem.

**Architecture:** Claude Code CLI čte `marketing/CLAUDE.md` jako brand kontext, pro grafiku volá Canva MCP, pro sociální sítě volá Ayrshare přes Python wrapper script, pro blog commity používá GitHub MCP a pro analytiku Google Search Console přes Python wrapper.

**Tech Stack:** Python 3, Ayrshare REST API, Google Search Console API (google-auth + requests), Canva MCP (built-in), GitHub MCP (built-in), Claude Code CLI

---

## Prerekvizity (získej před spuštěním)

Před implementací David dodá:
1. **Ayrshare API key** — z ayrshare.com po vytvoření účtu a propojení IG/TikTok/LinkedIn/FB
2. **Lovable web GitHub repo URL** — URL repozitáře kam commitovat blog posty (oddělený repo od pumplo)
3. **GitHub Personal Access Token** — s `repo` scope pro GitHub MCP (github.com → Settings → Developer Settings → PAT)
4. **Google Search Console** — service account JSON soubor (Google Cloud Console → IAM → Service Accounts → vytvořit → stáhnout JSON → přidat jako uživatele v GSC)
5. **Canva API token** — z claude.ai integrace (Canva MCP je dostupné, jen potřebuje autorizaci)

---

## Soubory

```
marketing/
  CLAUDE.md                    ← brand voice, tone, kontext, instrukce agenta
  scripts/
    ayrshare.py                ← Ayrshare API wrapper (post, analytics)
    search_console.py          ← Google Search Console API wrapper (analytika blogu)
    requirements.txt           ← google-auth, requests
  templates/
    blog-post.mdx              ← MDX šablona pro blog články (frontmatter, struktura)
    seo-checklist.md           ← interní checklist pro agenta při psaní článků

.claude/
  settings.json                ← MCP konfigurace (GitHub MCP, Canva MCP)

docs/superpowers/specs/
  2026-04-25-marketing-agent-design.md   ← design spec (již existuje)
```

---

## Task 1: Marketing adresář a brand voice CLAUDE.md

**Files:**
- Create: `marketing/CLAUDE.md`
- Create: `marketing/templates/blog-post.mdx`
- Create: `marketing/templates/seo-checklist.md`

- [ ] **Step 1: Vytvoř marketing adresář a CLAUDE.md**

```bash
mkdir -p marketing/scripts marketing/templates
```

Vytvoř `marketing/CLAUDE.md` s tímto obsahem (David doplní/upraví):

```markdown
# Pumplo Marketing Agent — Brand Context

## O Pumplo
Pumplo je SaaS retention platforma pro nezávislé fitness posilovny (GynTools CZ s.r.o.).
Řeší vysoký churn členů (30–50 % nových členů odchází do 6 měsíců).
Klíčové funkce: personalizované tréninkové plány, gamifikace, datová analytika.
První zákazník: Eurogym Olomouc (platící pilot).
Founder: David Novotný — přímý, autentický, buduje startup od nuly.

## Tone of Voice
- Přímý a autentický — žádné korporátní fráze
- Motivující, ale ne přehnaně nadšený
- Odborný, ale srozumitelný (ne technický žargon)
- Česky, neformálně (tykáme), ale profesionálně

## Cílové skupiny
### B2B — Majitelé posiloven
- Bolest: přichází o členy, bojují s řetězcovými posilovnami
- Co jim říkáme: data-driven retence, konkrétní čísla (30-50% churn), ROI
- Tón: seriózní, byznysový, partner který rozumí jejich problémům

### B2C — Členové posiloven
- Bolest: nevědí jak trénovat efektivně, ztrácí motivaci
- Co jim říkáme: personalizace, pokrok, komunita
- Tón: motivující, přátelský, přístupný

## Klíčová sdělení
- "Pumplo pomáhá posilovnám udržet členy déle"
- "Personalizované tréninkové plány pro každého člena"
- "Data-driven přístup k fitness retenci"
- "Od startupu k první posilovně — příběh Pumpla"

## Povinné hashtagy
### LinkedIn: #pumplo #fitness #saas #startuplife #gymmanagement #retention
### Instagram: #pumplo #fitness #gym #workout #czechstartup #gymlife
### TikTok: #pumplo #fitness #gym #startup #czechstartup
### Facebook: stejné jako Instagram

## Zakázaná témata/slova
- Srovnání s konkrétními konkurenty jménem
- Přehnaná obchodní sdělení bez hodnoty
- Anglické výrazy kde existuje český ekvivalent

## Příkazy agenta
- `/post [brief]` — vytvoř příspěvek na sociální sítě
- `/blog [téma]` — napiš blog článek
- `/campaign [brief]` — navrhni sérii postů
- `/report` — zobraz analytiku výkonu
- `/suggest` — navrhni nejlepší téma pro blog

## Schvalování
VŽDY před publikováním zobraz náhled a čekej na explicitní "ok" od Davida.
Nikdy nepublikuj bez schválení.
```

- [ ] **Step 2: Vytvoř MDX šablonu pro blog**

Vytvoř `marketing/templates/blog-post.mdx`:

```mdx
---
title: ""
description: ""
date: ""
author: "David Novotný"
tags: []
keywords: []
slug: ""
---

## Úvod

[Hook — proč je toto téma důležité, 2-3 věty]

## [Hlavní sekce 1]

[Obsah]

## [Hlavní sekce 2]

[Obsah]

## [Hlavní sekce 3]

[Obsah]

## Závěr

[Shrnutí + CTA pro Pumplo]

## Často kladené otázky

**Otázka 1?**
Odpověď 1.

**Otázka 2?**
Odpověď 2.

**Otázka 3?**
Odpověď 3.
```

- [ ] **Step 3: Vytvoř SEO/GEO checklist**

Vytvoř `marketing/templates/seo-checklist.md`:

```markdown
# SEO + GEO Checklist pro každý blog článek

## SEO (Google)
- [ ] Klíčové slovo v title (do 60 znaků)
- [ ] Klíčové slovo v meta description (do 160 znaků)
- [ ] Klíčové slovo v H1 a prvním odstavci
- [ ] Minimálně 3x H2 nadpisy s variací klíčového slova
- [ ] Délka článku: 1 200–2 500 slov
- [ ] Alt text pro všechny obrázky
- [ ] Interní odkaz na alespoň 1 jiný článek blogu (pokud existuje)
- [ ] Slug URL: krátký, obsahuje klíčové slovo, bez diakritiky

## GEO (AI vyhledávače)
- [ ] FAQ sekce na konci (min. 3 otázky a odpovědi)
- [ ] Jasné faktické výroky s čísly ("30–50 % nových členů odchází...")
- [ ] Definice klíčových pojmů vlastními slovy
- [ ] Strukturované informace: alespoň 1 tabulka nebo odrážkový seznam
- [ ] Pumplo zmíněno jako řešení konkrétního problému v kontextu
- [ ] Autoritativní tón — bez spekulací, jen fakta a zkušenosti
```

- [ ] **Step 4: Commit**

```bash
git add marketing/
git commit -m "feat(marketing): add brand context CLAUDE.md and blog templates"
git push
```

---

## Task 2: Konfigurace MCP serverů

**Files:**
- Modify: `/Users/davidnovotny/.claude/settings.json`

- [ ] **Step 1: Přidej GitHub MCP do globálního settings.json**

Otevři `/Users/davidnovotny/.claude/settings.json` a přidej GitHub MCP (David dodá `GITHUB_PERSONAL_ACCESS_TOKEN`):

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "DOPLNIT"
      }
    }
  }
}
```

- [ ] **Step 2: Ověř že Canva MCP je dostupný**

V Claude Code chatu zadej:
```
Jaké MCP nástroje máš k dispozici?
```
Očekávaný výstup: seznam tools včetně `mcp__claude_ai_Canva__*`.
Pokud Canva chybí, je třeba ji autorizovat přes claude.ai integrace.

- [ ] **Step 3: Ověř GitHub MCP**

Restartuj Claude Code a zadej:
```
Pomocí GitHub MCP vypiš repozitáře dostupné pro účet infopumplo-prog
```
Očekávaný výstup: seznam repozitářů včetně Lovable web repo.

- [ ] **Step 4: Commit settings**

```bash
git add .claude/settings.json 2>/dev/null || true
git commit -m "feat(marketing): configure GitHub MCP server"
git push
```

---

## Task 3: Ayrshare API wrapper

**Files:**
- Create: `marketing/scripts/requirements.txt`
- Create: `marketing/scripts/ayrshare.py`

- [ ] **Step 1: Vytvoř requirements.txt**

```
requests==2.32.3
python-dotenv==1.0.1
```

- [ ] **Step 2: Nainstaluj závislosti**

```bash
cd marketing/scripts && pip3 install -r requirements.txt
```

Očekávaný výstup: `Successfully installed requests-2.32.3 python-dotenv-1.0.1`

- [ ] **Step 3: Vytvoř .env soubor pro API klíče**

Vytvoř `marketing/.env` (není v gitu):

```bash
echo "marketing/.env" >> .gitignore
```

Obsah `marketing/.env` (David doplní hodnoty):
```
AYRSHARE_API_KEY=DOPLNIT
```

- [ ] **Step 4: Vytvoř ayrshare.py**

```python
#!/usr/bin/env python3
"""Ayrshare API wrapper pro Pumplo marketing agenta."""

import os
import sys
import json
import argparse
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

API_KEY = os.getenv('AYRSHARE_API_KEY')
BASE_URL = 'https://app.ayrshare.com/api'
HEADERS = {'Authorization': f'Bearer {API_KEY}', 'Content-Type': 'application/json'}

PLATFORM_MAP = {
    'instagram': 'instagram',
    'tiktok': 'tiktok',
    'linkedin': 'linkedin',
    'facebook': 'facebook',
}

def post(text: str, platforms: list[str], media_urls: list[str] = None) -> dict:
    """Publikuj příspěvek na vybrané platformy."""
    payload = {
        'post': text,
        'platforms': [PLATFORM_MAP[p] for p in platforms if p in PLATFORM_MAP],
    }
    if media_urls:
        payload['mediaUrls'] = media_urls
    r = requests.post(f'{BASE_URL}/post', headers=HEADERS, json=payload)
    r.raise_for_status()
    return r.json()

def analytics(platform: str = None, last_days: int = 7) -> dict:
    """Získej analytiku pro platformu nebo všechny platformy."""
    params = {'lastDays': last_days}
    if platform:
        params['platforms'] = [PLATFORM_MAP.get(platform, platform)]
    r = requests.get(f'{BASE_URL}/analytics/post', headers=HEADERS, params=params)
    r.raise_for_status()
    return r.json()

def analytics_social(last_days: int = 7) -> dict:
    """Získej souhrnnou analytiku followerů a reach."""
    params = {'lastDays': last_days}
    r = requests.get(f'{BASE_URL}/analytics/social', headers=HEADERS, params=params)
    r.raise_for_status()
    return r.json()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Ayrshare API wrapper')
    subparsers = parser.add_subparsers(dest='command')

    # post subcommand
    post_p = subparsers.add_parser('post', help='Publikuj příspěvek')
    post_p.add_argument('--text', required=True)
    post_p.add_argument('--platforms', nargs='+', default=['instagram', 'facebook', 'linkedin', 'tiktok'])
    post_p.add_argument('--media', nargs='*', default=[])

    # analytics subcommand
    an_p = subparsers.add_parser('analytics', help='Získej analytiku')
    an_p.add_argument('--platform', default=None)
    an_p.add_argument('--days', type=int, default=7)
    an_p.add_argument('--social', action='store_true', help='Follower/reach analytics')

    args = parser.parse_args()

    if args.command == 'post':
        result = post(args.text, args.platforms, args.media)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    elif args.command == 'analytics':
        if args.social:
            result = analytics_social(args.days)
        else:
            result = analytics(args.platform, args.days)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        parser.print_help()
```

- [ ] **Step 5: Ověř Ayrshare připojení**

```bash
cd marketing/scripts
python3 ayrshare.py analytics --social --days 7
```

Očekávaný výstup: JSON s follower daty nebo `{"status": "success", ...}`

- [ ] **Step 6: Commit**

```bash
git add marketing/scripts/requirements.txt marketing/scripts/ayrshare.py .gitignore
git commit -m "feat(marketing): add Ayrshare API wrapper for social posting and analytics"
git push
```

---

## Task 4: Google Search Console wrapper

**Files:**
- Create: `marketing/scripts/search_console.py`
- Modify: `marketing/scripts/requirements.txt`

- [ ] **Step 1: Aktualizuj requirements.txt**

```
requests==2.32.3
python-dotenv==1.0.1
google-auth==2.29.0
google-auth-httplib2==0.2.0
google-api-python-client==2.127.0
```

```bash
cd marketing/scripts && pip3 install -r requirements.txt
```

- [ ] **Step 2: Přidej cestu k service account JSON do .env**

Do `marketing/.env` přidej:
```
GSC_SERVICE_ACCOUNT_JSON=CESTA_K_JSON_SOUBORU
GSC_SITE_URL=https://pumplo.cz/
```

- [ ] **Step 3: Vytvoř search_console.py**

```python
#!/usr/bin/env python3
"""Google Search Console API wrapper pro Pumplo marketing agenta."""

import os
import json
import argparse
from datetime import datetime, timedelta
from dotenv import load_dotenv
from google.oauth2 import service_account
from googleapiclient.discovery import build

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

SERVICE_ACCOUNT_FILE = os.getenv('GSC_SERVICE_ACCOUNT_JSON')
SITE_URL = os.getenv('GSC_SITE_URL', 'https://pumplo.cz/')
SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly']

def get_service():
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES
    )
    return build('searchconsole', 'v1', credentials=creds)

def get_performance(last_days: int = 28) -> dict:
    """Získej celkový výkon webu za posledních N dní."""
    service = get_service()
    end_date = datetime.today().strftime('%Y-%m-%d')
    start_date = (datetime.today() - timedelta(days=last_days)).strftime('%Y-%m-%d')
    body = {
        'startDate': start_date,
        'endDate': end_date,
        'dimensions': ['page'],
        'rowLimit': 10,
        'orderBy': [{'fieldName': 'clicks', 'sortOrder': 'DESCENDING'}],
    }
    response = service.searchanalytics().query(siteUrl=SITE_URL, body=body).execute()
    return response

def get_top_queries(last_days: int = 28) -> dict:
    """Získej top vyhledávací dotazy."""
    service = get_service()
    end_date = datetime.today().strftime('%Y-%m-%d')
    start_date = (datetime.today() - timedelta(days=last_days)).strftime('%Y-%m-%d')
    body = {
        'startDate': start_date,
        'endDate': end_date,
        'dimensions': ['query'],
        'rowLimit': 10,
        'orderBy': [{'fieldName': 'clicks', 'sortOrder': 'DESCENDING'}],
    }
    response = service.searchanalytics().query(siteUrl=SITE_URL, body=body).execute()
    return response

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Google Search Console wrapper')
    subparsers = parser.add_subparsers(dest='command')

    perf_p = subparsers.add_parser('performance', help='Výkon stránek')
    perf_p.add_argument('--days', type=int, default=28)

    queries_p = subparsers.add_parser('queries', help='Top vyhledávací dotazy')
    queries_p.add_argument('--days', type=int, default=28)

    args = parser.parse_args()

    if args.command == 'performance':
        print(json.dumps(get_performance(args.days), ensure_ascii=False, indent=2))
    elif args.command == 'queries':
        print(json.dumps(get_top_queries(args.days), ensure_ascii=False, indent=2))
    else:
        parser.print_help()
```

- [ ] **Step 4: Ověř GSC připojení (po dodání service account JSON)**

```bash
cd marketing/scripts
python3 search_console.py performance --days 28
```

Očekávaný výstup: JSON s daty stránek nebo `{"rows": []}` pokud blog ještě nemá data.

- [ ] **Step 5: Commit**

```bash
git add marketing/scripts/search_console.py marketing/scripts/requirements.txt
git commit -m "feat(marketing): add Google Search Console wrapper for blog analytics"
git push
```

---

## Task 5: Blog šablona v Lovable web repozitáři

**Files:**
- Vytvoří se v Lovable web repo (oddělený GitHub repozitář)
- Create: `src/content/blog/.gitkeep` (nebo dle struktury Lovable webu)

- [ ] **Step 1: Prozkoumej strukturu Lovable web repozitáře**

Pomocí GitHub MCP:
```
Pomocí GitHub MCP si prohlédni strukturu repozitáře [URL Lovable web repo] — 
zaměř se na to kde jsou stránky/content soubory a jak je web strukturován.
```

- [ ] **Step 2: Identifikuj správné umístění pro blog MDX soubory**

Na základě struktury webu urči správnou cestu (typicky `src/content/blog/` nebo `public/blog/`).

- [ ] **Step 3: Vytvoř první testovací blog post přes GitHub MCP**

Pomocí GitHub MCP commitni testovací soubor `test-post.mdx` do Lovable web repo:
```
Pomocí GitHub MCP vytvoř soubor src/content/blog/test-post.mdx v repozitáři [URL]
s tímto obsahem: [MDX šablona z marketing/templates/blog-post.mdx vyplněná testem]
```

- [ ] **Step 4: Ověř že Lovable web zobrazil nový post**

Otevři Lovable web preview a zkontroluj že test post je viditelný.

- [ ] **Step 5: Smaž testovací post**

```
Pomocí GitHub MCP smaž soubor src/content/blog/test-post.mdx z repozitáře [URL]
```

- [ ] **Step 6: Commit poznámky do marketing CLAUDE.md**

Přidej do `marketing/CLAUDE.md` sekci:
```markdown
## Blog publikování
- GitHub repo webu: [URL]
- Cesta k blog postům: src/content/blog/
- Formát: MDX s frontmatter (viz marketing/templates/blog-post.mdx)
- Po schválení: commitni přes GitHub MCP do tohoto repozitáře
```

```bash
git add marketing/CLAUDE.md
git commit -m "feat(marketing): document blog publishing path in brand context"
git push
```

---

## Task 6: End-to-end test — /post workflow

- [ ] **Step 1: Test /post s textem**

V Claude Code chatu zadej:
```
/post Pumplo byl přijat do JIC Booster programu po X měsících v JIC Base.
Velký milník pro náš tým! Přidej na LinkedIn a Instagram.
```

Očekávaný výstup od agenta:
- LinkedIn verze (formálnější, founder story)
- Instagram verze (caption + hashtagy)
- Dotaz "Schvaluješ? (ok/upravit)"

- [ ] **Step 2: Schval a ověř publikování**

Zadej "ok" a ověř:
```bash
cd marketing/scripts
python3 ayrshare.py analytics --social --days 1
```
Měl by se zobrazit nový post v historii.

- [ ] **Step 3: Test /post s fotkou**

Přetáhni fotku do Claude Code chatu a zadej:
```
/post [foto] Dnes v JIC Booster. Publikuj na všechny platformy.
```
Agent by měl nabídnout přímé použití fotky nebo Canva kompozici.

---

## Task 7: End-to-end test — /blog + SEO/GEO

- [ ] **Step 1: Test /suggest**

```
/suggest
```

Očekávaný výstup:
- Výsledky průzkumu trendů (web search)
- Doporučené téma s odůvodněním (povědomí/konverze/autorita)
- 4 alternativy

- [ ] **Step 2: Test /blog**

```
/blog Jak snížit churn členů v posilovně o 30 % pomocí dat
```

Očekávaný výstup:
- Kompletní MDX článek 1 200+ slov
- SEO+GEO checklist splněn (agent ho projde interně)
- Frontmatter s title, description, keywords, slug
- FAQ sekce na konci

- [ ] **Step 3: Schval a ověř commit do Lovable web repo**

Zadej "ok" a zkontroluj GitHub MCP log — měl by existovat nový commit v Lovable web repo.

---

## Task 8: End-to-end test — /report

- [ ] **Step 1: Test on-demand reportu**

```
/report
```

Očekávaný výstup:
- Souhrn za posledních 7 dní: reach, engagement, kliknutí per platforma (Ayrshare)
- Top performing post týdne
- Blog výkon z GSC (nebo "blog teprve startuje" pokud žádná data)
- 1–2 doporučení co opakovat

- [ ] **Step 2: Nastav týdenní automatický report (volitelné pro fázi 1)**

Pokud David chce automatický týdenní report, nastav cron job:
```bash
# Přidej do crontab (crontab -e)
# Každé pondělí v 9:00 — report do souboru
0 9 * * 1 cd /Users/davidnovotny/Desktop/pumplo && /usr/bin/python3 marketing/scripts/ayrshare.py analytics --social --days 7 >> marketing/reports/weekly-$(date +\%Y\%m\%d).json 2>&1
```

---

## Credentials checklist

Před každým taskem ověř že máš:

| Task | Co potřebuješ |
|------|--------------|
| Task 1 | Nic — jen vytváříme soubory |
| Task 2 | GitHub Personal Access Token |
| Task 3 | Ayrshare API key + propojené účty IG/TikTok/LinkedIn/FB |
| Task 4 | Google Search Console service account JSON + přidán jako user v GSC |
| Task 5 | GitHub PAT + URL Lovable web repozitáře |
| Task 6–8 | Vše výše |
