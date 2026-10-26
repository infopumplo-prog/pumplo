import { describe, expect, it } from 'vitest';
import {
  NOTE_MAX_LENGTH,
  assignmentEndDate,
  buildFeedbackUpdate,
  findLiveAssignmentForPlan,
  isAssignmentLive,
  isTrainerAssignedPlan,
  isValidDifficulty,
  noteLength,
  progressPercent,
  sanitizeNote,
  toLocalIsoDate,
  type TrainerAssignment,
} from './trainerClient';

const base: TrainerAssignment = {
  id: 'a1',
  trainer_client_id: 'l1',
  trainer_user_id: 't1',
  plan_id: 'p1',
  plan_name: 'Síla',
  start_date: '2026-10-05',
  weeks: 4,
  sessions_per_week: 3,
  ended_at: null,
};

describe('assignmentEndDate', () => {
  it('adds weeks × 7 days', () => {
    expect(assignmentEndDate('2026-10-05', 4)).toBe('2026-11-02');
    expect(assignmentEndDate('2026-12-28', 1)).toBe('2027-01-04');
    expect(assignmentEndDate('2028-02-22', 1)).toBe('2028-02-29');
  });
  it('is not shifted by DST (CZ switches 25. 10. 2026)', () => {
    expect(assignmentEndDate('2026-10-19', 1)).toBe('2026-10-26');
    expect(assignmentEndDate('2026-03-23', 1)).toBe('2026-03-30');
  });
  it('rejects invalid input', () => {
    expect(assignmentEndDate('5.10.2026', 4)).toBeNull();
    expect(assignmentEndDate('', 4)).toBeNull();
    expect(assignmentEndDate('2026-10-05', Number.NaN)).toBeNull();
    expect(assignmentEndDate('2026-10-05', -1)).toBeNull();
  });
});

describe('toLocalIsoDate', () => {
  it('formats local date with padding', () => {
    expect(toLocalIsoDate(new Date(2026, 0, 3, 23, 59))).toBe('2026-01-03');
  });
});

describe('isAssignmentLive / isTrainerAssignedPlan', () => {
  it('live between (and before) start and end, not on/after the end date', () => {
    expect(isAssignmentLive(base, '2026-10-01')).toBe(true); // budoucí start
    expect(isAssignmentLive(base, '2026-10-05')).toBe(true);
    expect(isAssignmentLive(base, '2026-11-01')).toBe(true);
    expect(isAssignmentLive(base, '2026-11-02')).toBe(false);
  });
  it('ended or plan deleted = not live', () => {
    expect(isAssignmentLive({ ...base, ended_at: '2026-10-10T10:00:00Z' }, '2026-10-12')).toBe(false);
    expect(isAssignmentLive({ ...base, plan_id: null }, '2026-10-12')).toBe(false);
  });
  it('matches by plan id only', () => {
    expect(isTrainerAssignedPlan('p1', [base], '2026-10-12')).toBe(true);
    expect(isTrainerAssignedPlan('p2', [base], '2026-10-12')).toBe(false);
    expect(isTrainerAssignedPlan(null, [base], '2026-10-12')).toBe(false);
    expect(isTrainerAssignedPlan('p1', [], '2026-10-12')).toBe(false);
    expect(isTrainerAssignedPlan('p1', undefined, '2026-10-12')).toBe(false);
  });
  it('picks the latest-starting live assignment for a plan', () => {
    const older = { ...base, id: 'old', start_date: '2026-10-01' };
    const newer = { ...base, id: 'new', start_date: '2026-10-08' };
    const ended = { ...base, id: 'ended', start_date: '2026-10-10', ended_at: '2026-10-11T00:00:00Z' };
    expect(findLiveAssignmentForPlan('p1', [older, ended, newer], '2026-10-12')?.id).toBe('new');
  });
});

describe('difficulty', () => {
  it('accepts integers 1–5 only', () => {
    for (const v of [1, 2, 3, 4, 5]) expect(isValidDifficulty(v)).toBe(true);
    for (const v of [0, 6, 2.5, -1, '3', null, undefined, Number.NaN]) expect(isValidDifficulty(v)).toBe(false);
  });
});

describe('sanitizeNote', () => {
  it('trims, normalizes newlines and strips control chars', () => {
    expect(sanitizeNote('  Bolelo koleno\r\nale ok  ')).toBe('Bolelo koleno\nale ok');
    expect(sanitizeNote('a\u0000b\u0007c')).toBe('abc');
    expect(sanitizeNote('tab\tstays')).toBe('tab\tstays');
  });
  it('empty → null', () => {
    expect(sanitizeNote('   \n ')).toBeNull();
    expect(sanitizeNote('')).toBeNull();
    expect(sanitizeNote(null)).toBeNull();
    expect(sanitizeNote(undefined)).toBeNull();
  });
  it('caps at 1000 characters counted like Postgres char_length', () => {
    const long = 'ž'.repeat(1200);
    expect(noteLength(sanitizeNote(long)!)).toBe(NOTE_MAX_LENGTH);
    const emoji = '💪'.repeat(1001); // 2 UTF-16 jednotky na znak
    const out = sanitizeNote(emoji)!;
    expect(noteLength(out)).toBe(NOTE_MAX_LENGTH);
    expect(out.length).toBe(2 * NOTE_MAX_LENGTH);
  });
});

describe('buildFeedbackUpdate', () => {
  it('builds the update and skips empty feedback', () => {
    expect(buildFeedbackUpdate(4, ' super ')).toEqual({ client_difficulty: 4, client_note: 'super' });
    expect(buildFeedbackUpdate(3, '')).toEqual({ client_difficulty: 3, client_note: null });
    expect(buildFeedbackUpdate(null, 'jen poznámka')).toEqual({ client_difficulty: null, client_note: 'jen poznámka' });
    expect(buildFeedbackUpdate(9, 'x')).toEqual({ client_difficulty: null, client_note: 'x' });
    expect(buildFeedbackUpdate(null, '  ')).toBeNull();
    expect(buildFeedbackUpdate(undefined, undefined)).toBeNull();
  });
});

describe('progressPercent', () => {
  it('clamps to 0–100', () => {
    expect(progressPercent(3, 12)).toBe(25);
    expect(progressPercent(20, 12)).toBe(100);
    expect(progressPercent(1, 0)).toBe(0);
    expect(progressPercent(-1, 10)).toBe(0);
  });
});
