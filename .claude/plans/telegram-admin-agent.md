# Pumplo Admin Agent (Telegram Bot)

> Status: PLÁNOVÁNO
> Poslední update: 2026-04-04
> Autor: David Novotný + Claude

## Přehled

Telegram bot @Pumplo_admin_bot pro denní briefing a interaktivní správu Pumplo appky.

---

## Bot konfigurace

- **Username**: @Pumplo_admin_bot
- **Bot ID**: 8652608637
- **Chat ID (David)**: 1111711198
- **Token**: uložen v memory (reference)

---

## Funkce bota

### 1. Denní briefing (automatický, každé ráno)

Každý den v daný čas bot pošle report obsahující:

#### Noví uživatelé (24h)
- Počet nových registrací
- Z jaké posilovny
- Jaký cíl si zvolili

#### Aktivita
- Celkový počet sessions včera
- Aktivní uživatelé (7 dní)
- Slowing uživatelé (8-14 dní bez tréninku)
- Inactive uživatelé (15+ dní)
- Průměrná délka tréninku

#### Feedback
- Nový feedback za posledních 24h
- Automatická kategorizace (bug, feature, UX, training)
- Přidání do aktuálního "balíčku" pro update

#### Subscriptions (po implementaci SaaS tierů)
- Nové subscriptions
- Expirující subscriptions
- MRR (Monthly Recurring Revenue)
- Churn rate

### 2. Feedback batching

Bot automaticky třídí feedback do kategorií:
- **Bugy** — kritické, nekritické
- **Feature requesty** — s prioritou podle počtu žádostí
- **UX problémy** — confusion, navigace
- **Training** — cviky, plány, algoritmus

Feedback se skladuje do "balíčků". Na příkaz `připrav update` bot:
1. Vezme top prioritní balíček
2. Navrhne implementační plán
3. Odhadne náročnost

### 3. Interaktivní příkazy

| Příkaz | Co udělá |
|--------|----------|
| `status` | Celkový přehled — uživatelé, posilovny, sessions |
| `členové Eurogym` | Počet a status členů Eurogymu |
| `feedback` | Zobrazí nový nepřečtený feedback |
| `feedback balíček` | Shrnutí aktuálního feedback balíčku |
| `připrav update` | Navrhne implementaci top feedbacku |
| `zpráva Eurogym: text` | Pošle hromadnou zprávu členům posilovny |
| `statistiky` | Detailní statistiky za týden |
| `mrr` | Monthly Recurring Revenue (po SaaS implementaci) |
| `uživatel [jméno]` | Detail o konkrétním uživateli |
| `help` | Seznam dostupných příkazů |

### 4. Upozornění (real-time)

Bot posílá okamžitá upozornění při:
- Nový feedback typu "bug"
- Uživatel se registruje (volitelné)
- Subscription problém (payment_failed)
- Vysoký churn alert (5+ inactive za den)

---

## Architektura

```
┌─────────────┐     ┌──────────────────┐     ┌──────────┐
│  Telegram    │────▶│  Supabase Edge   │────▶│ Supabase │
│  (David)     │◀────│  Function        │◀────│ Database │
│              │     │  (webhook)       │     │          │
└─────────────┘     └──────────────────┘     └──────────┘
                            ▲
                            │
                    ┌───────┴────────┐
                    │  pg_cron       │
                    │  (daily job)   │
                    └────────────────┘
```

### Komponenty

#### 1. Supabase Edge Function: `telegram-webhook`
- Přijímá zprávy od Telegramu (webhook)
- Parsuje příkazy
- Dotazuje se do DB
- Formátuje odpověď
- Posílá zpět přes Telegram API

#### 2. Supabase Edge Function: `daily-briefing`
- Spouštěno přes pg_cron nebo scheduled trigger
- Sbírá data za posledních 24h
- Formátuje report
- Posílá na Telegram

#### 3. Database trigger: `notify-on-feedback`
- Trigger na INSERT do `user_feedback`
- Volá Edge Function pro okamžité upozornění

### Alternativa: n8n workflow
Pokud se Edge Functions ukáží jako omezující, workflow přes n8n:
- n8n přijímá Telegram webhook
- Zpracovává příkazy
- Dotazuje Supabase REST API
- Odpovídá zpět na Telegram

---

## Denní briefing — formát zprávy

```
📊 PUMPLO DAILY REPORT — 4.4.2026

👤 UŽIVATELÉ
• Noví: 3 (Eurogym: 2, FitZone: 1)
• Celkem: 247
• Aktivní (7d): 189 (76%)
• Slowing: 31 (13%)
• Inactive: 27 (11%)

🏋️ AKTIVITA
• Sessions včera: 47
• Ø délka: 52 min
• Top posilovna: Eurogym (32 sessions)

💬 FEEDBACK (nový: 2)
• 🐛 Bug: "Cvičení se nenačítá po swipe" — přidáno do balíčku
• 💡 Feature: "Chtěl bych sdílet trénink s kamarádem"

📦 FEEDBACK BALÍČEK: 8 položek (3 bugy, 4 features, 1 UX)

💰 SUBSCRIPTIONS (po implementaci)
• MRR: XX CZK
• Nové: X | Cancelled: X
```

---

## Implementační fáze

| Fáze | Co | Odhad |
|------|-----|-------|
| 1. Základní bot | Webhook Edge Function, příjem zpráv, základní příkazy (status, help) | 1 den |
| 2. Denní briefing | Data queries, formátování, pg_cron scheduling | 1-2 dny |
| 3. Feedback batching | Kategorizace, skladování, balíčky | 1 den |
| 4. Interaktivní příkazy | Všechny příkazy z tabulky výše | 2-3 dny |
| 5. Real-time upozornění | DB triggery, okamžité notifikace | 1 den |
| 6. Polish | Error handling, rate limiting, security | 1 den |

**Celkem: ~7-9 dní**

---

## Bezpečnost

- Bot odpovídá POUZE na chat ID 1111711198 (David)
- Token uložen jako Supabase Edge Function secret
- Webhook URL obsahuje secret path segment
- Rate limiting na příkazy
