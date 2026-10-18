// F1 e-maily (19. 10.): ranní push se nepošle, když dnes odešel e-mail (1 kontakt / den).
import { describe, it, expect } from 'vitest';
import {
  PUSH_KINDS_SKIPPED_AFTER_EMAIL,
  pragueDayStartIso,
  pragueOffsetMinutes,
  skipMorningPushForEmail,
  type MorningPushKind,
} from '../../supabase/functions/send-push-notifications/rules';

describe('skipMorningPushForEmail', () => {
  it('morning, missed i first_workout se po dnešním e-mailu vynechají', () => {
    for (const k of ['morning', 'missed', 'first_workout'] as MorningPushKind[]) {
      expect(skipMorningPushForEmail(k, true)).toBe(true);
    }
  });
  it('bez dnešního e-mailu se nic nemění (pozitivní kontrola)', () => {
    for (const k of ['morning', 'missed', 'first_workout', 'none'] as MorningPushKind[]) {
      expect(skipMorningPushForEmail(k, false)).toBe(false);
    }
  });
  it('none zůstává none', () => {
    expect(skipMorningPushForEmail('none', true)).toBe(false);
  });
  it('seznam vynechávaných typů je přesně ranní slot', () => {
    expect([...PUSH_KINDS_SKIPPED_AFTER_EMAIL].sort()).toEqual(['first_workout', 'missed', 'morning']);
  });
});

describe('pragueDayStartIso — začátek pražského dne v UTC', () => {
  it('letní čas (UTC+2)', () => {
    expect(pragueDayStartIso('2026-10-20')).toBe('2026-10-19T22:00:00.000Z');
    expect(pragueOffsetMinutes(new Date('2026-07-01T12:00:00Z'))).toBe(120);
  });
  it('zimní čas (UTC+1)', () => {
    expect(pragueDayStartIso('2026-12-01')).toBe('2026-11-30T23:00:00.000Z');
    expect(pragueOffsetMinutes(new Date('2026-12-01T12:00:00Z'))).toBe(60);
  });
  it('dny přechodu času', () => {
    // 25. 10. 2026 se v 3:00 SELČ přechází na SEČ — půlnoc je ještě letní.
    expect(pragueDayStartIso('2026-10-25')).toBe('2026-10-24T22:00:00.000Z');
    expect(pragueDayStartIso('2026-10-26')).toBe('2026-10-25T23:00:00.000Z');
    // 29. 3. 2026 se ve 2:00 přechází na SELČ — půlnoc je ještě zimní.
    expect(pragueDayStartIso('2026-03-29')).toBe('2026-03-28T23:00:00.000Z');
    expect(pragueDayStartIso('2026-03-30')).toBe('2026-03-29T22:00:00.000Z');
  });
});
