#!/usr/bin/env node
// Claude Code Notification hook → Telegram @Pumplo_admin_bot
//
// Reads the Notification hook JSON from stdin and forwards its `message`
// field to Telegram so David sees when Claude is waiting for input.
//
// Reads credentials from env vars (set in the hook command in settings.json):
//   PUMPLO_TG_BOT_TOKEN  — bot token
//   PUMPLO_TG_CHAT_ID    — David's chat id
//
// Fails silently — a broken notification hook must never block the harness.

const https = require('https')

async function main() {
  const token = process.env.PUMPLO_TG_BOT_TOKEN
  const chatId = process.env.PUMPLO_TG_CHAT_ID
  if (!token || !chatId) {
    // Missing credentials — nothing to do, don't error
    return
  }

  // Collect stdin
  let raw = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) raw += chunk
  if (!raw.trim()) return

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return
  }

  const message = String(payload.message || '').trim()
  if (!message) return

  // Telegram text (plain, no markdown — safer, no parse errors)
  const text = '🔔 Claude čeká na vstup:\n\n' + message

  const body = JSON.stringify({
    chat_id: chatId,
    text,
    disable_notification: false,
  })

  const req = https.request({
    method: 'POST',
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
    timeout: 5000,
  })

  req.on('error', () => { /* ignore, never block */ })
  req.on('timeout', () => req.destroy())
  req.write(body)
  req.end()
}

main().catch(() => { /* ignore */ })
