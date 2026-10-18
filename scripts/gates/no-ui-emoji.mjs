// Žádná emoji v UI (David 8. 10. 2026: jednotné ikony pro iOS i Android).
// Výjimky: texty push notifikací (OS je vykreslí sám, ikonu tam dát nejde) a logy pro vývojáře.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const ALLOW = new Set(['src/hooks/useTrainingNotifications.ts']);
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2705}\u{274C}\u{2728}\u{2713}\u{2717}]/u;
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : [];
});
const hits = [];
for (const file of walk(join(root, 'src'))) {
  const rel = relative(root, file);
  if (ALLOW.has(rel)) continue;
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || /console\.(log|warn|error|info|debug)/.test(line)) return;
    // Push notifikace: text vykresluje systém, ikonu tam dát nejde.
    if (t.startsWith("'notif.")) return;
    if (EMOJI.test(line)) hits.push(`${rel}:${i + 1}: ${t.slice(0, 90)}`);
  });
}
// Kontrola, že detektor emoji opravdu chytá (pozitivní kontrola).
if (!EMOJI.test('💪') || !EMOJI.test('✓')) { console.error('detector broken'); process.exit(1); }
if (hits.length) { console.error(hits.join('\n')); console.error(`${hits.length} UI emoji left`); process.exit(1); }
console.log('NO_UI_EMOJI_OK');
