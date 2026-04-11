#!/usr/bin/env bash
# Wrapper: sources ~/.claude-remote.env (credentials) and invokes the
# telegram-permission-gate Node hook. Keeps SUPABASE_SERVICE_ROLE_KEY out
# of settings.json (which is committed).
#
# Called by Claude Code PermissionRequest hook, reads hook JSON on stdin,
# writes hookSpecificOutput JSON on stdout.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$HOME/.claude-remote.env"

# Source env file if it exists. If not, the Node script will fall through
# to "ask" so Claude Code still works via the normal terminal prompt.
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

# Map env names used by the bridge to the names the hook expects
export PUMPLO_TG_BOT_TOKEN="${BRIDGE_TELEGRAM_BOT_TOKEN:-}"
export PUMPLO_TG_CHAT_ID="${BRIDGE_TELEGRAM_CHAT_ID:-}"
export PUMPLO_SUPABASE_URL="${SUPABASE_URL:-https://udqwjqgdsjobdufdxbpn.supabase.co}"
export PUMPLO_SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
export PUMPLO_GATE_TIMEOUT_SEC="${PUMPLO_GATE_TIMEOUT_SEC:-60}"

exec node "$SCRIPT_DIR/telegram-permission-gate.js"
