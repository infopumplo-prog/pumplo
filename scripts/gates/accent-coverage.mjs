// Barva appky musí platit v celé appce člena (David 8. 10.): žádná natvrdo Pumplo modrá.
// Mimo appku člena (veřejné stránky stanic, admin, business, QR, leták, web gate) zůstává značka.
// Tailwind modré třídy jen tam, kde barva nese význam (drop série, typ slotu, barevné sekce Nastavení).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const OUTSIDE_MEMBER_APP = [/^src\/components\/station\//, /^src\/pages\/admin\//, /^src\/pages\/business\//, /^src\/components\/business\//,
  /^src\/pages\/StationPage\.tsx$/, /^src\/pages\/FlyerLanding\.tsx$/, /^src\/components\/WebGate\.tsx$/, /^src\/lib\/qrGenerator\.ts$/, /^src\/assets\//];
const SEMANTIC_BLUE = new Set(['src/lib/setTypes.ts', 'src/components/workout/WorkoutPreview.tsx', 'src/components/workout/CompactWorkoutView.tsx',
  'src/pages/Settings.tsx', 'src/pages/TrainerProfile.tsx', 'src/components/workout/RestTimer.tsx']);
const HARD_BLUE = /#4CC9FF|rgba?\(\s*76,\s*201,\s*255|hsl\((195|205) /i;
const TW_BLUE = /\b(text|bg|border|ring|from|to|via|fill|stroke|shadow)-(sky|cyan|blue)-\d{2,3}/;

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(f) ? [p] : []; });
const hits = [];
for (const file of walk(join(root, 'src'))) {
  const rel = relative(root, file);
  if (OUTSIDE_MEMBER_APP.some((r) => r.test(rel)) || rel === 'src/index.css') continue;
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (line.trim().startsWith('//')) return;
    if (HARD_BLUE.test(line)) hits.push(`${rel}:${i + 1} natvrdo modrá`);
    if (TW_BLUE.test(line) && !SEMANTIC_BLUE.has(rel)) hits.push(`${rel}:${i + 1} tailwind modrá`);
  });
}
// index.css: modrá smí být jen ve výchozích hodnotách :root/.dark (přepisuje je [data-accent]).
const css = readFileSync(join(root, 'src/index.css'), 'utf8');
const accentBlock = css.slice(css.indexOf('[data-accent='));
if (HARD_BLUE.test(accentBlock.replace(/\/\*[\s\S]*?\*\//g, ''))) hits.push('src/index.css: modrá v pravidlech barev appky');
if (!HARD_BLUE.test('#4CC9FF') || !TW_BLUE.test('text-sky-400')) { console.error('detector broken'); process.exit(1); }
if (hits.length) { console.error(hits.join('\n')); process.exit(1); }
console.log('ACCENT_COVERAGE_OK');
