// Testy pravidel F1 (M3–M8): okna v pražských dnech, priority, stropy, právní brána.
// Pravidla žijí v edge funkci lifecycle-emails/rules.ts bez Deno importů.
import { describe, it, expect } from 'vitest';
import {
  MARKETING_KEYS,
  checkCaps,
  daysToNextTrainingDay,
  decideLifecycle,
  isPlanSlowing,
  legalGate,
  marketingVars,
  pickTrigger,
  pragueDateKey,
  renderEmail,
  shiftKey,
  workoutWindows,
  workoutsLine,
  byChannelPreference,
  type LifecycleFacts,
  type LifecycleHistory,
  type TemplateRow,
} from '../../supabase/functions/lifecycle-emails/rules';

// Úterý 20. 10. 2026, 14:30 UTC = 16:30 v Praze (letní čas) → slot obchodních e-mailů.
const NOW = new Date('2026-10-20T14:30:00Z');
const TODAY = '2026-10-20';
const hoursAgo = (h: number, from = NOW) => new Date(from.getTime() - h * 3_600_000).toISOString();
const daysAgoKey = (d: number) => shiftKey(TODAY, -d);
/** Okamžik v pražském dni `d` dní zpět, 10:00 Praha (8:00 UTC). */
const daysAgoAt10 = (d: number) => `${daysAgoKey(d)}T08:00:00Z`;

const ALL = new Set<string>(MARKETING_KEYS);
const EMPTY: LifecycleHistory = { emails: [], contacts: [], pushDateKeys: [] };

const base: LifecycleFacts = {
  userId: 'u1',
  email: 'jana@example.com',
  signedUpAt: daysAgoAt10(2),
  onboardingCompleted: true,
  selectedGymId: 'g1',
  marketingConsentAt: null,
  emailOptoutOfferedAt: daysAgoAt10(2), // nová registrace se zaškrtávátkem
  marketingOptoutAt: null,
  emailUnsubscribedAt: null,
  notificationComeback: true,
  trainingDays: ['monday', 'wednesday', 'friday'],
  planTrainingDays: null,
  firstGymPlanAt: null,
  workoutDates: [],
  hasDeviceToken: false,
};

const decide = (f: Partial<LifecycleFacts>, h: Partial<LifecycleHistory> = {}, now = NOW, approved: Set<string> = ALL) =>
  decideLifecycle({ ...base, ...f }, { ...EMPTY, ...h }, now, approved);

const sentRow = (templateKey: string, sentAt: string, episodeKey = 'life', status = 'sent') => ({ templateKey, episodeKey, sentAt, status });

describe('časové pomůcky', () => {
  it('pražské datum přes půlnoc', () => {
    expect(pragueDateKey(new Date('2026-10-19T22:30:00Z'))).toBe('2026-10-20'); // 00:30 Praha
    expect(pragueDateKey(new Date('2026-10-19T21:30:00Z'))).toBe('2026-10-19');
  });
  it('nejbližší tréninkový den', () => {
    // Dnes úterý → zítra středa
    expect(daysToNextTrainingDay(['wednesday'], TODAY)).toBe(1);
    expect(daysToNextTrainingDay(['monday'], TODAY)).toBe(6);
    expect(daysToNextTrainingDay(['tuesday'], TODAY)).toBe(7);
    expect(daysToNextTrainingDay(null, TODAY)).toBeNull();
  });
});

describe('legalGate — právní brána obchodních sdělení', () => {
  const g = (p: Partial<LifecycleFacts>) => legalGate({ ...base, emailOptoutOfferedAt: null, ...p });
  it('app-store uživatel bez nabídnutého odmítnutí a bez souhlasu → nic', () => {
    expect(g({})).toBe('no_legal_basis');
  });
  it('nabídnuté odmítnutí, neodmítl → ok', () => {
    expect(g({ emailOptoutOfferedAt: hoursAgo(5) })).toBe('ok');
  });
  it('nabídnuté a odmítnuté → nic', () => {
    expect(g({ emailOptoutOfferedAt: hoursAgo(5), marketingOptoutAt: hoursAgo(5) })).toBe('opted_out');
  });
  it('souhlas → ok i bez nabídky', () => {
    expect(g({ marketingConsentAt: hoursAgo(5) })).toBe('ok');
  });
  it('odmítnutí po souhlasu vyhrává, souhlas po odmítnutí taky', () => {
    expect(g({ marketingConsentAt: hoursAgo(10), marketingOptoutAt: hoursAgo(5) })).toBe('opted_out');
    expect(g({ marketingConsentAt: hoursAgo(5), marketingOptoutAt: hoursAgo(10) })).toBe('ok');
  });
  it('odhlášení blokuje vždy', () => {
    expect(g({ marketingConsentAt: hoursAgo(5), emailUnsubscribedAt: hoursAgo(1) })).toBe('unsubscribed');
    expect(g({ emailOptoutOfferedAt: hoursAgo(5), emailUnsubscribedAt: hoursAgo(1) })).toBe('unsubscribed');
  });
});

describe('žádný obchodní mail bez právního základu', () => {
  // Pro každý mail M3–M8 situace, kdy by jinak odešel (pozitivní kontrola).
  const scenarios: Record<string, Partial<LifecycleFacts>> = {
    M3A: { signedUpAt: daysAgoAt10(2) },
    M3B: { signedUpAt: daysAgoAt10(2), selectedGymId: null },
    M4: { signedUpAt: daysAgoAt10(4), firstGymPlanAt: hoursAgo(80) },
    M5: { signedUpAt: daysAgoAt10(8) },
    M6: { workoutDates: [daysAgoKey(3)] },
    M7: { workoutDates: [daysAgoKey(30), daysAgoKey(25), daysAgoKey(20), daysAgoKey(8)] },
    M8: { workoutDates: [daysAgoKey(40), daysAgoKey(22)] },
  };
  for (const [key, s] of Object.entries(scenarios)) {
    it(`${key}: s nabídkou odejde, app-store uživatel bez nabídky ne`, () => {
      const ok = decide(s);
      expect(ok).toEqual(expect.objectContaining({ send: true, key }));
      expect(decide({ ...s, emailOptoutOfferedAt: null })).toEqual({ send: false, key, reason: 'no_legal_basis' });
      expect(decide({ ...s, marketingOptoutAt: hoursAgo(1) })).toEqual({ send: false, key, reason: 'opted_out' });
      expect(decide({ ...s, emailUnsubscribedAt: hoursAgo(1) })).toEqual({ send: false, reason: 'unsubscribed' });
      expect(decide({ ...s, emailOptoutOfferedAt: null, marketingConsentAt: hoursAgo(1) })).toEqual(expect.objectContaining({ send: true, key }));
    });
  }
  it('bez schválené šablony se nic nepošle a nižší priorita to nenahradí', () => {
    const r = decide({ signedUpAt: daysAgoAt10(2) }, {}, NOW, new Set(['M5']));
    expect(r).toEqual({ send: false, key: 'M3A', reason: 'not_approved' });
    expect(decide({ signedUpAt: daysAgoAt10(2) }, {}, NOW, new Set())).toEqual({ send: false, key: 'M3A', reason: 'not_approved' });
  });
});

describe('M3 — dotazník hotový, trénink nespuštěný', () => {
  it('varianta A s posilovnou, B bez', () => {
    expect(pickTrigger({ ...base }, EMPTY, NOW)?.key).toBe('M3A');
    expect(pickTrigger({ ...base, selectedGymId: null }, EMPTY, NOW)?.key).toBe('M3B');
  });
  it('okno: ≥ 18 h a pražský den 1–3 po registraci', () => {
    expect(pickTrigger({ ...base, signedUpAt: hoursAgo(5) }, EMPTY, NOW)).toBeNull(); // den 0
    expect(pickTrigger({ ...base, signedUpAt: '2026-10-19T21:00:00Z' }, EMPTY, NOW)).toBeNull(); // den 1, ale jen 17,5 h
    expect(pickTrigger({ ...base, signedUpAt: daysAgoAt10(1) }, EMPTY, NOW)?.key).toBe('M3A');
    expect(pickTrigger({ ...base, signedUpAt: daysAgoAt10(3) }, EMPTY, NOW)?.key).toBe('M3A');
    expect(pickTrigger({ ...base, signedUpAt: daysAgoAt10(4) }, EMPTY, NOW)).toBeNull();
  });
  it('nedokončený dotazník → nikdy (to je M2A)', () => {
    expect(pickTrigger({ ...base, onboardingCompleted: false }, EMPTY, NOW)).toBeNull();
  });
  it('jednou za život účtu (A i B dohromady) a ne po M5', () => {
    expect(pickTrigger(base, { ...EMPTY, emails: [sentRow('M3B', hoursAgo(30))] }, NOW)).toBeNull();
    expect(pickTrigger(base, { ...EMPTY, emails: [sentRow('M5', hoursAgo(30))] }, NOW)).toBeNull();
  });
  it('spuštěný trénink (plán s posilovnou) → ne M3', () => {
    expect(pickTrigger({ ...base, firstGymPlanAt: hoursAgo(2) }, EMPTY, NOW)).toBeNull();
  });
});

describe('M4 — spustil, nedokončil', () => {
  const m4 = { ...base, signedUpAt: daysAgoAt10(3), firstGymPlanAt: hoursAgo(30) };
  it('zítra tréninkový den → po 20 h', () => {
    expect(pickTrigger({ ...m4, trainingDays: ['wednesday'] }, EMPTY, NOW)?.key).toBe('M4');
    expect(pickTrigger({ ...m4, trainingDays: ['wednesday'], firstGymPlanAt: hoursAgo(19) }, EMPTY, NOW)).toBeNull();
  });
  it('zítra není tréninkový den → čeká do 72 h od spuštění', () => {
    expect(pickTrigger({ ...m4, trainingDays: ['friday'] }, EMPTY, NOW)).toBeNull();
    expect(pickTrigger({ ...m4, trainingDays: ['friday'], firstGymPlanAt: hoursAgo(73) }, EMPTY, NOW)?.key).toBe('M4');
  });
  it('dny neznámé → hned po 20 h; aktivní plán má přednost před profilem', () => {
    expect(pickTrigger({ ...m4, trainingDays: null }, EMPTY, NOW)?.key).toBe('M4');
    expect(pickTrigger({ ...m4, trainingDays: ['friday'], planTrainingDays: ['wednesday'] }, EMPTY, NOW)?.key).toBe('M4');
  });
  it('nejpozději 7. den od registrace, jednou, ne po M5', () => {
    expect(pickTrigger({ ...m4, trainingDays: null, signedUpAt: daysAgoAt10(7) }, EMPTY, NOW)?.key).toBe('M4');
    expect(pickTrigger({ ...m4, trainingDays: null, signedUpAt: daysAgoAt10(8) }, EMPTY, NOW)?.key).toBe('M5');
    expect(pickTrigger({ ...m4, trainingDays: null }, { ...EMPTY, emails: [sentRow('M4', hoursAgo(50))] }, NOW)).toBeNull();
  });
  it('priorita M4 > M5 ve stejný den (den 7)', () => {
    expect(pickTrigger({ ...m4, trainingDays: null, signedUpAt: daysAgoAt10(7) }, EMPTY, NOW)?.key).toBe('M4');
  });
});

describe('M5 — den 7–10 bez tréninku', () => {
  it('okno 7–10, jednou', () => {
    for (const d of [6, 11]) expect(pickTrigger({ ...base, signedUpAt: daysAgoAt10(d) }, EMPTY, NOW)).toBeNull();
    for (const d of [7, 8, 9, 10]) expect(pickTrigger({ ...base, signedUpAt: daysAgoAt10(d) }, EMPTY, NOW)?.key).toBe('M5');
    expect(pickTrigger({ ...base, signedUpAt: daysAgoAt10(8) }, { ...EMPTY, emails: [sentRow('M5', hoursAgo(30))] }, NOW)).toBeNull();
  });
  it('kdo už trénoval, je v udržení (žádné aktivační maily)', () => {
    expect(pickTrigger({ ...base, signedUpAt: daysAgoAt10(8), workoutDates: [daysAgoKey(1)] }, EMPTY, NOW)).toBeNull();
  });
});

describe('M6 — jeden trénink, druhý nepřišel', () => {
  it('den 2 jen když je zítra tréninkový den (nebo dny neznáme), den 3 vždy', () => {
    expect(pickTrigger({ ...base, workoutDates: [daysAgoKey(2)], trainingDays: ['wednesday'] }, EMPTY, NOW)?.key).toBe('M6');
    expect(pickTrigger({ ...base, workoutDates: [daysAgoKey(2)], trainingDays: ['friday'] }, EMPTY, NOW)).toBeNull();
    expect(pickTrigger({ ...base, workoutDates: [daysAgoKey(2)], trainingDays: null }, EMPTY, NOW)?.key).toBe('M6');
    expect(pickTrigger({ ...base, workoutDates: [daysAgoKey(3)], trainingDays: ['friday'] }, EMPTY, NOW)?.key).toBe('M6');
    expect(pickTrigger({ ...base, workoutDates: [daysAgoKey(1)] }, EMPTY, NOW)).toBeNull();
    expect(pickTrigger({ ...base, workoutDates: [daysAgoKey(4)] }, EMPTY, NOW)).toBeNull();
  });
  it('epizoda = datum prvního tréninku, jednou na epizodu', () => {
    const t = pickTrigger({ ...base, workoutDates: [daysAgoKey(3)] }, EMPTY, NOW);
    expect(t).toEqual({ key: 'M6', episode: daysAgoKey(3) });
    expect(pickTrigger({ ...base, workoutDates: [daysAgoKey(3)] }, { ...EMPTY, emails: [sentRow('M6', hoursAgo(24), daysAgoKey(3))] }, NOW)).toBeNull();
  });
  it('dva tréninky → žádný M6', () => {
    expect(pickTrigger({ ...base, workoutDates: [daysAgoKey(3), daysAgoKey(3)] }, EMPTY, NOW)).toBeNull();
  });
  it('vypnutý comeback → nic', () => {
    expect(decide({ workoutDates: [daysAgoKey(3)], notificationComeback: false })).toEqual({ send: false, key: 'M6', reason: 'comeback_off' });
  });
});

describe('M7 — zpomalení plánu', () => {
  it('okna n14 a n14prev', () => {
    expect(workoutWindows([daysAgoKey(0), daysAgoKey(13), daysAgoKey(14), daysAgoKey(27), daysAgoKey(28)], TODAY)).toEqual({ n14: 2, n14prev: 2 });
  });
  it('A: méně než polovina plánu za 14 dní a po termínu', () => {
    // tpw 3, n14 = 1 (před 8 dny), 8 > 14/3
    expect(isPlanSlowing({ workoutDates: [daysAgoKey(30), daysAgoKey(25), daysAgoKey(8)], planTrainingDays: null, trainingDays: ['monday', 'wednesday', 'friday'] }, TODAY)).toBe(true);
    // tpw 3, n14 = 3 → na tempu
    expect(isPlanSlowing({ workoutDates: [daysAgoKey(20), daysAgoKey(10), daysAgoKey(6), daysAgoKey(2)], planTrainingDays: null, trainingDays: ['monday', 'wednesday', 'friday'] }, TODAY)).toBe(false);
    // tpw 1, n14 = 0? → poslední > 13 dní = pauza, ne M7
    expect(isPlanSlowing({ workoutDates: [daysAgoKey(30), daysAgoKey(20), daysAgoKey(15)], planTrainingDays: null, trainingDays: ['monday'] }, TODAY)).toBe(false);
  });
  it('A: den po tréninku ještě není po termínu', () => {
    // tpw 2 → 14/2 = 7; poslední před 5 dny a n14 = 1 < 2 → ne (5 ≤ 7)
    expect(isPlanSlowing({ workoutDates: [daysAgoKey(30), daysAgoKey(20), daysAgoKey(5)], planTrainingDays: ['monday', 'thursday'], trainingDays: null }, TODAY)).toBe(false);
  });
  it('B: pokles vlastního tempa na polovinu (bez známých dnů)', () => {
    expect(isPlanSlowing({ workoutDates: [daysAgoKey(25), daysAgoKey(22), daysAgoKey(18), daysAgoKey(16), daysAgoKey(3)], planTrainingDays: null, trainingDays: null }, TODAY)).toBe(true);
    expect(isPlanSlowing({ workoutDates: [daysAgoKey(25), daysAgoKey(22), daysAgoKey(5), daysAgoKey(3)], planTrainingDays: null, trainingDays: null }, TODAY)).toBe(false);
  });
  it('vstupní podmínky: ≥ 3 tréninky a první před ≥ 14 dny', () => {
    expect(isPlanSlowing({ workoutDates: [daysAgoKey(30), daysAgoKey(8)], planTrainingDays: null, trainingDays: ['monday', 'wednesday', 'friday'] }, TODAY)).toBe(false);
    expect(isPlanSlowing({ workoutDates: [daysAgoKey(13), daysAgoKey(10), daysAgoKey(8)], planTrainingDays: null, trainingDays: ['monday', 'wednesday', 'friday'] }, TODAY)).toBe(false);
  });
  it('nejvýš jednou za 21 dní', () => {
    const f = { ...base, workoutDates: [daysAgoKey(30), daysAgoKey(25), daysAgoKey(20), daysAgoKey(8)] };
    expect(pickTrigger(f, EMPTY, NOW)).toEqual({ key: 'M7', episode: TODAY });
    expect(pickTrigger(f, { ...EMPTY, emails: [sentRow('M7', hoursAgo(20 * 24), daysAgoKey(20))] }, NOW)).toBeNull();
    expect(pickTrigger(f, { ...EMPTY, emails: [sentRow('M7', hoursAgo(22 * 24), daysAgoKey(22))] }, NOW)?.key).toBe('M7');
  });
});

describe('M8 — 21–24 dní bez tréninku', () => {
  it('okno 21–24 od posledního tréninku, epizoda = jeho datum', () => {
    for (const d of [20, 25]) expect(pickTrigger({ ...base, workoutDates: [daysAgoKey(40), daysAgoKey(d)] }, EMPTY, NOW)).toBeNull();
    for (const d of [21, 22, 23, 24]) expect(pickTrigger({ ...base, workoutDates: [daysAgoKey(40), daysAgoKey(d)] }, EMPTY, NOW)).toEqual({ key: 'M8', episode: daysAgoKey(d) });
  });
  it('jednou na epizodu, max 2 za 90 dní', () => {
    const f = { ...base, workoutDates: [daysAgoKey(60), daysAgoKey(22)] };
    expect(pickTrigger(f, { ...EMPTY, emails: [sentRow('M8', hoursAgo(24), daysAgoKey(22))] }, NOW)).toBeNull();
    const two = [sentRow('M8', hoursAgo(30 * 24), 'a'), sentRow('M8', hoursAgo(60 * 24), 'b')];
    expect(pickTrigger(f, { ...EMPTY, emails: two }, NOW)).toBeNull();
    const old = [sentRow('M8', hoursAgo(30 * 24), 'a'), sentRow('M8', hoursAgo(95 * 24), 'b')];
    expect(pickTrigger(f, { ...EMPTY, emails: old }, NOW)?.key).toBe('M8');
  });
  it('den 23 s push tokenem obsadí comeback push', () => {
    const f = { workoutDates: [daysAgoKey(40), daysAgoKey(23)] };
    expect(decide({ ...f, hasDeviceToken: true })).toEqual({ send: false, key: 'M8', reason: 'comeback_push_day' });
    expect(decide({ ...f, hasDeviceToken: false })).toEqual(expect.objectContaining({ send: true, key: 'M8' }));
  });
  it('vypnutý comeback → nic', () => {
    expect(decide({ workoutDates: [daysAgoKey(22)], notificationComeback: false })).toEqual({ send: false, key: 'M8', reason: 'comeback_off' });
  });
});

describe('priority v udržení: M6 > M8 > M7', () => {
  it('M8 má přednost před M7 (obojí nemůže nastat zároveň: M7 jen do 13 dní)', () => {
    // Pojistka: M7 vyžaduje poslední ≤ 13 dní, M8 21+ → nikdy souběh; M6 vyžaduje přesně 1 trénink.
    expect(pickTrigger({ ...base, workoutDates: [daysAgoKey(22)] }, EMPTY, NOW)?.key).toBe('M8');
  });
  it('vyšší priorita zablokovaná stropem → nižší se ten den nepošle', () => {
    const h = { pushDateKeys: [TODAY] };
    expect(decide({ workoutDates: [daysAgoKey(3)] }, h)).toEqual({ send: false, key: 'M6', reason: 'contact_today' });
  });
});

describe('slot 16:30 a stropy', () => {
  const s = { signedUpAt: daysAgoAt10(2) };
  it('mimo pražskou 16. hodinu nic', () => {
    expect(decide(s, {}, new Date('2026-10-20T13:30:00Z'))).toEqual({ send: false, key: 'M3A', reason: 'outside_slot' });
    expect(decide(s, {}, new Date('2026-10-20T15:30:00Z'))).toEqual({ send: false, key: 'M3A', reason: 'outside_slot' });
  });
  it('1 kontakt za pražský den napříč kanály (push v notification_logs, contact_log, e-mail)', () => {
    expect(checkCaps('M3A', { ...EMPTY, pushDateKeys: [TODAY] }, NOW)).toBe('contact_today');
    expect(checkCaps('M3A', { ...EMPTY, contacts: [{ channel: 'push', sentAt: '2026-10-20T04:00:00Z' }] }, NOW)).toBe('contact_today');
    expect(checkCaps('M3A', { ...EMPTY, contacts: [{ channel: 'in_app', sentAt: '2026-10-19T23:00:00Z' }] }, NOW)).toBe('contact_today');
    // Včerejší push (pražské 19. 10.) nevadí
    expect(checkCaps('M3A', { ...EMPTY, contacts: [{ channel: 'push', sentAt: '2026-10-19T20:00:00Z' }], pushDateKeys: ['2026-10-19'] }, NOW)).toBe('ok');
  });
  it('e-mail nejvýš 1 za 48 h', () => {
    expect(checkCaps('M5', { ...EMPTY, emails: [sentRow('M4', hoursAgo(47))] }, NOW)).toBe('email_48h');
    expect(checkCaps('M5', { ...EMPTY, contacts: [{ channel: 'email', sentAt: hoursAgo(30) }] }, NOW)).toBe('email_48h');
    expect(checkCaps('M5', { ...EMPTY, emails: [sentRow('M4', hoursAgo(49))] }, NOW)).toBe('ok');
  });
  it('aktivace ≤ 3 e-maily / 7 dní, udržení ≤ 2', () => {
    const two = [sentRow('M2A', hoursAgo(150)), sentRow('M3A', hoursAgo(100))];
    expect(checkCaps('M5', { ...EMPTY, emails: two }, NOW)).toBe('ok');
    expect(checkCaps('M8', { ...EMPTY, emails: two }, NOW)).toBe('email_7d_cap');
    const three = [...two, sentRow('M4', hoursAgo(60))];
    expect(checkCaps('M5', { ...EMPTY, emails: three }, NOW)).toBe('email_7d_cap');
    // Neodeslané (failed) se do stropů nepočítají
    expect(checkCaps('M8', { ...EMPTY, emails: two.map((e) => ({ ...e, status: 'failed' })) }, NOW)).toBe('ok');
  });
});

describe('kanál a personalizace', () => {
  it('bez push tokenu má přednost', () => {
    const list = [{ hasDeviceToken: true, id: 1 }, { hasDeviceToken: false, id: 2 }].sort(byChannelPreference);
    expect(list.map((x) => x.id)).toEqual([2, 1]);
  });
  it('česká pluralizace tréninků', () => {
    expect(workoutsLine('cs', 1)).toBe('1 trénink');
    expect(workoutsLine('cs', 3)).toBe('3 tréninky');
    expect(workoutsLine('cs', 5)).toBe('5 tréninků');
    expect(workoutsLine('en', 2)).toBe('2 workouts');
  });
  it('proměnné nikdy neobsahují zdravotní ani tělesné údaje', () => {
    const facts = { ...base, workoutDates: [daysAgoKey(22)], selectedGymName: 'Eurogym', injuries: ['knee'], weight_kg: 80, age: 30 } as never;
    for (const key of MARKETING_KEYS) {
      const vars = marketingVars(key, 'cs', facts, NOW);
      const all = JSON.stringify(vars);
      expect(all).not.toMatch(/knee|80|30 let|váh|zranění/);
    }
  });
  it('render obchodního mailu: Obchodní sdělení v patičce, prázdná věta nenechá prázdný odstavec', () => {
    const tpl: TemplateRow = {
      key: 'M4', version: 1, locale: 'cs', status: 'approved', kind: 'marketing',
      subject: 'První trénink', preheader: null,
      html: '<p>{{greeting}}</p><p style="x">{{next_day_line}}</p><p>{{gym_name}}</p>',
      text: '{{greeting}}\n\n{{next_day_line}}\n\n{{gym_name}}',
    };
    const out = renderEmail({
      template: tpl, locale: 'cs', firstName: 'Jana', currentStep: null, ctaUrl: 'https://app.pumplo.com/',
      unsubscribeUrl: 'https://app.pumplo.com/odhlasit?u=1&t=2',
      extraVars: marketingVars('M4', 'cs', { workoutDates: [], planTrainingDays: null, trainingDays: null, selectedGymName: '<b>Gym</b>' }, NOW),
    });
    expect(out.html).toContain('Obchodní sdělení');
    expect(out.html).not.toMatch(/<p style="x">\s*<\/p>/);
    expect(out.html).toContain('&lt;b&gt;Gym&lt;/b&gt;');
    expect(out.text).not.toMatch(/\n{3,}/);
    expect(out.text).toContain('Obchodní sdělení');
  });
});
