import { describe, expect, it } from 'vitest';
import {
  DEMO_GYM_ID,
  PUMPLO_GYM_ID,
  TRAINERS_INJURY_INTRO_ROUTE,
  filterVisibleTrainers,
  hasRealInjuries,
  instagramUrl,
  shouldRouteToTrainers,
  sortTrainers,
} from './trainersDirectory';
import { routeAfterRegistration } from './onboardingFlow';

const row = (id: string, gym_id: string, over: Partial<{ status: string; is_active: boolean; sort_order: number; name: string }> = {}) => ({
  id,
  gym_id,
  name: over.name ?? id,
  status: over.status ?? 'approved',
  is_active: over.is_active ?? true,
  sort_order: over.sort_order ?? 0,
});

describe('shouldRouteToTrainers', () => {
  it('routes only for real injuries', () => {
    expect(shouldRouteToTrainers(['knees'])).toBe(true);
    expect(shouldRouteToTrainers(['knees', 'shoulders'])).toBe(true);
    expect(shouldRouteToTrainers(['none'])).toBe(false);
    expect(shouldRouteToTrainers([])).toBe(false);
    expect(shouldRouteToTrainers(null)).toBe(false);
    expect(hasRealInjuries(undefined)).toBe(false);
  });

  it('routeAfterRegistration sends injured users to trainers, keeps plan choice otherwise', () => {
    expect(routeAfterRegistration('pumplo', null, ['knees'])).toBe(TRAINERS_INJURY_INTRO_ROUTE);
    expect(routeAfterRegistration('own', 'abc', ['lower_back'])).toBe(TRAINERS_INJURY_INTRO_ROUTE);
    expect(routeAfterRegistration('trainer', null, ['none'])).toBe('/workouts');
    expect(routeAfterRegistration('own', 'abc', [])).toBe('/custom-plan/abc');
    expect(routeAfterRegistration('pumplo')).toBe('/');
  });
});

describe('trainer directory', () => {
  it('hides unapproved, inactive and demo trainers for non-admins', () => {
    const rows = [
      row('a', 'g1'),
      row('b', 'g1', { status: 'pending' }),
      row('c', 'g1', { is_active: false }),
      row('d', DEMO_GYM_ID),
    ];
    expect(filterVisibleTrainers(rows, false).map((r) => r.id)).toEqual(['a']);
    expect(filterVisibleTrainers(rows, true).map((r) => r.id)).toEqual(['a', 'd']);
  });

  it('orders own gym first, then Pumplo, then others, demo last', () => {
    const rows = [
      row('other', 'g2'),
      row('demo', DEMO_GYM_ID),
      row('pumplo', PUMPLO_GYM_ID),
      row('mine2', 'mine', { sort_order: 2 }),
      row('mine1', 'mine', { sort_order: 1 }),
    ];
    expect(sortTrainers(rows, 'mine').map((r) => r.id)).toEqual(['mine1', 'mine2', 'pumplo', 'other', 'demo']);
    // Bez vybrané posilovny začíná Pumplo.
    expect(sortTrainers(rows, null).map((r) => r.id)[0]).toBe('pumplo');
  });

  it('groups other gyms alphabetically by gym name', () => {
    const rows = [row('z', 'gz'), row('a', 'ga')];
    expect(sortTrainers(rows, null, { gz: 'Zeta Gym', ga: 'Alfa Gym' }).map((r) => r.id)).toEqual(['a', 'z']);
  });

  it('normalises instagram handles and urls', () => {
    expect(instagramUrl('@jarmilafit')).toBe('https://instagram.com/jarmilafit');
    expect(instagramUrl('jarmilafit')).toBe('https://instagram.com/jarmilafit');
    expect(instagramUrl('https://instagram.com/x?y=1')).toBe('https://instagram.com/x?y=1');
  });
});
