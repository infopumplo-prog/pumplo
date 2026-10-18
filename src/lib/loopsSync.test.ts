// Loops (19. 10. 2026): kontakt pro Loops (allowlist, právní brána), události, dry run, rate limit.
// Logika žije v edge funkci loops-sync/sync.ts bez Deno importů.
import { describe, it, expect } from 'vitest';
import {
  ALLOWED_CONTACT_KEYS,
  belongsInLoops,
  FORBIDDEN_FIELDS,
  LOOPS_EVENTS,
  buildContact,
  computeEvents,
  contactHash,
  eventBody,
  idempotencyKey,
  isLoopsDryRun,
  isPlanSlowing,
  legalGate,
  loopsRequest,
  marketingAllowed,
  planContact,
  planDropout,
  pragueDateKey,
  shiftKey,
  workoutWindows,
  type EventHistory,
  type LoopsFactsRow,
} from '../../supabase/functions/loops-sync/sync';

// Úterý 20. 10. 2026, 14:40 UTC = 16:40 v Praze.
const NOW = new Date('2026-10-20T14:40:00Z');
const TODAY = '2026-10-20';
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const daysAgoKey = (d: number) => shiftKey(TODAY, -d);
const EMPTY: EventHistory = { logged: new Set(), lastPlanSlowingAt: null };

const row = (over: Partial<LoopsFactsRow> = {}): LoopsFactsRow => ({
  user_id: '11111111-2222-4333-8444-555555555555',
  email: 'Jana@Example.com',
  first_name: 'Jana Nováková',
  language: 'cs',
  signed_up_at: hoursAgo(24 * 30),
  onboarding_completed: true,
  selected_gym_id: 'g1',
  selected_gym_name: 'Eurogym Olomouc',
  marketing_consent_at: null,
  email_optout_offered_at: hoursAgo(24 * 30),
  marketing_optout_at: null,
  email_unsubscribed_at: null,
  notification_comeback: null,
  completed_workouts: 0,
  first_completed_at: null,
  last_completed_at: null,
  workout_dates: [],
  training_days: ['monday', 'wednesday', 'friday'],
  plan_training_days: null,
  first_plan_at: hoursAgo(24 * 30),
  first_gym_plan_at: null,
  has_active_plan: true,
  recent_workouts: [],
  ...over,
});

const events = (r: LoopsFactsRow, h: EventHistory = EMPTY) => computeEvents(r, h, NOW).map((e) => `${e.event}|${e.episode}`);

describe('dry run je výchozí', () => {
  it('chybějící hodnota, překlep i true → dry run; naostro jen výslovně', () => {
    for (const v of [undefined, null, '', 'true', 'TRUE', 'fasle', 'yes', '1']) expect(isLoopsDryRun(v as string | undefined)).toBe(true);
    for (const v of ['false', 'FALSE', ' 0 ', 'no', 'off']) expect(isLoopsDryRun(v)).toBe(false);
  });
});

describe('legalGate / marketingAllowed (stejná brána jako F1)', () => {
  const L = { marketingConsentAt: null, emailOptoutOfferedAt: null, marketingOptoutAt: null, emailUnsubscribedAt: null };
  it('app-store uživatel bez nabídky odmítnutí a bez souhlasu → false', () => {
    expect(legalGate(L)).toBe('no_legal_basis');
    expect(marketingAllowed(L)).toBe(false);
  });
  it('nabídnuté odmítnutí a neodmítl → true; odmítl → false', () => {
    expect(marketingAllowed({ ...L, emailOptoutOfferedAt: hoursAgo(5) })).toBe(true);
    expect(marketingAllowed({ ...L, emailOptoutOfferedAt: hoursAgo(5), marketingOptoutAt: hoursAgo(5) })).toBe(false);
  });
  it('souhlas → true; odmítnutí po souhlasu vyhrává, souhlas po odmítnutí taky', () => {
    expect(marketingAllowed({ ...L, marketingConsentAt: hoursAgo(5) })).toBe(true);
    expect(legalGate({ ...L, marketingConsentAt: hoursAgo(5), marketingOptoutAt: hoursAgo(1) })).toBe('opted_out');
    expect(legalGate({ ...L, marketingConsentAt: hoursAgo(1), marketingOptoutAt: hoursAgo(5) })).toBe('ok');
  });
  it('odhlášení blokuje vždy', () => {
    expect(legalGate({ ...L, marketingConsentAt: hoursAgo(1), emailUnsubscribedAt: hoursAgo(2) })).toBe('unsubscribed');
  });
});

describe('buildContact — allowlist, žádné zdravotní údaje', () => {
  it('vlastnosti podle zadání', () => {
    const c = buildContact(row({ completed_workouts: 3, last_completed_at: '2026-10-18T16:00:00+00:00' }))!;
    expect(c).toEqual({
      email: 'jana@example.com',
      userId: '11111111-2222-4333-8444-555555555555',
      firstName: 'Jana',
      language: 'cs',
      gymName: 'Eurogym Olomouc',
      workoutsCompleted: 3,
      lastWorkoutAt: '2026-10-18T16:00:00.000Z',
      signupAt: hoursAgo(24 * 30),
      onboardingCompleted: true,
      hasPlan: true,
      marketingAllowed: true,
      retentionEmailsAllowed: true,
      userGroup: 'retention',
    });
  });
  it('řádek se zraněním, váhou, výškou, věkem a pohlavím → nic z toho neodejde', () => {
    const dirty = { ...row(), injuries: ['koleno'], injury_note: 'bolí koleno', weight_kg: 82, height_cm: 180, age: 34, gender: 'female', motivations: ['health'] } as unknown as LoopsFactsRow;
    const c = buildContact(dirty)!;
    const keys = Object.keys(c);
    for (const k of keys) expect(ALLOWED_CONTACT_KEYS as readonly string[]).toContain(k);
    for (const bad of FORBIDDEN_FIELDS) expect(keys).not.toContain(bad);
    const serialized = JSON.stringify([c, ...computeEvents(dirty, EMPTY, NOW).map((e) => eventBody(c, e))]);
    for (const leak of ['koleno', '82', '180', 'female', 'health']) expect(serialized).not.toContain(leak);
  });
  it('bez e-mailu žádný kontakt; jazyk jen cs/en; bez posilovny gymName chybí', () => {
    expect(buildContact(row({ email: null }))).toBeNull();
    expect(buildContact(row({ email: 'bez-zavinace' }))).toBeNull();
    expect(buildContact(row({ language: 'de' }))!.language).toBe('cs');
    expect(buildContact(row({ language: 'en' }))!.language).toBe('en');
    const c = buildContact(row({ selected_gym_id: null, selected_gym_name: null, completed_workouts: 0 }))!;
    expect('gymName' in c).toBe(false);
    expect(c.userGroup).toBe('activation');
  });
  it('marketingAllowed false bez právního základu (app-store build)', () => {
    expect(buildContact(row({ email_optout_offered_at: null }))!.marketingAllowed).toBe(false);
    expect(buildContact(row({ marketing_optout_at: hoursAgo(1) }))!.marketingAllowed).toBe(false);
    expect(buildContact(row({ email_optout_offered_at: null, marketing_consent_at: hoursAgo(1) }))!.marketingAllowed).toBe(true);
  });
});

describe('planContact — upsert jen při změně', () => {
  it('nový → upsert bez subscribed; stejný otisk → skip; změna → upsert', () => {
    const c = buildContact(row())!;
    const a = planContact(c, undefined);
    expect(a.kind).toBe('upsert');
    if (a.kind === 'upsert') expect('subscribed' in a.body).toBe(false);
    expect(planContact(c, { propsHash: contactHash(c), removedAt: null })).toEqual({ kind: 'skip' });
    expect(planContact({ ...c, workoutsCompleted: 1 }, { propsHash: contactHash(c), removedAt: null }).kind).toBe('upsert');
  });
  it('návrat po vyřazení → subscribed:true', () => {
    const c = buildContact(row())!;
    const a = planContact(c, { propsHash: contactHash(c), removedAt: hoursAgo(10) });
    expect(a.kind === 'upsert' && a.body.subscribed).toBe(true);
  });
});

describe('computeEvents', () => {
  it('signed_up jen do 48 h od registrace (žádný backfill historie)', () => {
    expect(events(row({ signed_up_at: hoursAgo(3), onboarding_completed: false, first_plan_at: null }))).toEqual(['signed_up|life']);
    expect(events(row({ signed_up_at: hoursAgo(49), onboarding_completed: false, first_plan_at: null }))).toEqual([]);
  });
  it('dotazník hotový s posilovnou: onboarding_completed (bez plan_ready, ten až s plánem pro posilovnu)', () => {
    expect(events(row({ signed_up_at: hoursAgo(5), first_plan_at: hoursAgo(4) }))).toEqual(['signed_up|life', 'onboarding_completed|life']);
  });
  it('dotazník hotový bez posilovny → plan_ready nogym; později plán pro posilovnu → plan_ready gym', () => {
    const nogym = row({ first_plan_at: hoursAgo(4), selected_gym_id: null, selected_gym_name: null });
    const e = computeEvents(nogym, EMPTY, NOW);
    expect(e.map((x) => `${x.event}|${x.episode}`)).toEqual(['onboarding_completed|life', 'plan_ready|nogym']);
    expect(e[1].eventProperties).toEqual({ gymName: '', noGym: true });
    const later = computeEvents(row({ first_plan_at: hoursAgo(100), first_gym_plan_at: hoursAgo(2) }), EMPTY, NOW);
    expect(later.map((x) => `${x.event}|${x.episode}`)).toEqual(['plan_ready|gym']);
    expect(later[0].eventProperties).toEqual({ gymName: 'Eurogym Olomouc', noGym: false });
  });
  it('první trénink + workout_completed s pořadím; idempotence přes log', () => {
    const r = row({
      completed_workouts: 1, first_completed_at: hoursAgo(2), last_completed_at: hoursAgo(2),
      workout_dates: [TODAY], recent_workouts: [{ id: 'w1', at: hoursAgo(2) }],
    });
    expect(events(r)).toEqual(['first_workout_completed|life', 'workout_completed|w1']);
    const logged = new Set(['first_workout_completed|life', 'workout_completed|w1']);
    expect(events(r, { logged, lastPlanSlowingAt: null })).toEqual([]);
    const r3 = row({
      completed_workouts: 5, first_completed_at: hoursAgo(500), last_completed_at: hoursAgo(1), workout_dates: [daysAgoKey(20), daysAgoKey(14), daysAgoKey(5), TODAY, TODAY],
      recent_workouts: [{ id: 'w5', at: hoursAgo(1) }, { id: 'w4', at: hoursAgo(30) }],
    });
    const e3 = computeEvents(r3, EMPTY, NOW).filter((x) => x.event === 'workout_completed');
    expect(e3.map((x) => [x.episode, x.eventProperties.workoutNumber])).toEqual([['w4', 4], ['w5', 5]]);
  });
  it('inactive_21d jen v okně 21–24 dní, epizoda = datum posledního tréninku', () => {
    const r = (d: number) => row({ completed_workouts: 2, workout_dates: [daysAgoKey(d + 5), daysAgoKey(d)], first_completed_at: hoursAgo(24 * (d + 5)), last_completed_at: hoursAgo(24 * d) });
    expect(events(r(20))).toEqual([]);
    expect(events(r(21))).toEqual([`inactive_21d|${daysAgoKey(21)}`]);
    expect(events(r(24))).toEqual([`inactive_21d|${daysAgoKey(24)}`]);
    expect(events(r(25))).toEqual([]);
    expect(events(r(22), { logged: new Set([`inactive_21d|${daysAgoKey(22)}`]), lastPlanSlowingAt: null })).toEqual([]);
    // strop 2× za 90 dní
    expect(events(r(22), { logged: new Set(), lastPlanSlowingAt: null, inactiveSentAt: [hoursAgo(24 * 30), hoursAgo(24 * 80)] })).toEqual([]);
    expect(events(r(22), { logged: new Set(), lastPlanSlowingAt: null, inactiveSentAt: [hoursAgo(24 * 30), hoursAgo(24 * 95)] })).toEqual([`inactive_21d|${daysAgoKey(22)}`]);
  });
  it('plan_slowing (definice M7) nejvýš jednou za 21 dní', () => {
    const r = row({ completed_workouts: 4, workout_dates: [daysAgoKey(30), daysAgoKey(25), daysAgoKey(20), daysAgoKey(8)], first_completed_at: hoursAgo(720), last_completed_at: hoursAgo(192) });
    expect(events(r)).toEqual([`plan_slowing|${TODAY}`]);
    expect(events(r, { logged: new Set(), lastPlanSlowingAt: hoursAgo(20 * 24) })).toEqual([]);
    expect(events(r, { logged: new Set(), lastPlanSlowingAt: hoursAgo(22 * 24) })).toEqual([`plan_slowing|${TODAY}`]);
  });
  it('isPlanSlowing a okna', () => {
    expect(workoutWindows([daysAgoKey(0), daysAgoKey(13), daysAgoKey(14), daysAgoKey(27), daysAgoKey(28)], TODAY)).toEqual({ n14: 2, n14prev: 2 });
    expect(isPlanSlowing([daysAgoKey(20), daysAgoKey(10), daysAgoKey(6), daysAgoKey(2)], 3, TODAY)).toBe(false);
    expect(isPlanSlowing([daysAgoKey(25), daysAgoKey(22), daysAgoKey(18), daysAgoKey(16), daysAgoKey(3)], null, TODAY)).toBe(true);
    expect(isPlanSlowing([daysAgoKey(30), daysAgoKey(20), daysAgoKey(15)], 1, TODAY)).toBe(false);
  });
  it('všechny emitované události jsou z dohodnutého seznamu', () => {
    expect([...LOOPS_EVENTS]).toEqual(['signed_up', 'onboarding_completed', 'plan_ready', 'first_workout_completed', 'workout_completed', 'inactive_21d', 'plan_slowing']);
  });
  it('pražské datum přes půlnoc', () => {
    expect(pragueDateKey(new Date('2026-10-20T22:30:00Z'))).toBe('2026-10-21');
  });
});

describe('tělo události a idempotence', () => {
  it('event nese marketingAllowed jako vlastnost kontaktu', () => {
    const c = buildContact(row({ email_optout_offered_at: null }))!;
    const b = eventBody(c, { event: 'signed_up', episode: 'life', eventProperties: {} });
    expect(b).toEqual({ email: 'jana@example.com', userId: c.userId, eventName: 'signed_up', eventProperties: {}, marketingAllowed: false, retentionEmailsAllowed: true });
    expect(idempotencyKey(c.userId, { event: 'workout_completed', episode: 'x'.repeat(200) }).length).toBe(100);
  });
});

describe('minimalizace dat a vyřazení', () => {
  it('do Loops patří jen kontakt s marketingAllowed', () => {
    expect(belongsInLoops(buildContact(row()))).toBe(true);
    expect(belongsInLoops(buildContact(row({ email_optout_offered_at: null })))).toBe(false); // app-store bez souhlasu
    expect(belongsInLoops(buildContact(row({ marketing_optout_at: hoursAgo(1) })))).toBe(false); // odmítl
    expect(belongsInLoops(buildContact(row({ marketing_consent_at: hoursAgo(5), marketing_optout_at: hoursAgo(1) })))).toBe(false); // stáhl souhlas
    expect(belongsInLoops(buildContact(row({ email: null })))).toBe(false);
  });
  it('vyřazení = smazat kontakt jen podle userId, s důvodem', () => {
    for (const reason of ['marketing_not_allowed', 'not_eligible', 'account_deleted'] as const) {
      expect(planDropout('u', reason)).toEqual({ kind: 'delete', reason, body: { userId: 'u' } });
    }
  });
});

describe('retentionEmailsAllowed (comeback pushe)', () => {
  it('vypnutý comeback → false, zapnutý nebo neuvedený → true; jde i s událostí', () => {
    expect(buildContact(row({ notification_comeback: false }))!.retentionEmailsAllowed).toBe(false);
    expect(buildContact(row({ notification_comeback: true }))!.retentionEmailsAllowed).toBe(true);
    expect(buildContact(row({ notification_comeback: null }))!.retentionEmailsAllowed).toBe(true);
    const c = buildContact(row({ notification_comeback: false }))!;
    expect(eventBody(c, { event: 'inactive_21d', episode: 'x', eventProperties: {} }).retentionEmailsAllowed).toBe(false);
  });
});

describe('loopsRequest — rate limit', () => {
  const resp = (status: number, text = '') => ({ status, text: async () => text });
  it('429 → backoff 1 s, 2 s a pak úspěch', async () => {
    const statuses = [429, 429, 200];
    const sleeps: number[] = [];
    const calls: { headers: Record<string, string> }[] = [];
    const r = await loopsRequest({
      apiKey: 'k',
      sleep: async (ms) => { sleeps.push(ms); },
      fetch: async (_u, init) => { calls.push(init); return resp(statuses.shift()!); },
    }, 'POST', '/events/send', { a: 1 }, 'idem');
    expect(r).toEqual({ ok: true, status: 200 });
    expect(sleeps).toEqual([1000, 2000]);
    expect(calls[0].headers.Authorization).toBe('Bearer k');
    expect(calls[0].headers['Idempotency-Key']).toBe('idem');
  });
  it('trvalé 429 → rateLimited; 409 s idempotency = už zpracováno; 400 = chyba', async () => {
    const mk = (s: number) => ({ apiKey: 'k', sleep: async () => {}, fetch: async () => resp(s, 'bad') });
    expect(await loopsRequest(mk(429), 'POST', '/events/send', {}, 'i')).toMatchObject({ ok: false, rateLimited: true });
    expect(await loopsRequest(mk(409), 'POST', '/events/send', {}, 'i')).toEqual({ ok: true, status: 409, duplicate: true });
    expect(await loopsRequest(mk(400), 'PUT', '/contacts/update', {})).toEqual({ ok: false, status: 400, error: 'bad' });
  });
});
