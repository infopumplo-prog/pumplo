#!/usr/bin/env node
// Skutečná typová kontrola s baseline.
// Kořenový tsconfig.json má `files: []` + references, takže `tsc --noEmit` nic
// nekontroluje. Tady se kontroluje tsconfig.app.json a CI spadne jen tehdy,
// když počet chyb PŘEKROČÍ baseline (scripts/ci/typecheck-baseline.json).
// Když chyb ubude, skript řekne, na kolik baseline snížit.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const baselinePath = join(here, 'typecheck-baseline.json');
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));

const run = spawnSync('npx', ['tsc', '-p', 'tsconfig.app.json', '--noEmit', '--pretty', 'false'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
if (run.error || run.status === null) {
  console.error(`TYPECHECK_FAIL: tsc se nespustil (${run.error?.message ?? `signal ${run.signal}`})`);
  process.exit(1);
}
const out = `${run.stdout ?? ''}${run.stderr ?? ''}`;
const errors = out.split('\n').filter((l) => /error TS\d+/.test(l));
const count = errors.length;

if (process.argv.includes('--update')) {
  writeFileSync(baselinePath, JSON.stringify({ maxErrors: count }, null, 2) + '\n');
  console.log(`typecheck baseline nastaven na ${count}`);
  process.exit(0);
}

console.log(`typecheck: ${count} chyb, baseline ${baseline.maxErrors}`);
if (count > baseline.maxErrors) {
  console.log('\nAktuální chyby (prvních 40):');
  for (const l of errors.slice(0, 40)) console.log('  ' + l);
  console.error(`\nTYPECHECK_FAIL: přibylo ${count - baseline.maxErrors} typových chyb.`);
  process.exit(1);
}
if (count < baseline.maxErrors) {
  console.log('Chyb ubylo — sniž baseline: node scripts/ci/typecheck-baseline.mjs --update');
}
console.log('TYPECHECK_OK');
