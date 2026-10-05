import { describe, it, expect, vi } from 'vitest';
import type { AppConsent } from './appConsent';
import {
  createAnalyticsCore, sanitizeParams, screenNameFromPath, newOAuthSignupMethod, MAX_PENDING, type PendingEvent,
} from './appAnalyticsCore';

const setup = (consent: AppConsent | null, metaReady = true) => {
  let current = consent;
  let pending: PendingEvent[] = [];
  const firebaseLog = vi.fn();
  const metaLog = vi.fn();
  const core = createAnalyticsCore({
    getConsent: () => current,
    isMetaReady: () => metaReady,
    firebaseLog,
    metaLog,
    loadPending: () => pending,
    savePending: (list) => { pending = list; },
  });
  return { core, firebaseLog, metaLog, getPending: () => pending, setConsent: (c: AppConsent | null) => { current = c; } };
};

describe('consent gating', () => {
  it('sends nothing when everything was rejected', () => {
    const t = setup({ analytics: false, marketing: false });
    t.core.track('sign_up', { method: 'email' });
    t.core.track('workout_complete');
    expect(t.firebaseLog).not.toHaveBeenCalled();
    expect(t.metaLog).not.toHaveBeenCalled();
    expect(t.getPending()).toEqual([]);
  });

  it('analytics only → Firebase, never Meta', () => {
    const t = setup({ analytics: true, marketing: false });
    t.core.track('sign_up', { method: 'google' });
    expect(t.firebaseLog).toHaveBeenCalledWith('sign_up', { method: 'google' });
    expect(t.metaLog).not.toHaveBeenCalled();
  });

  it('marketing only → Meta mapped events, never Firebase', () => {
    const t = setup({ analytics: false, marketing: true });
    t.core.track('sign_up', { method: 'apple' });
    t.core.track('select_gym', { gym_id: 'g1' });
    expect(t.firebaseLog).not.toHaveBeenCalled();
    expect(t.metaLog).toHaveBeenCalledTimes(1);
    expect(t.metaLog).toHaveBeenCalledWith('fb_mobile_complete_registration', { method: 'apple' });
  });

  it('Meta waits for readiness (config / ATT)', () => {
    const t = setup({ analytics: true, marketing: true }, false);
    t.core.track('first_workout');
    expect(t.firebaseLog).toHaveBeenCalledWith('first_workout', {});
    expect(t.metaLog).not.toHaveBeenCalled();
  });

  it('maps custom Meta events', () => {
    const t = setup({ analytics: true, marketing: true });
    t.core.track('tutorial_complete');
    t.core.track('workout_complete', { is_bonus: false });
    t.core.track('first_workout');
    expect(t.metaLog.mock.calls.map((c) => c[0])).toEqual(['TutorialComplete', 'WorkoutComplete', 'FirstWorkout']);
  });

  it('a throwing sink never breaks the app', () => {
    const core = createAnalyticsCore({
      getConsent: () => ({ analytics: true, marketing: true }),
      isMetaReady: () => true,
      firebaseLog: () => { throw new Error('native'); },
      metaLog: () => Promise.reject(new Error('native')),
      loadPending: () => [], savePending: () => {},
    });
    expect(() => core.track('sign_up', { method: 'email' })).not.toThrow();
  });
});

describe('undecided → pending queue', () => {
  it('holds events locally, sends nothing', () => {
    const t = setup(null);
    t.core.track('sign_up', { method: 'email' });
    t.core.track('tutorial_complete');
    expect(t.firebaseLog).not.toHaveBeenCalled();
    expect(t.metaLog).not.toHaveBeenCalled();
    expect(t.getPending().map((e) => e.name)).toEqual(['sign_up', 'tutorial_complete']);
  });

  it('flushes on accept', () => {
    const t = setup(null);
    t.core.track('sign_up', { method: 'email' });
    t.setConsent({ analytics: true, marketing: false });
    t.core.flushPending();
    expect(t.firebaseLog).toHaveBeenCalledWith('sign_up', { method: 'email' });
    expect(t.getPending()).toEqual([]);
  });

  it('drops on reject', () => {
    const t = setup(null);
    t.core.track('sign_up', { method: 'email' });
    t.setConsent({ analytics: false, marketing: false });
    t.core.flushPending();
    expect(t.firebaseLog).not.toHaveBeenCalled();
    expect(t.getPending()).toEqual([]);
  });

  it('screen views are not queued', () => {
    const t = setup(null);
    t.core.track('screen_view', { screen_name: '/' });
    expect(t.getPending()).toEqual([]);
  });

  it(`keeps at most ${MAX_PENDING} events`, () => {
    const t = setup(null);
    for (let i = 0; i < MAX_PENDING + 5; i++) t.core.track('workout_start');
    expect(t.getPending()).toHaveLength(MAX_PENDING);
  });
});

describe('no personal data', () => {
  it('drops params outside the event whitelist', () => {
    expect(sanitizeParams('sign_up', { method: 'email', email: 'a@b.cz', name: 'Jan' })).toEqual({ method: 'email' });
    expect(sanitizeParams('workout_complete', { is_bonus: true, weight_kg: 80, injuries: 'knee' })).toEqual({ is_bonus: true });
    expect(sanitizeParams('tutorial_complete', { age: 30, height_cm: 180 })).toEqual({});
  });
  it('drops non-primitive values and caps string length', () => {
    expect(sanitizeParams('select_gym', { gym_id: { nested: 1 } as unknown as string })).toEqual({});
    expect((sanitizeParams('app_open_deeplink', { path: 'x'.repeat(300) }).path as string).length).toBe(100);
  });
  it('the core sanitises before any sink sees params', () => {
    const t = setup({ analytics: true, marketing: true });
    t.core.track('sign_up', { method: 'email', email: 'a@b.cz' });
    expect(t.firebaseLog).toHaveBeenCalledWith('sign_up', { method: 'email' });
    expect(t.metaLog).toHaveBeenCalledWith('fb_mobile_complete_registration', { method: 'email' });
  });
});

describe('screenNameFromPath', () => {
  it('keeps static routes', () => {
    expect(screenNameFromPath('/')).toBe('/');
    expect(screenNameFromPath('/profile/history')).toBe('/profile/history');
  });
  it('replaces ids and tokens', () => {
    expect(screenNameFromPath('/plan/abcDEF123token')).toBe('/plan/:id');
    expect(screenNameFromPath('/cvik/5')).toBe('/cvik/:id');
    expect(screenNameFromPath('/messages/chat/0b9e4a52-1111-4222-8333-944455556666')).toBe('/messages/chat/:id');
    expect(screenNameFromPath('/custom-workout/xyz')).toBe('/custom-workout/:id');
    expect(screenNameFromPath('/s/AB12')).toBe('/s/:id');
  });
  it('drops query and hash', () => expect(screenNameFromPath('/auth?gym=1#x')).toBe('/auth'));
});

describe('newOAuthSignupMethod', () => {
  const at = '2026-10-05T10:00:00.000Z';
  it('new Google / Apple account', () => {
    expect(newOAuthSignupMethod({ app_metadata: { provider: 'google' }, created_at: at, last_sign_in_at: '2026-10-05T10:00:03.000Z' })).toBe('google');
    expect(newOAuthSignupMethod({ app_metadata: { provider: 'apple' }, created_at: at, last_sign_in_at: at })).toBe('apple');
  });
  it('returning OAuth user is not a sign-up', () =>
    expect(newOAuthSignupMethod({ app_metadata: { provider: 'google' }, created_at: at, last_sign_in_at: '2026-10-06T10:00:00.000Z' })).toBeNull());
  it('e-mail accounts are tracked in Auth.tsx, not here', () =>
    expect(newOAuthSignupMethod({ app_metadata: { provider: 'email' }, created_at: at, last_sign_in_at: at })).toBeNull());
  it('missing timestamps', () =>
    expect(newOAuthSignupMethod({ app_metadata: { provider: 'google' }, created_at: at })).toBeNull());
});
