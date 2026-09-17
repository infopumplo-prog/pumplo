// Ověří, že do Sentry projektu pumplo-app dorazila testovací událost ze setupu.
// Token jen z env SENTRY_AUTH_TOKEN nebo ~/.sentry-token (mimo repo).
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
const token = process.env.SENTRY_AUTH_TOKEN || (() => { try { return readFileSync(`${homedir()}/.sentry-token`, 'utf8').trim(); } catch { return ''; } })();
if (!token) { console.log('SENTRY_NO_TOKEN'); process.exit(1); }
const res = await fetch('https://de.sentry.io/api/0/projects/gyntools-cz-sro/pumplo-app/events/?full=false', { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) { console.log('SENTRY_HTTP_' + res.status); process.exit(1); }
const events = await res.json();
const hit = events.find(e => (e.message || e.title || '').includes('Pumplo CI'));
console.log(hit ? `SENTRY_EVENT_OK ${hit.eventID?.slice(0, 8)} ${hit.dateCreated}` : `SENTRY_EVENT_MISSING (${events.length} events)`);
process.exit(hit ? 0 : 1);
