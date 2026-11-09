// Trenérská platforma v appce: každý klíč trainer_client.* musí být v cs i en,
// každý klíč použitý v src/ musí existovat a dynamicky skládané klíče
// (`trainer_client.${x}`) jsou zakázané — gate by je nezkontroloval.
// Spuštění: node scripts/gates/trainer-app-i18n.mjs → TRAINER_I18N_OK / exit 1.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const NS = 'trainer_client';

// Locales jsou TS objekty s plochými klíči: `  'ns.key': 'hodnota',` (i "…" a `…`).
// Čteme řádek po řádku a hodnotu jen do konce řetězce (escapované uvozovky OK).
const ENTRY_RE = /^\s*(['"])([^'"]+)\1\s*:\s*(['"`])((?:\\.|(?!\3)[^\\])*)\3\s*,?\s*(?:\/\/.*)?$/;
const KEY_ONLY_RE = /^\s*(['"])([^'"]+)\1\s*:/;

const readLocale = (lang) => {
  const file = join(root, `src/i18n/locales/${lang}.ts`);
  const src = readFileSync(file, 'utf8');
  const entries = new Map();
  const problems = [];
  src.split('\n').forEach((line, i) => {
    const keyMatch = KEY_ONLY_RE.exec(line);
    if (!keyMatch || !keyMatch[2].startsWith(`${NS}.`)) return;
    const key = keyMatch[2];
    const m = ENTRY_RE.exec(line);
    if (!m) { problems.push(`${lang}.ts:${i + 1} ${key} — nepodařilo se přečíst hodnotu (víceřádková?)`); return; }
    if (entries.has(key)) problems.push(`${lang}.ts:${i + 1} ${key} — duplicitní klíč`);
    if (!m[4].trim()) problems.push(`${lang}.ts:${i + 1} ${key} — prázdná hodnota`);
    entries.set(key, m[4]);
  });
  return { entries, problems };
};

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : [];
});

const used = new Map(); // key → první soubor
const dynamic = [];
for (const file of walk(join(root, 'src'))) {
  if (file.includes(`${join('src', 'i18n')}`)) continue;
  if (/\.test\.tsx?$/.test(file)) continue;
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(new RegExp(`(['"\`])(${NS}\\.[A-Za-z0-9_.]+)\\1`, 'g'))) {
    if (!used.has(m[2])) used.set(m[2], relative(root, file));
  }
  for (const m of src.matchAll(new RegExp(`\`${NS}\\.[A-Za-z0-9_.]*\\$\\{`, 'g'))) {
    dynamic.push(`${relative(root, file)}: ${m[0]}…`);
  }
}

const cs = readLocale('cs');
const en = readLocale('en');
const missing = [...cs.problems, ...en.problems];

for (const [key, file] of used) {
  if (!cs.entries.has(key)) missing.push(`cs: ${key} (použito v ${file})`);
  if (!en.entries.has(key)) missing.push(`en: ${key} (použito v ${file})`);
}
for (const key of cs.entries.keys()) if (!en.entries.has(key)) missing.push(`en: ${key} (je jen v cs)`);
for (const key of en.entries.keys()) if (!cs.entries.has(key)) missing.push(`cs: ${key} (je jen v en)`);

// Stejné proměnné {{x}} v obou jazycích.
const vars = (s) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');
for (const [key, csVal] of cs.entries) {
  const enVal = en.entries.get(key);
  if (enVal !== undefined && vars(csVal) !== vars(enVal)) {
    missing.push(`${key}: proměnné se liší (cs: {${vars(csVal)}} vs en: {${vars(enVal)}})`);
  }
}
for (const d of dynamic) missing.push(`dynamický klíč (nejde ověřit): ${d}`);

if (cs.entries.size < 20 || used.size < 20) {
  console.error(`příliš málo klíčů (locale ${cs.entries.size}, použito ${used.size}) — detektor rozbitý?`);
  process.exit(1);
}

console.log(`trainer_client: ${cs.entries.size} klíčů v cs, ${en.entries.size} v en, ${used.size} použito v src`);
if (missing.length) {
  console.error('Chybí / problém:');
  for (const m of missing) console.error(`  ${m}`);
  process.exit(1);
}
const unused = [...cs.entries.keys()].filter((k) => !used.has(k));
if (unused.length) console.log(`nepoužité (jen info): ${unused.join(', ')}`);
console.log('TRAINER_I18N_OK');
