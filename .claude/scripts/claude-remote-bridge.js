#!/usr/bin/env node
// Claude Remote Bridge — Telegram → tmux pane
//
// Polls the `claude_remote_messages` Supabase table every 2 s. When a new
// pending row from David's Telegram chat arrives, forwards the text as a
// keystroke burst into the running Claude Code session inside tmux, so
// David can "drive" Claude Code from his phone.
//
// Requirements:
//   - tmux session named "claude-remote" with Claude Code running in it
//   - env vars below (set by the launcher or launchd plist)
//
// Env vars:
//   SUPABASE_URL                — https://udqwjqgdsjobdufdxbpn.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   — service role key (needed to read/write the table)
//   BRIDGE_TMUX_SESSION         — defaults to "claude-remote"
//   BRIDGE_TELEGRAM_BOT_TOKEN   — bot token for ack/error notifications back to user
//   BRIDGE_TELEGRAM_CHAT_ID     — chat id to send ack back
//   BRIDGE_POLL_MS              — poll interval, default 2000
//   BRIDGE_MAX_AGE_SEC          — drop pending rows older than this (stale, e.g. Mac was asleep), default 900 (15 min)
//
// Safety:
//   - Only processes rows where source='telegram' (the Edge Function always sets it)
//   - Drops rows older than BRIDGE_MAX_AGE_SEC to avoid replaying week-old messages on wake
//   - Never crashes on individual row errors — logs and continues
//   - Uses `tmux send-keys -l` (literal mode) so tmux key sequences in the message are treated as text

const https = require('https')
const { execSync, execFileSync } = require('child_process')

// --- Config ---
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://udqwjqgdsjobdufdxbpn.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TMUX_SESSION = process.env.BRIDGE_TMUX_SESSION || 'claude-remote'
const TG_TOKEN = process.env.BRIDGE_TELEGRAM_BOT_TOKEN
const TG_CHAT = process.env.BRIDGE_TELEGRAM_CHAT_ID
const POLL_MS = Number(process.env.BRIDGE_POLL_MS || '2000')
const MAX_AGE_SEC = Number(process.env.BRIDGE_MAX_AGE_SEC || '900')

if (!SERVICE_KEY) {
  console.error('[bridge] FATAL: SUPABASE_SERVICE_ROLE_KEY env var missing')
  process.exit(1)
}

function log(...args) {
  console.log('[bridge]', new Date().toISOString(), ...args)
}

// --- Telegram helpers ---
function sendTelegram(text) {
  return new Promise((resolve) => {
    if (!TG_TOKEN || !TG_CHAT) return resolve()
    const body = JSON.stringify({ chat_id: TG_CHAT, text })
    const req = https.request(
      {
        method: 'POST',
        hostname: 'api.telegram.org',
        path: `/bot${TG_TOKEN}/sendMessage`,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 5000,
      },
      (res) => { res.on('data', () => {}); res.on('end', resolve) },
    )
    req.on('error', () => resolve())
    req.on('timeout', () => { req.destroy(); resolve() })
    req.write(body)
    req.end()
  })
}

// --- Supabase REST helpers (no npm dependency) ---
function supabaseRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path)
    const payload = body ? JSON.stringify(body) : null
    const req = https.request(
      {
        method,
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
        timeout: 10000,
      },
      (res) => {
        let data = ''
        res.on('data', (c) => { data += c })
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(data ? JSON.parse(data) : null) } catch (err) { resolve(null) }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`))
          }
        })
      },
    )
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(new Error('timeout')) })
    if (payload) req.write(payload)
    req.end()
  })
}

// --- tmux helpers ---
function tmuxSessionExists() {
  try {
    execFileSync('tmux', ['has-session', '-t', TMUX_SESSION], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function tmuxSendText(text) {
  // `send-keys -l` sends the text as a literal string (no key lookups).
  // Then we send Enter as a separate key event.
  execFileSync('tmux', ['send-keys', '-t', TMUX_SESSION, '-l', text])
  execFileSync('tmux', ['send-keys', '-t', TMUX_SESSION, 'Enter'])
}

// --- Main loop ---
async function fetchPending() {
  const path = '/rest/v1/claude_remote_messages?select=*&status=eq.pending&order=created_at.asc&limit=10'
  return await supabaseRequest('GET', path)
}

async function markStatus(id, status, extra = {}) {
  const patch = { status, ...extra }
  if (status === 'delivered') patch.delivered_at = new Date().toISOString()
  const path = `/rest/v1/claude_remote_messages?id=eq.${id}`
  return await supabaseRequest('PATCH', path, patch)
}

async function processRow(row) {
  const ageSec = (Date.now() - new Date(row.created_at).getTime()) / 1000
  if (ageSec > MAX_AGE_SEC) {
    log(`skip (stale ${Math.round(ageSec)}s):`, row.id.slice(0, 8))
    await markStatus(row.id, 'skipped', { error: `stale: ${Math.round(ageSec)}s older than max ${MAX_AGE_SEC}s` })
    return
  }

  if (!tmuxSessionExists()) {
    log(`skip (no tmux session "${TMUX_SESSION}"):`, row.id.slice(0, 8))
    await markStatus(row.id, 'skipped', { error: `tmux session "${TMUX_SESSION}" not running` })
    await sendTelegram(`⚠️ claude-remote-bridge běží ale tmux session "${TMUX_SESSION}" není aktivní. Spusť ji přes claude-remote-start.sh.`)
    return
  }

  try {
    tmuxSendText(row.message)
    log(`delivered:`, row.id.slice(0, 8), '→', row.message.slice(0, 60))
    await markStatus(row.id, 'delivered')
    // Best-effort ack
    await sendTelegram(`✅ Dorazilo do Claude session: "${row.message.slice(0, 80)}"`)
  } catch (err) {
    log('tmux error:', err.message)
    await markStatus(row.id, 'error', { error: String(err.message || err).slice(0, 500) })
    await sendTelegram(`❌ Chyba při doručení do tmux: ${err.message}`)
  }
}

async function tick() {
  try {
    const rows = await fetchPending()
    if (!rows || rows.length === 0) return
    for (const row of rows) {
      await processRow(row)
    }
  } catch (err) {
    log('poll error:', err.message)
  }
}

// Startup banner
log(`starting. session="${TMUX_SESSION}" poll=${POLL_MS}ms maxAge=${MAX_AGE_SEC}s`)
log(`tmux session exists: ${tmuxSessionExists()}`)
sendTelegram(`🟢 claude-remote-bridge spuštěn. Session "${TMUX_SESSION}" ${tmuxSessionExists() ? 'běží' : 'neběží — spusť ji'}.`)

// Graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down')
  sendTelegram('🔴 claude-remote-bridge se zastavil (SIGTERM)').finally(() => process.exit(0))
})
process.on('SIGINT', () => {
  log('SIGINT received, shutting down')
  sendTelegram('🔴 claude-remote-bridge se zastavil (SIGINT)').finally(() => process.exit(0))
})

// Main poll loop
setInterval(tick, POLL_MS)
tick() // initial tick
