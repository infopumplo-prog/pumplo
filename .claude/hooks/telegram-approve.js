#!/usr/bin/env node

// Telegram approval hook for Claude Code
// Sends tool use requests to Telegram with Approve/Deny buttons
// Waits for response and returns decision

const https = require('https');

const BOT_TOKEN = '8652608637:AAFXzwYiAJCV8fEAHzO_YvpniMb0dijH8mU';
const CHAT_ID = '1111711198';
const TIMEOUT_MS = 120000; // 2 minutes to respond
const POLL_INTERVAL_MS = 1500;

function telegramApi(method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // Read hook input from stdin
  let input = '';
  for await (const chunk of process.stdin) input += chunk;

  let hookData;
  try {
    hookData = JSON.parse(input);
  } catch(e) {
    // Can't parse input, allow by default
    process.exit(0);
  }

  const toolName = hookData.tool_name || 'Unknown';
  const toolInput = hookData.tool_input || {};

  // Build a readable description
  let description = '';
  if (toolName === 'Bash') {
    description = `\`${(toolInput.command || '').slice(0, 300)}\``;
  } else if (toolName === 'Edit') {
    description = `📝 ${toolInput.file_path || 'unknown file'}`;
  } else if (toolName === 'Write') {
    description = `📄 ${toolInput.file_path || 'unknown file'}`;
  } else if (toolName === 'Agent') {
    description = `🤖 ${toolInput.description || 'subagent'}`;
  } else {
    description = JSON.stringify(toolInput).slice(0, 300);
  }

  // Unique callback data
  const reqId = Date.now().toString(36);

  // Send message with inline keyboard
  const msg = await telegramApi('sendMessage', {
    chat_id: CHAT_ID,
    text: `🔐 *Permission Request*\n\n*Tool:* ${toolName}\n*Detail:* ${description}`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Approve', callback_data: `approve_${reqId}` },
        { text: '❌ Deny', callback_data: `deny_${reqId}` }
      ]]
    }
  });

  if (!msg.ok) {
    // Telegram failed, allow by default to not block workflow
    process.exit(0);
  }

  const messageId = msg.result.message_id;

  // Clear any old updates first
  await telegramApi('getUpdates', { offset: -1, limit: 1 });
  const initUpdates = await telegramApi('getUpdates', { offset: -1, limit: 1 });
  let updateOffset = initUpdates.result?.length > 0
    ? initUpdates.result[initUpdates.result.length - 1].update_id + 1
    : 0;

  // Poll for callback query
  const startTime = Date.now();
  while (Date.now() - startTime < TIMEOUT_MS) {
    const updates = await telegramApi('getUpdates', {
      offset: updateOffset,
      timeout: 2,
      allowed_updates: ['callback_query']
    });

    if (updates.result) {
      for (const update of updates.result) {
        updateOffset = update.update_id + 1;
        const cb = update.callback_query;
        if (cb && cb.message?.message_id === messageId) {
          // Answer the callback to remove loading state
          await telegramApi('answerCallbackQuery', { callback_query_id: cb.id });

          if (cb.data === `approve_${reqId}`) {
            // Update message to show approved
            await telegramApi('editMessageText', {
              chat_id: CHAT_ID,
              message_id: messageId,
              text: `✅ *Approved*\n\n*Tool:* ${toolName}\n*Detail:* ${description}`,
              parse_mode: 'Markdown'
            });
            process.exit(0); // Allow
          } else {
            // Update message to show denied
            await telegramApi('editMessageText', {
              chat_id: CHAT_ID,
              message_id: messageId,
              text: `❌ *Denied*\n\n*Tool:* ${toolName}\n*Detail:* ${description}`,
              parse_mode: 'Markdown'
            });
            // Output block decision
            console.log(JSON.stringify({ decision: 'block', reason: 'Denied via Telegram' }));
            process.exit(2);
          }
        }
      }
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  // Timeout — update message and allow by default
  await telegramApi('editMessageText', {
    chat_id: CHAT_ID,
    message_id: messageId,
    text: `⏰ *Timeout — auto-approved*\n\n*Tool:* ${toolName}\n*Detail:* ${description}`,
    parse_mode: 'Markdown'
  });
  process.exit(0);
}

main().catch(() => process.exit(0));
