#!/usr/bin/env node
// PermissionRequest hook → Telegram with inline buttons → poll for decision.
//
// When Claude Code is about to prompt user for tool permission, this hook
// fires first with the full tool_name + tool_input. It sends a Telegram
// message with "Povolit" / "Zamítnout" inline buttons, writes a pending
// row to claude_permission_requests, then polls that row for up to 60s
// waiting for David's tap. Returns allow/deny/ask via hookSpecificOutput.
//
// Env vars (set in settings.json hook command):
//   PUMPLO_TG_BOT_TOKEN        — bot token
//   PUMPLO_TG_CHAT_ID          — David's chat id
//   PUMPLO_SUPABASE_URL        — project URL
//   PUMPLO_SUPABASE_SERVICE_KEY — service role key (reads/writes permission requests)
//   PUMPLO_GATE_TIMEOUT_SEC    — poll timeout, default 60

const https = require('https')

const BOT_TOKEN = process.env.PUMPLO_TG_BOT_TOKEN
const CHAT_ID = process.env.PUMPLO_TG_CHAT_ID
const SUPABASE_URL = process.env.PUMPLO_SUPABASE_URL || 'https://udqwjqgdsjobdufdxbpn.supabase.co'
const SERVICE_KEY = process.env.PUMPLO_SUPABASE_SERVICE_KEY
const TIMEOUT_SEC = Number(process.env.PUMPLO_GATE_TIMEOUT_SEC || '60')
const POLL_MS = 1000

// Safety: if credentials missing, fall through to normal ask (so Claude still works)
function fallthrough(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      permissionDecision: 'ask',
      permissionDecisionReason: reason,
    },
  }))
  process.exit(0)
}

function sendJson(options, body) {
  return new Promise((resolve, reject) => {
    const hasBody = body !== undefined && body !== null
    const payload = hasBody ? (typeof body === 'string' ? body : JSON.stringify(body)) : null
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    }
    if (hasBody) headers['Content-Length'] = Buffer.byteLength(payload)
    const req = https.request(
      { ...options, headers, timeout: 8000 },
      (res) => {
        let data = ''
        res.on('data', (c) => { data += c })
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null })
          } catch {
            resolve({ status: res.statusCode, body: data })
          }
        })
      },
    )
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('timeout')))
    if (hasBody) req.write(payload)
    req.end()
  })
}

function supabaseReq(method, path, body) {
  const url = new URL(SUPABASE_URL + path)
  return sendJson(
    {
      method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=representation',
      },
    },
    body,
  )
}

function telegramReq(method, body) {
  return sendJson(
    {
      method: 'POST',
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
    },
    body,
  )
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// --- Rendering the message text ---
function formatInputPreview(toolName, toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return ''
  // Per-tool smart rendering
  if (toolName === 'Bash') {
    const cmd = String(toolInput.command || '').slice(0, 1500)
    const desc = toolInput.description ? `\n_Popis:_ ${toolInput.description}` : ''
    return `\`\`\`bash\n${cmd}\n\`\`\`${desc}`
  }
  if (toolName === 'Write' || toolName === 'Edit') {
    const path = toolInput.file_path || '(?)'
    const contentPreview = toolInput.content
      ? `\n_Content (first 200 chars):_ ${String(toolInput.content).slice(0, 200)}...`
      : ''
    const oldNew = toolInput.old_string
      ? `\n_Old:_ ${String(toolInput.old_string).slice(0, 120)}...\n_New:_ ${String(toolInput.new_string || '').slice(0, 120)}...`
      : ''
    return `📄 \`${path}\`${contentPreview}${oldNew}`
  }
  // Fallback: JSON stringify truncated
  const json = JSON.stringify(toolInput, null, 2).slice(0, 1500)
  return `\`\`\`json\n${json}\n\`\`\``
}

// --- Main ---
async function main() {
  if (!BOT_TOKEN || !CHAT_ID || !SERVICE_KEY) {
    return fallthrough('telegram-permission-gate: missing env vars')
  }

  // Read hook input
  let raw = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) raw += chunk
  if (!raw.trim()) return fallthrough('empty stdin')

  let hookInput
  try {
    hookInput = JSON.parse(raw)
  } catch (err) {
    return fallthrough('invalid stdin JSON')
  }

  const toolName = hookInput.tool_name || 'unknown'
  const toolInput = hookInput.tool_input || {}
  const sessionId = hookInput.session_id || ''

  // Step 1: insert pending request
  const { status: insertStatus, body: inserted } = await supabaseReq(
    'POST',
    '/rest/v1/claude_permission_requests',
    {
      tool_name: toolName,
      tool_input: toolInput,
      session_id: sessionId,
      status: 'pending',
    },
  )
  if (insertStatus >= 300 || !Array.isArray(inserted) || inserted.length === 0) {
    return fallthrough(`db insert failed: ${insertStatus}`)
  }
  const requestId = inserted[0].id

  // Step 2: send Telegram with inline keyboard
  const preview = formatInputPreview(toolName, toolInput)
  const text = `🔒 *Claude čeká na schválení*\n\n*Tool:* \`${toolName}\`\n\n${preview}\n\n_ID: ${requestId.slice(0, 8)}_`
  const tgRes = await telegramReq('sendMessage', {
    chat_id: CHAT_ID,
    text,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Povolit', callback_data: `allow:${requestId}` },
        { text: '❌ Zamítnout', callback_data: `deny:${requestId}` },
      ]],
    },
  })

  const tgMessageId = tgRes.body?.result?.message_id
  if (tgMessageId) {
    // Store message_id so we know which message to edit on callback
    await supabaseReq(
      'PATCH',
      `/rest/v1/claude_permission_requests?id=eq.${requestId}`,
      { telegram_message_id: tgMessageId },
    )
  }

  // Step 3: poll DB for resolution
  const deadline = Date.now() + TIMEOUT_SEC * 1000
  while (Date.now() < deadline) {
    await sleep(POLL_MS)
    const { body: rows } = await supabaseReq(
      'GET',
      `/rest/v1/claude_permission_requests?id=eq.${requestId}&select=status`,
    )
    const status = Array.isArray(rows) && rows.length > 0 ? rows[0].status : null
    if (status === 'allow' || status === 'deny') {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
          permissionDecision: status,
          permissionDecisionReason: `Resolved via Telegram (${status})`,
        },
      }))
      process.exit(0)
    }
  }

  // Timeout — mark expired and fall through to normal terminal prompt
  await supabaseReq(
    'PATCH',
    `/rest/v1/claude_permission_requests?id=eq.${requestId}&status=eq.pending`,
    { status: 'timeout', resolved_at: new Date().toISOString(), resolved_via: 'timeout' },
  )
  return fallthrough(`Telegram gate timeout after ${TIMEOUT_SEC}s — falling back to terminal prompt`)
}

main().catch((err) => fallthrough('hook error: ' + err.message))
