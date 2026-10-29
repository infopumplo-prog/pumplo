import { describe, expect, it } from 'vitest';
import {
  answersToDraft,
  canEditCheckin,
  checkinDraftKey,
  checkinDueDate,
  checkinPhotoPath,
  checkinWeekStart,
  extractWeightKg,
  hasCheckinConfigured,
  isCheckinDue,
  maxPhotos,
  normalizeAnswers,
  parseDraft,
  parseFormFields,
  pickWeeklyPrompt,
  scaleRange,
  validateAnswers,
  type CheckinField,
} from './trainerCheckin';

// 2026-10-26 = pondělí, 2026-11-01 = neděle (po přechodu na zimní čas, Praha = UTC+1)
const thu = new Date('2026-10-29T10:00:00Z');

const FIELDS: CheckinField[] = [
  { id: 'w', type: 'weight', label: 'Váha', required: true },
  { id: 'waist', type: 'number', label: 'Pas', unit: 'cm', min: 40, max: 200 },
  { id: 'sleep', type: 'scale', label: 'Spánek', min: 1, max: 5, required: true },
  { id: 'note', type: 'text', label: 'Poznámka' },
  { id: 'diet', type: 'choice', label: 'Strava', options: ['Dobře', 'Špatně'], required: true },
  { id: 'pics', type: 'photos', label: 'Fotky', required: true, max_photos: 3 },
];

describe('week_start (Europe/Prague)', () => {
  it('Thursday → Monday of the same week', () => {
    expect(checkinWeekStart(thu)).toBe('2026-10-26');
  });
  it('Sunday 23:30 UTC is already Monday in Prague', () => {
    expect(checkinWeekStart(new Date('2026-11-01T23:30:00Z'))).toBe('2026-11-02');
  });
  it('Sunday 22:30 UTC is still Sunday in Prague', () => {
    expect(checkinWeekStart(new Date('2026-11-01T22:30:00Z'))).toBe('2026-10-26');
  });
  it('summer time: Sunday 22:30 UTC is Monday 00:30 CEST', () => {
    expect(checkinWeekStart(new Date('2026-07-05T22:30:00Z'))).toBe('2026-07-06');
  });
});

describe('due logic', () => {
  const cfg = { checkin_form_id: 'f1', checkin_weekday: 4 }; // čtvrtek
  it('not configured without form or weekday (no migration = undefined)', () => {
    expect(hasCheckinConfigured({})).toBe(false);
    expect(hasCheckinConfigured({ checkin_form_id: 'f1', checkin_weekday: null })).toBe(false);
    expect(hasCheckinConfigured({ checkin_form_id: 'f1', checkin_weekday: 8 })).toBe(false);
    expect(isCheckinDue({}, thu, [])).toBe(false);
  });
  it('due on the weekday and after it, not before', () => {
    expect(isCheckinDue(cfg, thu, [])).toBe(true);
    expect(isCheckinDue(cfg, new Date('2026-10-31T10:00:00Z'), [])).toBe(true); // sobota
    expect(isCheckinDue(cfg, new Date('2026-10-28T10:00:00Z'), [])).toBe(false); // středa
  });
  it('weekday boundary uses Prague time', () => {
    // středa 23:30 UTC = čtvrtek 0:30 Praha
    expect(isCheckinDue(cfg, new Date('2026-10-28T23:30:00Z'), [])).toBe(true);
    expect(isCheckinDue(cfg, new Date('2026-10-28T22:30:00Z'), [])).toBe(false);
  });
  it('not due once this week is submitted; due again next week', () => {
    expect(isCheckinDue(cfg, thu, ['2026-10-26'])).toBe(false);
    expect(isCheckinDue(cfg, new Date('2026-11-05T10:00:00Z'), ['2026-10-26'])).toBe(true);
  });
  it('Sunday weekday', () => {
    const sun = { checkin_form_id: 'f1', checkin_weekday: 7 };
    expect(isCheckinDue(sun, thu, [])).toBe(false);
    expect(isCheckinDue(sun, new Date('2026-11-01T12:00:00Z'), [])).toBe(true);
  });
  it('due date', () => {
    expect(checkinDueDate(thu, 1)).toBe('2026-10-26');
    expect(checkinDueDate(thu, 7)).toBe('2026-11-01');
  });
  it('edit only until next Monday', () => {
    expect(canEditCheckin('2026-10-26', new Date('2026-11-01T22:30:00Z'))).toBe(true);
    expect(canEditCheckin('2026-10-26', new Date('2026-11-01T23:30:00Z'))).toBe(false);
  });
});

describe('which prompt wins', () => {
  it('trainer check-in beats the personal one', () => {
    expect(pickWeeklyPrompt({ trainerCheckinDue: true, personalCheckinDue: true })).toBe('trainer');
    expect(pickWeeklyPrompt({ trainerCheckinDue: true, personalCheckinDue: false })).toBe('trainer');
    expect(pickWeeklyPrompt({ trainerCheckinDue: false, personalCheckinDue: true })).toBe('personal');
    expect(pickWeeklyPrompt({ trainerCheckinDue: false, personalCheckinDue: false })).toBeNull();
  });
});

describe('parseFormFields', () => {
  it('drops junk, unknown types, duplicates and choice without options', () => {
    const parsed = parseFormFields([
      { id: 'a', type: 'number', label: 'A', min: 1, max: 'x' },
      { id: 'a', type: 'text', label: 'dup' },
      { type: 'text', label: 'no id' },
      { id: 'b', type: 'video', label: 'B' },
      { id: 'c', type: 'choice', label: 'C', options: [] },
      { id: 'd', type: 'choice', label: 'D', options: ['x', 'x', '', 'y'] },
      null,
    ]);
    expect(parsed.map((f) => f.id)).toEqual(['a', 'd']);
    expect(parsed[0]).toEqual({ id: 'a', type: 'number', label: 'A', min: 1, required: false });
    expect(parsed[1].options).toEqual(['x', 'y']);
  });
  it('non-array → []', () => {
    expect(parseFormFields(null)).toEqual([]);
    expect(parseFormFields({})).toEqual([]);
  });
  it('scale defaults and caps', () => {
    expect(scaleRange({ id: 's', type: 'scale', label: '' })).toEqual({ min: 1, max: 5 });
    expect(scaleRange({ id: 's', type: 'scale', label: '', min: 0, max: 100 })).toEqual({ min: 0, max: 10 });
    expect(scaleRange({ id: 's', type: 'scale', label: '', min: 5, max: 1 })).toEqual({ min: 1, max: 5 });
  });
  it('max photos default and bounds', () => {
    expect(maxPhotos({ id: 'p', type: 'photos', label: '' })).toBe(4);
    expect(maxPhotos({ id: 'p', type: 'photos', label: '', max_photos: 50 })).toBe(10);
    expect(maxPhotos({ id: 'p', type: 'photos', label: '', max_photos: 0 })).toBe(1);
  });
});

describe('validateAnswers', () => {
  const valid = { w: '82,4', waist: '90', sleep: 4, note: '', diet: 'Dobře' };
  it('valid form passes', () => {
    expect(validateAnswers(FIELDS, valid, { pics: 2 })).toEqual({});
  });
  it('required per type', () => {
    expect(validateAnswers(FIELDS, {}, {})).toEqual({ w: 'required', sleep: 'required', diet: 'required', pics: 'required' });
    expect(validateAnswers(FIELDS, { ...valid, w: '   ' }, { pics: 1 })).toEqual({ w: 'required' });
  });
  it('weight range 25–400', () => {
    expect(validateAnswers(FIELDS, { ...valid, w: '12' }, { pics: 1 })).toEqual({ w: 'range' });
    expect(validateAnswers(FIELDS, { ...valid, w: 82.4 }, { pics: 1 })).toEqual({});
  });
  it('number min/max and garbage', () => {
    expect(validateAnswers(FIELDS, { ...valid, waist: '20' }, { pics: 1 })).toEqual({ waist: 'range' });
    expect(validateAnswers(FIELDS, { ...valid, waist: 'abc' }, { pics: 1 })).toEqual({ waist: 'invalid' });
    expect(validateAnswers(FIELDS, { ...valid, waist: '' }, { pics: 1 })).toEqual({}); // nepovinné
  });
  it('scale out of range / non-integer', () => {
    expect(validateAnswers(FIELDS, { ...valid, sleep: 6 }, { pics: 1 })).toEqual({ sleep: 'invalid' });
    expect(validateAnswers(FIELDS, { ...valid, sleep: 2.5 }, { pics: 1 })).toEqual({ sleep: 'invalid' });
  });
  it('choice must be one of options', () => {
    expect(validateAnswers(FIELDS, { ...valid, diet: 'Jinak' }, { pics: 1 })).toEqual({ diet: 'invalid' });
  });
  it('photos over the limit', () => {
    expect(validateAnswers(FIELDS, valid, { pics: 4 })).toEqual({ pics: 'too_many' });
  });
  it('text too long', () => {
    expect(validateAnswers(FIELDS, { ...valid, note: 'x'.repeat(2001) }, { pics: 1 })).toEqual({ note: 'too_many' });
  });
});

describe('answers ↔ JSON and weight', () => {
  it('normalizes numbers, drops blanks/photos/unknown keys', () => {
    const out = normalizeAnswers(FIELDS, { w: '82,44', waist: '90.5', sleep: 4, note: '  ok ', diet: 'Dobře', pics: 'x', bogus: 1 });
    expect(out).toEqual({ w: 82.4, waist: 90.5, sleep: 4, note: 'ok', diet: 'Dobře' });
    expect(normalizeAnswers(FIELDS, { note: '  ' })).toEqual({});
  });
  it('round-trips stored answers to draft', () => {
    expect(answersToDraft(FIELDS, { w: 82.4, waist: 90, sleep: 4, diet: 'Dobře', pics: ['a'] }))
      .toEqual({ w: '82,4', waist: '90', sleep: 4, diet: 'Dobře' });
    expect(answersToDraft(FIELDS, null)).toEqual({});
  });
  it('extracts weight from the first weight field', () => {
    expect(extractWeightKg(FIELDS, { w: '82,4' })).toBe(82.4);
    expect(extractWeightKg(FIELDS, { w: 82.4 })).toBe(82.4);
    expect(extractWeightKg(FIELDS, { w: '10' })).toBeNull();
    expect(extractWeightKg(FIELDS, {})).toBeNull();
    expect(extractWeightKg([{ id: 'n', type: 'number', label: '' }], { n: 80 })).toBeNull();
  });
});

describe('photo path and draft', () => {
  it('builds <uid>/<checkin>/<field>-<n>-<ts>.jpg with a safe field id', () => {
    expect(checkinPhotoPath({ clientUid: 'u1', checkinId: 'c1', fieldId: 'front', index: 2, ts: 123 })).toBe('u1/c1/front-2-123.jpg');
    expect(checkinPhotoPath({ clientUid: 'u1', checkinId: 'c1', fieldId: '../a b', index: 0, ts: 1 })).toBe('u1/c1/___a_b-0-1.jpg');
  });
  it('draft key and parse', () => {
    expect(checkinDraftKey('l1', '2026-10-26')).toBe('trainer_checkin_draft_l1_2026-10-26');
    expect(parseDraft('{"w":"82","sleep":3,"x":1,"note":{"a":1}}', FIELDS)).toEqual({ w: '82', sleep: 3 });
    expect(parseDraft('nope', FIELDS)).toBeNull();
    expect(parseDraft(null, FIELDS)).toBeNull();
  });
});
