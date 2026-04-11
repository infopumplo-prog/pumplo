# Claude Remote — Telegram ↔ tmux bridge

Ovládej Claude Code běžící na tvém Macu přímo z Telegramu @Pumplo_admin_bot. Pošli zprávu začínající `>` a daemon ji do 2 vteřin doručí jako vstup do tmux session kde běží Claude Code.

## Architektura

```
iPhone/Telegram                    Mac (lokální)
─────────────                      ──────────────────
`> ahoj Claude`                    ┌─────────────────────────────────┐
       │                           │ tmux session "claude-remote"     │
       ▼                           │ ┌─────────────────────────────┐ │
Telegram Bot API                   │ │ Claude Code běžící uvnitř    │ │
       │                           │ │ pane 0                       │ │
       ▼ (webhook)                 │ └────────────▲────────────────┘ │
telegram-bot Edge Function         │              │ tmux send-keys   │
(Supabase)                         │              │                  │
       │                           │ ┌────────────┴────────────────┐ │
       ▼ (insert)                  │ │ claude-remote-bridge.js      │ │
┌──────────────────────┐           │ │ (poll every 2s)              │ │
│ claude_remote_messages│◀──────────┤ └─────────────────────────────┘ │
│ (Supabase table)      │           └─────────────────────────────────┘
└──────────────────────┘
```

## Komponenty

| Soubor | Co dělá |
|---|---|
| `claude-remote-start.sh` | Launcher. Spustí tmux session + bridge daemon. |
| `claude-remote-bridge.js` | Node daemon. Polluje `claude_remote_messages` tabulku, posílá nové zprávy do tmux pane přes `tmux send-keys`. |
| `com.pumplo.claude-remote.plist` | LaunchAgent pro auto-start po login do Macu. |
| `~/.claude-remote.env` | Env file s credentials (SERVICE_ROLE_KEY, bot token, chat id). Gitignored, perms 600. |
| `~/.claude-remote/bridge.log` | Log daemona. |
| `pumplo/supabase/functions/telegram-bot/index.ts` | Edge Function. Handler pro prefix `>` v `handleCommand()`. |
| `pumplo DB: claude_remote_messages` | Tabulka co drží pending/delivered/skipped/error commands. |

## Rychlý start

```bash
# 1) Pustit systém (tmux + daemon)
./.claude/scripts/claude-remote-start.sh

# 2) Pripojit se k tmux session (aby sis videl Claude output)
tmux attach -t claude-remote

# 3) Pokud Claude Code jeste nebezi v tmuxu, napis v te session:
claude
```

V Telegramu pak pošli:

```
> ahoj Claude, jsem na mobilu, pomoz mi s X
```

A do 2 sekund ti Claude na Macu začne odpovídat.

## Příkazy

```bash
./.claude/scripts/claude-remote-start.sh           # start
./.claude/scripts/claude-remote-start.sh --status  # co běží
./.claude/scripts/claude-remote-start.sh --attach  # start + attach na tmux
./.claude/scripts/claude-remote-start.sh --stop    # zastavit vše
```

Ruční tmux:

```bash
tmux attach -t claude-remote        # připojit se (vypadnout: Ctrl+b, d)
tmux list-sessions                  # vidíš running sessions
tmux kill-session -t claude-remote  # zabít sesku
```

Logy:

```bash
tail -f ~/.claude-remote/bridge.log  # live log daemona
```

## Auto-start po reboot (volitelné)

```bash
cp .claude/scripts/com.pumplo.claude-remote.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pumplo.claude-remote.plist
launchctl list | grep claude-remote  # verify
```

Uvědom si: auto-start **spustí tmux session + daemon**, ale Claude Code sám v té session potřebuje interaktivní login. Po rebootu se musíš jednou připojit k tmux (`tmux attach -t claude-remote`) a napsat `claude` abys Claude v session spustil. Pak můžeš odpojit (`Ctrl+b d`) a session poběží dál na pozadí.

## SSH z mobilu (bonus)

Nejlepší doplněk k tomuto bridge — nainstaluj si na iPhone **[Termius](https://termius.com)** nebo **[Blink Shell](https://blink.sh)**.

Na Macu:
- System Settings → General → Sharing → Remote Login **ON**
- Pozor, jen v tvojí domácí síti, nebo použij Tailscale

Pak z Termius:
```bash
ssh davidnovotny@<lokalni-ip>
tmux attach -t claude-remote
```

Máš Claude Code plnohodnotně v mobilu. Včetně vidění výstupu, scrollingu, úprav atd.

## Bezpečnost

- Tabulka `claude_remote_messages` má RLS enabled (nikdo bez service_role key nic nevloží)
- Telegram Edge Function má `ALLOWED_CHAT_ID` check — zprávy z jakéhokoliv jiného Telegram účtu se ignorují
- Bridge daemon odmítá zprávy starší než `BRIDGE_MAX_AGE_SEC` (default 15 min) — pokud byl Mac v sleep a nakupily se staré zprávy, neproběhnou znova
- Env file `~/.claude-remote.env` má perms 600 a je gitignored
- Bot token je NEVER commitnutý do repa (jen v memory a v env file)

## Rozšíření (TODO — až bude potřeba)

- [ ] **Reverse direction:** tmux pane capture → Telegram echo, aby David viděl Claudovy odpovědi rovnou na mobilu bez SSH
- [ ] **Rate limiting:** max N zpráv za minutu na prevenci accidental flood
- [ ] **Command mode:** speciální prefixy jako `> STOP` (pause bridge), `> STATUS` (heartbeat), `> CLEAR` (Ctrl+C do tmux pane)
- [ ] **Realtime místo poll:** Supabase realtime subscription místo 2s pollu
- [ ] **Multiple panes:** support pro několik souběžných tmux sessions (dev, debugging, atd.)

## Troubleshooting

**Zpráva zůstává v `pending` navždy:**
- Daemon neběží → `./.claude/scripts/claude-remote-start.sh --status`
- Podívej se do `~/.claude-remote/bridge.log`

**Dostávám "skipped: tmux session 'claude-remote' not running":**
- Launcher neběží nebo byl zastaven. Spusť `./.claude/scripts/claude-remote-start.sh`

**Claude Code v tmuxu nereaguje na zprávy:**
- Zpráva dorazila jako keystrokes, ale Claude Code může být uprostřed jiné operace (čeká na permission prompt, běží tool call). Připoj se na tmux (`tmux attach -t claude-remote`) a ověř stav.

**Chci ukončit bridge:**
```bash
./.claude/scripts/claude-remote-start.sh --stop
launchctl unload ~/Library/LaunchAgents/com.pumplo.claude-remote.plist  # pokud máš auto-start
```
