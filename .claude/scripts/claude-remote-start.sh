#!/usr/bin/env bash
# Claude Remote — one-shot launcher
#
# Starts:
#   1. tmux session "claude-remote" with Claude Code running in it
#   2. claude-remote-bridge daemon in the background (polls Telegram → tmux)
#
# Usage:
#   ./claude-remote-start.sh              # start everything
#   ./claude-remote-start.sh --attach     # start and attach to tmux
#   ./claude-remote-start.sh --status     # show what's running
#   ./claude-remote-start.sh --stop       # stop tmux + daemon
#
# Env vars read (set from ~/.claude-remote.env if present — gitignored):
#   SUPABASE_SERVICE_ROLE_KEY  — required
#   BRIDGE_TELEGRAM_BOT_TOKEN  — for ack messages back
#   BRIDGE_TELEGRAM_CHAT_ID    — David's chat id
#   BRIDGE_WORKDIR             — defaults to this repo root

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SESSION="claude-remote"
LOG_DIR="$HOME/.claude-remote"
LOG_FILE="$LOG_DIR/bridge.log"
PID_FILE="$LOG_DIR/bridge.pid"
ENV_FILE="$HOME/.claude-remote.env"

mkdir -p "$LOG_DIR"

# Load env file if it exists (gitignored, contains secrets)
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

WORKDIR="${BRIDGE_WORKDIR:-$REPO_ROOT}"

status() {
  echo "=== claude-remote status ==="
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "tmux session '$SESSION': running"
    tmux list-panes -t "$SESSION" -F '  pane #{pane_index}: #{pane_current_command}'
  else
    echo "tmux session '$SESSION': not running"
  fi
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "bridge daemon: running (pid $(cat "$PID_FILE"))"
  else
    echo "bridge daemon: not running"
  fi
  echo ""
  echo "logs: $LOG_FILE"
}

stop() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "stopping bridge daemon (pid $(cat "$PID_FILE"))..."
    kill -TERM "$(cat "$PID_FILE")" || true
    rm -f "$PID_FILE"
  fi
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "killing tmux session '$SESSION'..."
    tmux kill-session -t "$SESSION" || true
  fi
  echo "stopped."
}

start() {
  if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    echo "ERROR: SUPABASE_SERVICE_ROLE_KEY not set."
    echo "Create $ENV_FILE with:"
    echo "  SUPABASE_SERVICE_ROLE_KEY=..."
    echo "  BRIDGE_TELEGRAM_BOT_TOKEN=..."
    echo "  BRIDGE_TELEGRAM_CHAT_ID=..."
    exit 1
  fi

  # Start tmux session if not already running
  if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "creating tmux session '$SESSION' in $WORKDIR..."
    tmux new-session -d -s "$SESSION" -c "$WORKDIR" -x 200 -y 50
    # Start claude in the pane
    tmux send-keys -t "$SESSION" "cd $WORKDIR && claude" Enter
    sleep 0.5
  else
    echo "tmux session '$SESSION' already running"
  fi

  # Start bridge daemon if not already running
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "bridge daemon already running (pid $(cat "$PID_FILE"))"
  else
    echo "starting bridge daemon..."
    SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}" \
    BRIDGE_TELEGRAM_BOT_TOKEN="${BRIDGE_TELEGRAM_BOT_TOKEN:-}" \
    BRIDGE_TELEGRAM_CHAT_ID="${BRIDGE_TELEGRAM_CHAT_ID:-}" \
    BRIDGE_TMUX_SESSION="$SESSION" \
    nohup node "$SCRIPT_DIR/claude-remote-bridge.js" >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 0.3
    echo "started (pid $(cat "$PID_FILE"))"
  fi

  echo ""
  status
  echo ""
  echo "tip: 'tmux attach -t $SESSION' to see Claude's output"
  echo "tip: '$0 --stop' to stop everything"
}

case "${1:-start}" in
  --attach|attach)
    start
    tmux attach -t "$SESSION"
    ;;
  --status|status)
    status
    ;;
  --stop|stop)
    stop
    ;;
  --start|start|"")
    start
    ;;
  *)
    echo "Usage: $0 [start|--attach|--status|--stop]"
    exit 1
    ;;
esac
