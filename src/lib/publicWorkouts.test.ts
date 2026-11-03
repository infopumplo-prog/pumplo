import { describe, expect, it, vi } from 'vitest';

// rpc čte this jako skutečný supabase-js klient — odpojené volání musí spadnout.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    bound: true,
    rpc(this: { bound?: boolean }, name: string) {
      if (!this?.bound) throw new TypeError('rpc called without client');
      return Promise.resolve({ data: name === 'my_active_trainer_id' ? 'trainer-1' : [], error: null });
    },
  },
}));

import { DESCRIPTION_MAX, fetchMyTrainerId, fetchPublicWorkouts, normalizeSearch, toggleLikeLocal, validatePublish, type PublicWorkout, type PublishMeta } from './publicWorkouts';

const meta = (over: Partial<PublishMeta> = {}): PublishMeta => ({
  description: 'Silový trénink na 3 dny',
  goal: 'strength',
  level: 'beginner',
  focus: 'full_body',
  ...over,
});

describe('validatePublish', () => {
  it('accepts a plan with exercises and valid meta', () => {
    expect(validatePublish(meta(), 5)).toBeNull();
  });

  it('accepts empty optional meta', () => {
    expect(validatePublish(meta({ description: '', goal: null, level: null, focus: null }), 1)).toBeNull();
  });

  it('rejects a plan without exercises', () => {
    expect(validatePublish(meta(), 0)).toBe('empty_plan');
  });

  it('rejects too long description but allows exactly the limit', () => {
    expect(validatePublish(meta({ description: 'x'.repeat(DESCRIPTION_MAX) }), 1)).toBeNull();
    expect(validatePublish(meta({ description: 'x'.repeat(DESCRIPTION_MAX + 1) }), 1)).toBe('description_too_long');
  });

  it('rejects unknown goal and level', () => {
    expect(validatePublish(meta({ goal: 'yoga' as never }), 1)).toBe('invalid_goal');
    expect(validatePublish(meta({ level: 'pro' as never }), 1)).toBe('invalid_level');
  });
});

describe('normalizeSearch', () => {
  it('trims and turns empty into null', () => {
    expect(normalizeSearch('  ')).toBeNull();
    expect(normalizeSearch(undefined)).toBeNull();
    expect(normalizeSearch('  nohy ')).toBe('nohy');
  });

  it('caps length at 60 chars', () => {
    expect(normalizeSearch('a'.repeat(80))).toHaveLength(60);
  });
});

describe('validatePublish focus', () => {
  it('rejects unknown body-part focus', () => {
    expect(validatePublish(meta({ focus: 'neck' as never }), 1)).toBe('invalid_focus');
    expect(validatePublish(meta({ focus: 'glutes' }), 1)).toBeNull();
  });
});

describe('toggleLikeLocal', () => {
  const w = { liked_by_me: false, like_count: 3 } as PublicWorkout;

  it('likes and unlikes with matching count', () => {
    const liked = toggleLikeLocal(w);
    expect(liked).toMatchObject({ liked_by_me: true, like_count: 4 });
    expect(toggleLikeLocal(liked)).toMatchObject({ liked_by_me: false, like_count: 3 });
  });

  it('never goes below zero', () => {
    expect(toggleLikeLocal({ liked_by_me: true, like_count: 0 } as PublicWorkout).like_count).toBe(0);
  });
});

describe('rpc calls stay bound to the supabase client', () => {
  it('fetchPublicWorkouts resolves instead of throwing', async () => {
    await expect(fetchPublicWorkouts({})).resolves.toEqual([]);
  });

  it('fetchMyTrainerId returns the trainer id', async () => {
    await expect(fetchMyTrainerId()).resolves.toBe('trainer-1');
  });
});

describe('cover images', () => {
  it('uses trainer cover when present', async () => {
    const { coverFor } = await import('./publicWorkouts');
    expect(coverFor({ cover_url: 'https://x/y.jpg', focus: 'glutes' })).toBe('https://x/y.jpg');
  });

  it('falls back to body-part image, then full body', async () => {
    const { coverFor } = await import('./publicWorkouts');
    expect(coverFor({ cover_url: null, focus: 'glutes' })).toBe('/img/workouts/focus-glutes.jpg');
    expect(coverFor({ cover_url: null, focus: null })).toBe('/img/workouts/focus-full_body.jpg');
    expect(coverFor({ cover_url: '', focus: 'nonsense' })).toBe('/img/workouts/focus-full_body.jpg');
  });
});

describe('searchToFocus', () => {
  it('maps Czech body-part words to focus, ignoring case and diacritics', async () => {
    const { searchToFocus } = await import('./publicWorkouts');
    expect(searchToFocus('Zadek')).toBe('glutes');
    expect(searchToFocus('  hýždě ')).toBe('glutes');
    expect(searchToFocus('Prsa')).toBe('chest');
    expect(searchToFocus('záda')).toBe('back');
    expect(searchToFocus('břicho')).toBe('core');
  });

  it('leaves normal searches alone', async () => {
    const { searchToFocus } = await import('./publicWorkouts');
    expect(searchToFocus('Jarmila')).toBeNull();
    expect(searchToFocus('5x5')).toBeNull();
    expect(searchToFocus('')).toBeNull();
  });
});

describe('localizedText', () => {
  it('uses English when the app is in English and translation exists', async () => {
    const { localizedText } = await import('./publicWorkouts');
    expect(localizedText('Super booty', 'Super Booty', 'en')).toBe('Super Booty');
    expect(localizedText('Silový základ', 'Strength Base', 'en-US')).toBe('Strength Base');
  });

  it('falls back to original text and keeps Czech for cs', async () => {
    const { localizedText } = await import('./publicWorkouts');
    expect(localizedText('Silový základ', null, 'en')).toBe('Silový základ');
    expect(localizedText('Silový základ', '  ', 'en')).toBe('Silový základ');
    expect(localizedText('Silový základ', 'Strength Base', 'cs')).toBe('Silový základ');
  });
});

describe('cardio focus', () => {
  it('is a valid body part and searchable', async () => {
    const { WORKOUT_FOCUSES, searchToFocus } = await import('./publicWorkouts');
    expect(WORKOUT_FOCUSES).toContain('cardio');
    expect(searchToFocus('Kardio')).toBe('cardio');
  });
});

describe('secondary focuses', () => {
  it('rejects primary duplicated in secondary and unknown values', async () => {
    const { validatePublish } = await import('./publicWorkouts');
    const base = { description: '', goal: null, level: null, focus: 'chest' as const };
    expect(validatePublish({ ...base, secondary_focuses: ['arms', 'shoulders'] }, 1)).toBeNull();
    expect(validatePublish({ ...base, secondary_focuses: ['chest'] }, 1)).toBe('invalid_focus');
    expect(validatePublish({ ...base, secondary_focuses: ['neck' as never] }, 1)).toBe('invalid_focus');
  });

  it('toggles secondary, keeps catalog order, ignores primary', async () => {
    const { toggleSecondaryFocus } = await import('./publicWorkouts');
    expect(toggleSecondaryFocus([], 'arms', 'chest')).toEqual(['arms']);
    expect(toggleSecondaryFocus(['arms'], 'back', 'chest')).toEqual(['back', 'arms']);
    expect(toggleSecondaryFocus(['back', 'arms'], 'arms', 'chest')).toEqual(['back']);
    expect(toggleSecondaryFocus(['back'], 'chest', 'chest')).toEqual(['back']);
  });
});
