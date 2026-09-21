#!/usr/bin/env node
// Brána G7: ověří, že poslední dokončený běh CI (ci.yml) na dané větvi skutečně
// odeslal zprávu do Telegramu — krok „Telegram — výsledek běhu" musí v logu mít
// `telegram: 200` (HTTP status ze sendMessage). Nic neposílá, jen čte log přes gh.
import { spawnSync } from 'node:child_process';

const branch = process.argv[2] || 'feat/offline-cache';
const gh = (args) => {
  const r = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`gh ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
};

const runs = JSON.parse(gh(['run', 'list', '--workflow', 'ci.yml', '--branch', branch, '--status', 'completed', '--limit', '1', '--json', 'databaseId,conclusion,createdAt']));
if (!runs.length) { console.error('TELEGRAM_FAIL: žádný dokončený běh ci.yml'); process.exit(1); }
const run = runs[0];
const log = gh(['run', 'view', String(run.databaseId), '--log']);
const line = log.split('\n').find((l) => /telegram:\s*(\d{3}|chybí)/.test(l));
console.log(`run ${run.databaseId} (${run.conclusion}, ${run.createdAt}): ${line ? line.replace(/^.*?telegram:/, 'telegram:').trim() : 'krok Telegram v logu chybí'}`);
if (line && /telegram:\s*200/.test(line)) { console.log('TELEGRAM_OK'); process.exit(0); }
console.error('TELEGRAM_FAIL');
process.exit(1);
