import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    bound: true,
    rpc(this: { bound?: boolean }) {
      if (!this?.bound) throw new TypeError('rpc called without client');
      return Promise.resolve({ data: { exercises_with_video: 254, gyms: 3, members: 124, trainer_workouts: 2, goal_share: { fat_loss: '0.379' } }, error: null });
    },
  },
}));

import { fetchSocialProof, floorPlus, sharePercent } from './socialProof';

describe('floorPlus never inflates', () => {
  it('rounds down to a round number with plus', () => {
    expect(floorPlus(254)).toBe('250+');
    expect(floorPlus(47)).toBe('40+');
    expect(floorPlus(7)).toBe('7');
    expect(floorPlus(250)).toBe('250');
    expect(floorPlus(1234, 'en')).toBe('1,200+');
  });

  it('never returns more than the real value', () => {
    for (let n = 0; n < 3000; n += 7) {
      const shown = Number(floorPlus(n, 'en').replace(/[+,]/g, ''));
      expect(shown).toBeLessThanOrEqual(n);
    }
  });

  it('handles bad input', () => {
    expect(floorPlus(-5)).toBe('0');
    expect(floorPlus(Number.NaN)).toBe('0');
  });
});

describe('sharePercent', () => {
  it('floors the share', () => {
    expect(sharePercent(0.379)).toBe(37);
    expect(sharePercent(undefined)).toBeNull();
    expect(sharePercent(0)).toBeNull();
  });
});

describe('fetchSocialProof', () => {
  it('parses the RPC result and stays bound to the client', async () => {
    await expect(fetchSocialProof()).resolves.toEqual({ exercisesWithVideo: 254, gyms: 3, members: 124, trainerWorkouts: 2, goalShare: { fat_loss: 0.379 } });
  });
});
