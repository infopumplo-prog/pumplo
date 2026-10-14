// Každý klíč průvodce (tour.*) použitý v kódu musí existovat v cs i en — i ty vybírané podle volby plánu.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : []; });
const used = new Set();
for (const f of walk(join(root, 'src'))) {
  if (f.includes('/i18n/')) continue;
  for (const m of readFileSync(f, 'utf8').matchAll(/'(tour\.[a-z_]+\.[a-z_]+)'/g)) used.add(m[1]);
}
let missing = 0;
for (const lang of ['cs', 'en']) {
  const src = readFileSync(join(root, `src/i18n/locales/${lang}.ts`), 'utf8');
  for (const k of used) if (!src.includes(`'${k}':`)) { console.error(`${lang}: ${k}`); missing++; }
}
if (used.size < 20) { console.error(`too few keys found (${used.size}) — detector broken?`); process.exit(1); }
console.log(`checked ${used.size} tour keys`);
if (missing) process.exit(1);
console.log('TOUR_I18N_OK');
