import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { passesCandidateFilter, type Exercise, type SelectionContext, type SelectionOptions } from './selectionAlgorithm';

// Režim „bez posilovny" (feedback 13. 10.) — filtr kandidátů generátoru
const ex = (id: string, machine_id: string | null, extra: Partial<Exercise> = {}): Exercise => ({
  id, name: id, primary_role: 'horizontal_push', difficulty: 1, machine_id, equipment_type: 'free_weight',
  allowed_phase: 'main', primary_muscles: [], secondary_muscles: [], ...extra,
});

const ctx = (machines: string[], extra: Partial<SelectionContext> = {}): SelectionContext => ({
  gymId: null,
  userLevel: 'beginner',
  injuries: [],
  equipmentPreference: null,
  equipmentAvailable: new Set(),
  machineIdsAvailable: new Set(machines),
  machineIdToBenchConfigs: new Map(),
  coveredMusclesSession: new Set(),
  usedExerciseIdsToday: [],
  usedEquipmentTypes: new Set(),
  roleOccurrence: 1,
  slotCategory: 'secondary',
  durationMinutes: 45,
  ...extra,
});

const STRICT: SelectionOptions = { strictEquipment: true, strictInjuries: true, checkRepetition: true };
const BODYWEIGHT_FALLBACK: SelectionOptions = { strictEquipment: false, bodyweightOnly: true, strictInjuries: true, checkRepetition: false };

describe('passesCandidateFilter — vlastní vybavení', () => {
  const pushup = ex('pushup', null, { equipment_type: 'bodyweight' });
  const dbPress = ex('db_press', 'm-db');
  const squat = ex('squat', 'm-rack', { secondary_machine_id: 'm-bar' });
  const pullup = ex('pullup', 'm-bar-hrazda', { equipment_type: 'bodyweight' });

  it('bere cviky bez stroje a s dostupným strojem', () => {
    const c = ctx(['m-db'], { customEquipmentMode: true });
    expect([pushup, dbPress, squat].filter(e => passesCandidateFilter(e, c, STRICT)).map(e => e.id)).toEqual(['pushup', 'db_press']);
  });

  it('vyžaduje i vedlejší stroj (rack bez osy nestačí)', () => {
    expect(passesCandidateFilter(squat, ctx(['m-rack'], { customEquipmentMode: true }), STRICT)).toBe(false);
    expect(passesCandidateFilter(squat, ctx(['m-rack', 'm-bar'], { customEquipmentMode: true }), STRICT)).toBe(true);
  });

  it('fallback na vlastní váhu nepustí shyby, když hrazda není ve vybavení', () => {
    expect(passesCandidateFilter(pullup, ctx([], { customEquipmentMode: true }), BODYWEIGHT_FALLBACK)).toBe(false);
    expect(passesCandidateFilter(pullup, ctx(['m-bar-hrazda'], { customEquipmentMode: true }), BODYWEIGHT_FALLBACK)).toBe(true);
  });

  it('posilovna (bez režimu vlastního vybavení) se chová jako dřív', () => {
    // Vedlejší stroj se u posilovny nekontroluje, fallback na vlastní váhu stroje neřeší
    expect(passesCandidateFilter(squat, ctx(['m-rack']), STRICT)).toBe(true);
    expect(passesCandidateFilter(pullup, ctx([]), BODYWEIGHT_FALLBACK)).toBe(true);
    expect(passesCandidateFilter(dbPress, ctx([]), STRICT)).toBe(false);
  });

  it('ostatní filtry platí dál (už použitý cvik, zranění)', () => {
    expect(passesCandidateFilter(dbPress, ctx(['m-db'], { customEquipmentMode: true, usedExerciseIdsToday: ['db_press'] }), STRICT)).toBe(false);
    const banned = ex('banned', null, { banned_injuries: ['shoulders'] });
    expect(passesCandidateFilter(banned, ctx([], { customEquipmentMode: true, injuries: ['shoulders'] }), STRICT)).toBe(false);
  });
});
