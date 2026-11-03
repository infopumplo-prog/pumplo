// Každý klíč public_workouts.* použitý v kódu musí existovat v cs i en.
// Dynamické klíče (goal_/level_/error_) se rozbalí z konstant, save_count z plurálových tvarů.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : [];
});
const files = walk(join(root, 'src')).filter((f) => !f.includes('/i18n/locales/'));
const used = new Set();
for (const f of files) {
  for (const m of readFileSync(f, 'utf8').matchAll(/public_workouts\.([a-z_]+)/g)) used.add(m[1]);
}

const lib = readFileSync(join(root, 'src/lib/publicWorkouts.ts'), 'utf8');
const listOf = (name) => JSON.parse(lib.match(new RegExp(`${name} = (\\[[^\\]]+\\])`))[1].replace(/'/g, '"'));
const errors = lib.match(/PublishError = ([^;]+);/)[1].match(/'([a-z_]+)'/g).map((s) => s.replace(/'/g, ''));
const expand = { goal_: listOf('WORKOUT_GOALS'), level_: listOf('WORKOUT_LEVELS'), focus_: listOf('WORKOUT_FOCUSES'), error_: [...errors, 'only_trainers'] };

const required = new Set();
for (const k of used) {
  if (expand[k]) expand[k].forEach((v) => required.add(k + v));
  else if (k === 'save_count' || k === 'adapted_to_gym') required.add(k + '_one').add(k + '_other');
  else required.add(k);
}
required.add('error_generic');

let missing = 0;
for (const lang of ['cs', 'en']) {
  const src = readFileSync(join(root, `src/i18n/locales/${lang}.ts`), 'utf8');
  for (const k of required) {
    if (!src.includes(`'public_workouts.${k}':`)) { console.error(`MISSING ${lang}: public_workouts.${k}`); missing++; }
  }
}
const cs = readFileSync(join(root, 'src/i18n/locales/cs.ts'), 'utf8');
for (const form of ['few', 'many']) {
  if (!cs.includes(`'public_workouts.save_count_${form}':`)) { console.error(`MISSING cs plural: save_count_${form}`); missing++; }
}
console.log(`checked ${required.size} keys from ${used.size} usages`);
if (missing) process.exit(1);
console.log('PUBLIC_WORKOUTS_I18N_OK');
