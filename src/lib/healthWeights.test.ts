import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import {
  AUTO_SYNC_INTERVAL_MS,
  availabilityFromResult,
  fallbackExternalId,
  healthSourceFor,
  isAutoSyncDue,
  mapHealthSamples,
  normalizeWeightKg,
  parseHealthState,
  SYNC_OVERLAP_MS,
  syncRange,
  toKg,
} from './healthWeights';

describe('toKg / normalizeWeightKg', () => {
  it('keeps kilograms and defaults to kg without unit', () => {
    expect(toKg(80.25, 'kilogram')).toBe(80.25);
    expect(toKg(80, 'kg')).toBe(80);
    expect(toKg(80)).toBe(80);
  });
  it('converts pounds and grams', () => {
    expect(normalizeWeightKg(176.37, 'lb')).toBe(80);
    expect(normalizeWeightKg(176.37, 'pound')).toBe(80);
    expect(normalizeWeightKg(80250, 'gram')).toBe(80.3);
  });
  it('rounds to one decimal', () => {
    expect(normalizeWeightKg(72.349, 'kilogram')).toBe(72.3);
    expect(normalizeWeightKg(72.35, 'kilogram')).toBe(72.4);
  });
  it('filters values outside 25–400 kg, NaN and unknown units', () => {
    expect(normalizeWeightKg(24.9, 'kg')).toBeNull();
    expect(normalizeWeightKg(25, 'kg')).toBe(25);
    expect(normalizeWeightKg(400, 'kg')).toBe(400);
    expect(normalizeWeightKg(400.1, 'kg')).toBeNull();
    expect(normalizeWeightKg(0, 'kg')).toBeNull();
    expect(normalizeWeightKg(-70, 'kg')).toBeNull();
    expect(normalizeWeightKg(Number.NaN, 'kg')).toBeNull();
    expect(normalizeWeightKg(Infinity, 'kg')).toBeNull();
    expect(normalizeWeightKg(80, 'stone')).toBeNull();
    expect(normalizeWeightKg(1000, 'lb')).toBeNull(); // 453.6 kg
  });
});

describe('fallbackExternalId', () => {
  it('is deterministic and depends on time and value', () => {
    const a = fallbackExternalId(1_700_000_000_000, 80.1);
    expect(a).toBe(fallbackExternalId(1_700_000_000_000, 80.1));
    expect(a).toMatch(/^h_[0-9a-f]{16}$/);
    expect(a).not.toBe(fallbackExternalId(1_700_000_000_001, 80.1));
    expect(a).not.toBe(fallbackExternalId(1_700_000_000_000, 80.2));
  });
});

describe('mapHealthSamples', () => {
  const t1 = '2026-10-20T06:30:00.000Z';
  const t2 = '2026-10-21T06:31:00.000Z';

  it('maps to upsert inputs with source and platform id, sorted ascending', () => {
    const out = mapHealthSamples([
      { value: 80.04, unit: 'kilogram', startDate: t2, platformId: 'B' },
      { value: 80.46, unit: 'kilogram', startDate: t1, platformId: 'A' },
    ], 'apple_health');
    expect(out).toEqual([
      { measuredAt: t1, weightKg: 80.5, source: 'apple_health', externalId: 'A' },
      { measuredAt: t2, weightKg: 80, source: 'apple_health', externalId: 'B' },
    ]);
  });

  it('uses hash fallback when the sample id is missing or blank', () => {
    const [e] = mapHealthSamples([{ value: 80, unit: 'kilogram', startDate: t1, platformId: '  ' }], 'health_connect');
    expect(e.externalId).toBe(fallbackExternalId(Date.parse(t1), 80));
    expect(e.source).toBe('health_connect');
  });

  it('dedupes by external id (last wins) incl. identical id-less samples', () => {
    const out = mapHealthSamples([
      { value: 80, unit: 'kilogram', startDate: t1, platformId: 'A' },
      { value: 81, unit: 'kilogram', startDate: t1, platformId: 'A' },
      { value: 79, unit: 'kilogram', startDate: t2 },
      { value: 79, unit: 'kilogram', startDate: t2 },
    ], 'health_connect');
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ externalId: 'A', weightKg: 81 });
  });

  it('drops invalid values and dates, converts lb', () => {
    const out = mapHealthSamples([
      { value: 10, unit: 'kilogram', startDate: t1, platformId: 'x' },
      { value: 80, unit: 'kilogram', startDate: 'not a date', platformId: 'y' },
      { value: 165.35, unit: 'lb', startDate: t2, platformId: 'z' },
      null as never,
    ], 'apple_health');
    expect(out).toEqual([{ measuredAt: t2, weightKg: 75, source: 'apple_health', externalId: 'z' }]);
  });

  it('handles empty / missing input', () => {
    expect(mapHealthSamples([], 'apple_health')).toEqual([]);
    expect(mapHealthSamples(undefined as never, 'apple_health')).toEqual([]);
  });
});

describe('syncRange', () => {
  const now = new Date('2026-10-29T12:00:00.000Z');

  it('first import reads the last 90 days', () => {
    const r = syncRange(null, now);
    expect(r.endDate).toBe(now.toISOString());
    expect(r.startDate).toBe('2026-07-31T12:00:00.000Z');
  });

  it('later imports read from last sync minus overlap', () => {
    const last = '2026-10-28T08:00:00.000Z';
    expect(syncRange(last, now).startDate).toBe(new Date(Date.parse(last) - SYNC_OVERLAP_MS).toISOString());
  });

  it('a last sync in the future (clock change) is clamped to now', () => {
    expect(syncRange('2027-01-01T00:00:00.000Z', now).startDate)
      .toBe(new Date(now.getTime() - SYNC_OVERLAP_MS).toISOString());
  });

  it('a corrupted last sync falls back to the first-import window', () => {
    expect(syncRange('garbage', now).startDate).toBe('2026-07-31T12:00:00.000Z');
  });
});

describe('isAutoSyncDue', () => {
  const now = new Date('2026-10-29T12:00:00.000Z');
  it('never when not connected', () => {
    expect(isAutoSyncDue({ connected: false, lastSyncAt: null }, now)).toBe(false);
  });
  it('immediately when connected and never synced', () => {
    expect(isAutoSyncDue({ connected: true, lastSyncAt: null }, now)).toBe(true);
  });
  it('at most every 6 hours', () => {
    const at = (ms: number) => new Date(now.getTime() - ms).toISOString();
    expect(isAutoSyncDue({ connected: true, lastSyncAt: at(AUTO_SYNC_INTERVAL_MS - 1000) }, now)).toBe(false);
    expect(isAutoSyncDue({ connected: true, lastSyncAt: at(AUTO_SYNC_INTERVAL_MS) }, now)).toBe(true);
  });
  it('when the last sync lies in the future', () => {
    expect(isAutoSyncDue({ connected: true, lastSyncAt: '2027-01-01T00:00:00.000Z' }, now)).toBe(true);
  });
});

describe('parseHealthState', () => {
  it('tolerates empty and broken storage', () => {
    expect(parseHealthState(null)).toEqual({ connected: false, lastSyncAt: null });
    expect(parseHealthState('{')).toEqual({ connected: false, lastSyncAt: null });
    expect(parseHealthState('null')).toEqual({ connected: false, lastSyncAt: null });
    expect(parseHealthState('{"connected":"yes","lastSyncAt":"x"}')).toEqual({ connected: false, lastSyncAt: null });
  });
  it('reads a valid state', () => {
    expect(parseHealthState('{"connected":true,"lastSyncAt":"2026-10-29T10:00:00.000Z"}'))
      .toEqual({ connected: true, lastSyncAt: '2026-10-29T10:00:00.000Z' });
  });
});

describe('platform helpers', () => {
  it('maps platform to weight source', () => {
    expect(healthSourceFor('ios')).toBe('apple_health');
    expect(healthSourceFor('android')).toBe('health_connect');
  });
  it('maps availability results', () => {
    expect(availabilityFromResult(null, { available: true })).toBe('unsupported');
    expect(availabilityFromResult('ios', { available: true })).toBe('available');
    expect(availabilityFromResult('ios', { available: false })).toBe('unsupported');
    expect(availabilityFromResult('android', { available: false, reason: 'Health Connect needs an update.' })).toBe('update_required');
    expect(availabilityFromResult('android', { available: false, reason: 'Health Connect is unavailable on this device.' })).toBe('not_installed');
  });
});
