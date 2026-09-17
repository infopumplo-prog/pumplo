// Pošle výsledek CI běhu do Telegramu na stejného bota, který posílá ranní report.
// Tokeny jen z env (GitHub secrets); bez nich tiše skončí, ať CI nespadne kvůli notifikaci.
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
if (!token || !chatId) { console.log('telegram: chybí token/chat id, přeskakuji'); process.exit(0); }
const ok = (process.env.STATUS || '').toLowerCase() === 'success';
const title = (process.env.TITLE || '').split('\n')[0].slice(0, 120);
const text = [
  `${ok ? '✅' : '❌'} Pumplo CI ${ok ? 'prošlo' : 'SPADLO'} — ${process.env.REF || ''}`,
  title ? `„${title}“` : '',
  ok ? 'tsc · testy · parita verzí · build' : `Detail: ${process.env.URL || ''}`,
].filter(Boolean).join('\n');
const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
});
console.log('telegram:', res.status);
